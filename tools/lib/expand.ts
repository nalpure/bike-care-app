// Turns a tutorial or diagnosis into concrete runs, one per combination of the keys it reads.
//
// The same resolver functions serve two purposes:
//  - enumerate(): a Reader that branches on every key it has not seen yet, to find all paths;
//  - profile journeys: a Reader backed by a profile's facts and answers.

import type { Content, Entry, TutorialEntry } from './content.js';
import { evaluate, substCondition, substParams, UNKNOWN, type Condition, type Value } from './conditions.js';
import { factDef, posify } from './refs.js';
import type { YamlFile, YPath } from './yamlfile.js';

// ---------------------------------------------------------------- readers

export interface Reader {
  /** A key the app may ask about (route fact, choice). Counts as asked. */
  ask(key: string): Value;
  /** A key that changes what is shown (button set, conditional step) without being asked. */
  branch(key: string): Value;
  /** A key read for display only (tool lists). Never branches; unassigned reads as unknown. */
  peek(key: string): Value;
}

export class NeedKey {
  constructor(public key: string) {}
}

export interface Enumerated<T> {
  assign: Record<string, Value>;
  /** keys asked, in the order they were first read */
  asked: string[];
  /** every key read (asked or branched), in order */
  read: string[];
  result: T;
}

export function domainFor(c: Content, key: string): Value[] {
  if (key.startsWith('tool.')) return [true, false];
  if (key.startsWith('choice.')) return (c.choices.get(key.slice(7))?.def.options ?? []).map((o: any) => o.id);
  const f = factDef(c, key);
  if (!f) return [UNKNOWN];
  if (f.def.type === 'enum') return [...f.def.values, UNKNOWN];
  if (f.def.type === 'boolean') return [true, false, UNKNOWN];
  return [UNKNOWN];
}

/** Tools implied by chosen run-choice options (option stand requires bike-stand). */
function impliedTool(c: Content, assign: Record<string, Value>, key: string): boolean {
  if (!key.startsWith('tool.')) return false;
  const tool = key.slice(5);
  for (const [k, v] of Object.entries(assign)) {
    if (!k.startsWith('choice.')) continue;
    const opt = c.choices.get(k.slice(7))?.def.options.find((o: any) => o.id === v);
    if (opt?.requires_tools?.includes(tool)) return true;
  }
  return false;
}

export function enumerate<T>(c: Content, resolve: (r: Reader) => T, fixed: Record<string, Value> = {}): Enumerated<T>[] {
  const out: Enumerated<T>[] = [];
  const stack: Record<string, Value>[] = [{}];
  let guard = 0;
  while (stack.length) {
    if (++guard > 20000) throw new Error('Path expansion exceeded 20000 combinations. Split the flow.');
    const assign = stack.pop()!;
    const asked: string[] = [];
    const read: string[] = [];
    const get = (key: string, isAsk: boolean): Value => {
      let v: Value;
      if (key in fixed) v = fixed[key];
      else if (key in assign) v = assign[key];
      else if (impliedTool(c, assign, key)) v = true;
      else throw new NeedKey(key);
      if (!read.includes(key)) read.push(key);
      if (isAsk && !asked.includes(key)) asked.push(key);
      return v;
    };
    const reader: Reader = {
      ask: (k) => get(k, true),
      branch: (k) => get(k, false),
      peek: (k) => (k in fixed ? fixed[k] : k in assign ? assign[k] : UNKNOWN),
    };
    try {
      const result = resolve(reader);
      out.push({ assign, asked, read, result });
    } catch (e) {
      if (!(e instanceof NeedKey)) throw e;
      const values = domainFor(c, e.key);
      for (let i = values.length - 1; i >= 0; i--) stack.push({ ...assign, [e.key]: values[i] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- shared shapes

export interface Src {
  file: YamlFile;
  path: YPath;
}

export interface Exit {
  kind: 'shop' | 'not_covered' | 'uncovered';
  message: string;
  src: Src;
}

export interface Problem {
  rule: string;
  message: string;
  src: Src;
  id: string;
}

export interface ToolList {
  required: string[];
  helpful: string[];
}

export interface PathItem {
  kind: 'step' | 'inspect';
  id: string;
  def: any;
  list: 'sequence' | 'finish';
  /** procedure id this step came from, if any (top-level call) */
  via?: string;
  outcomes?: Record<string, any>;
  /** step buttons after their when conditions */
  buttons: any[];
  /** show generic_text instead of text */
  generic: boolean;
  src: Src;
  /** where the step or inspection itself is defined */
  defSrc: Src;
  tools: ToolList;
}

function toolsOf(def: any, r: Reader): ToolList {
  const pick = (list: any[] | undefined) =>
    (list ?? [])
      .filter((t) => typeof t === 'string' || evaluate(t.when, (k) => r.peek(k)) || conditionReadsUnknown(t.when, r))
      .map((t) => (typeof t === 'string' ? t : t.id));
  return { required: pick(def.tools?.required), helpful: pick(def.tools?.helpful) };
}

function conditionReadsUnknown(cond: Condition | undefined, r: Reader): boolean {
  let unknown = false;
  evaluate(cond, (k) => {
    const v = r.peek(k);
    if (String(v) === UNKNOWN) unknown = true;
    return v;
  });
  return unknown;
}

/** Evaluates a condition and reports whether any value it read was unknown. */
function evalTracked(cond: Condition | undefined, read: (k: string) => Value): { ok: boolean; sawUnknown: boolean } {
  let sawUnknown = false;
  const ok = evaluate(cond, (k) => {
    const v = read(k);
    if (String(v) === UNKNOWN) sawUnknown = true;
    return v;
  });
  return { ok, sawUnknown };
}

// ---------------------------------------------------------------- tutorials

export interface TutorialRun {
  exit?: Exit;
  /** the case or cases chosen, for the walkthrough header */
  caseLabel: string;
  caseFile?: string;
  sequence: PathItem[];
  finish: PathItem[];
  problems: Problem[];
}

export function resolveTutorial(c: Content, t: TutorialEntry, r: Reader, params: Record<string, string> = {}): TutorialRun {
  const run: TutorialRun = { caseLabel: '', sequence: [], finish: [], problems: [] };
  const tf = t.file;
  const pick = (cases: any[], base: YPath) => {
    for (let i = 0; i < cases.length; i++) {
      if (evaluate(substCondition(cases[i].when, params), r.ask)) return { cs: cases[i], path: [...base, i] };
    }
    return null;
  };
  const top = pick(t.def.cases, ['tutorial', 'cases']);
  if (!top) {
    run.exit = { kind: 'uncovered', message: 'No case matches.', src: { file: tf, path: ['tutorial', 'cases'] } };
    return run;
  }
  let target = top;
  if (top.cs.cases) {
    const leaf = pick(top.cs.cases, [...top.path, 'cases']);
    if (!leaf) {
      run.exit = { kind: 'uncovered', message: 'No nested case matches.', src: { file: tf, path: [...top.path, 'cases'] } };
      return run;
    }
    target = leaf;
  }
  if (target.cs.shop !== undefined) {
    run.exit = { kind: 'shop', message: target.cs.shop, src: { file: tf, path: target.path } };
    return run;
  }
  if (target.cs.not_covered !== undefined) {
    run.exit = { kind: 'not_covered', message: target.cs.not_covered, src: { file: tf, path: target.path } };
    return run;
  }
  const cf = t.cases.get(target.cs.include);
  if (!cf) {
    run.exit = { kind: 'uncovered', message: `Case file ${target.cs.include} is missing.`, src: { file: tf, path: target.path } };
    return run;
  }
  run.caseFile = cf.rel;
  run.caseLabel = target.cs.include.replace(/^cases\//, '').replace(/\.yaml$/, '');
  for (const list of ['sequence', 'finish'] as const) {
    const items: any[] = cf.data[list] ?? [];
    for (let i = 0; i < items.length; i++) {
      const exit = expandItem(c, items[i], list, { file: cf, path: [list, i] }, r, params, run, t.def.id);
      if (exit) {
        run.exit = exit;
        return run;
      }
    }
  }
  return run;
}

function expandItem(
  c: Content, it: any, list: 'sequence' | 'finish', src: Src, r: Reader,
  params: Record<string, string>, run: TutorialRun, tid: string, via?: string,
): Exit | undefined {
  const out = list === 'sequence' ? run.sequence : run.finish;
  if (it.step) {
    pushStep(c, substParams(it.step, params), list, src, r, params, out, via);
    return;
  }
  if (it.procedure) return expandProcedure(c, substParams(it.procedure, params), list, src, r, params, run, tid, via ?? substParams(it.procedure, params));
  if (it.inspect) {
    const id = substParams(it.inspect, params);
    const insp = c.inspections.get(id) ?? c.inspections.get(posify(id));
    if (!insp) return;
    if (insp.def.applies_when && !evaluate(substCondition(insp.def.applies_when, params), r.ask)) {
      run.problems.push({ rule: 'inspection-not-applicable', id: `tutorial ${tid} / inspect ${id}`, src, message: `Inspection ${id} does not apply to this bike (its applies_when fails), but the case calls it.` });
    }
    out.push({ kind: 'inspect', id, def: insp.def, list, via, outcomes: it.outcomes, buttons: [], generic: false, src, defSrc: { file: insp.file, path: insp.path }, tools: toolsOf(insp.def, r) });
  }
  return;
}

function pushStep(c: Content, id: string, list: 'sequence' | 'finish', src: Src, r: Reader, params: Record<string, string>, out: PathItem[], via?: string): void {
  const e = c.steps.get(id) ?? c.steps.get(posify(id));
  if (!e) return;
  const s = e.def;
  let generic = false;
  if (s.when) {
    const read = s.if_unknown === 'ask' ? r.ask : r.branch;
    const { ok, sawUnknown } = evalTracked(substCondition(s.when, params), read);
    if (!ok) {
      if (!sawUnknown || s.if_unknown === 'skip') return;
      generic = s.if_unknown === 'generic' || (s.if_unknown === 'ask' && !!s.generic_text);
    }
  }
  const buttons = (s.buttons ?? []).filter((b: any) => {
    if (!b.when) return true;
    const { ok, sawUnknown } = evalTracked(substCondition(b.when, params), r.branch);
    return ok || sawUnknown;
  });
  out.push({ kind: 'step', id, def: s, list, via, buttons, generic, src, defSrc: { file: e.file, path: e.path }, tools: toolsOf(s, r) });
}

function expandProcedure(
  c: Content, id: string, list: 'sequence' | 'finish', src: Src, r: Reader,
  params: Record<string, string>, run: TutorialRun, tid: string, via: string, depth = 0,
): Exit | undefined {
  const p = c.procedures.get(id) ?? c.procedures.get(posify(id));
  if (!p || depth > 5) return;
  const impls: any[] = p.def.implementations;
  const idx = impls.findIndex((impl) => evaluate(substCondition(impl.when, params), r.ask));
  if (idx < 0) {
    return { kind: 'uncovered', message: `No implementation of procedure ${id} matches.`, src: { file: p.file, path: [...p.path, 'implementations'] } };
  }
  const implSrc: Src = { file: p.file, path: [...p.path, 'implementations', idx] };
  for (const it of impls[idx].steps) {
    if (typeof it === 'string') pushStep(c, substParams(it, params), list, src, r, params, list === 'sequence' ? run.sequence : run.finish, via);
    else if (it.procedure) {
      const exit = expandProcedure(c, substParams(it.procedure, params), list, src, r, params, run, tid, via, depth + 1);
      if (exit) return exit;
    } else if (it.shop !== undefined) return { kind: 'shop', message: it.shop, src: implSrc };
    else if (it.not_covered !== undefined) return { kind: 'not_covered', message: it.not_covered, src: implSrc };
  }
  return;
}

// ---------------------------------------------------------------- tutorial path variants

export interface StopPoint {
  /** index into the combined list (sequence then finish) */
  index: number;
  /** inspection state id, or a slug of the button label */
  key: string;
  /** for a button stop: its index in the step's buttons */
  buttonIndex?: number;
  label: string;
  kind: 'stop' | 'end';
  message: string;
  showHowFrom?: string;
}

export interface Variant {
  id: string;
  ending: 'complete' | 'stop' | 'jump';
  stop?: StopPoint;
  /** index into the combined list where the jump lands */
  jumpIndex?: number;
  /** executed items in order */
  items: PathItem[];
  /** for each executed item, whether it was reached by the jump */
  afterJump: boolean[];
}

/** "The chain falls off, or touches the spokes" -> "chain-falls-off-or" */
export function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter((w) => w && !['the', 'a', 'an', 'it', 'is'].includes(w))
    .slice(0, 4)
    .join('-');
}

export function combined(run: TutorialRun): PathItem[] {
  return [...run.sequence, ...run.finish];
}

export function stopPoints(run: TutorialRun): StopPoint[] {
  const out: StopPoint[] = [];
  combined(run).forEach((item, index) => {
    if (item.kind === 'inspect') {
      for (const st of item.def.states) {
        const o = item.outcomes?.[st.id];
        if (o && typeof o === 'object' && (o.stop || o.end)) {
          out.push({ index, key: st.id, label: st.label, kind: o.stop ? 'stop' : 'end', message: o.stop ?? o.end, showHowFrom: o.show_how_from });
        }
      }
    } else {
      item.buttons.forEach((b) => {
        const buttonIndex = (item.def.buttons ?? []).indexOf(b);
        if (b.stop) out.push({ index, key: slug(b.label), buttonIndex, label: b.label, kind: 'stop', message: b.stop, showHowFrom: b.show_how_from });
      });
    }
  });
  return out;
}

/** Index of the jump target: the first item at or after from+1 in the sequence that is the step or comes from the procedure. */
export function findJumpTarget(run: TutorialRun, from: number, target: string): number | undefined {
  const all = combined(run);
  for (let i = from + 1; i < run.sequence.length; i++) {
    const it = all[i];
    if (it.id === target || it.via === target || posify(it.id) === target || (it.via && posify(it.via) === target)) return i;
  }
  return undefined;
}

export function variantsOf(run: TutorialRun, baseId: string, stateAt: (v: Variant, index: number) => Set<string>): Variant[] {
  const all = combined(run);
  const complete: Variant = { id: baseId, ending: 'complete', items: all, afterJump: all.map(() => false) };
  const out: Variant[] = [complete];
  for (const sp of stopPoints(run)) {
    const sid = `${baseId}--${sp.kind}-${all[sp.index].id}-${sp.key}`;
    const upTo = all.slice(0, sp.index + 1);
    const stopV: Variant = { id: sid, ending: 'stop', stop: sp, items: upTo, afterJump: upTo.map(() => false) };
    out.push(stopV);
    const state = stateAt(complete, sp.index);
    if (sp.showHowFrom && state.size) {
      const j = findJumpTarget(run, sp.index, sp.showHowFrom);
      if (j !== undefined) {
        const tail = all.slice(j, run.sequence.length);
        out.push({ id: `${sid}--jump`, ending: 'jump', stop: sp, jumpIndex: j, items: [...upTo, ...tail], afterJump: [...upTo.map(() => false), ...tail.map(() => true)] });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- diagnoses

export interface DiagnosisCheck {
  id: string;
  def: any;
  /** effective leads_to per state after overrides (null = not a hit) */
  hits: Record<string, { job: string; urgency: string } | null>;
  skipped: boolean;
  src: Src;
}

export interface DiagnosisRun {
  exit?: Exit;
  checks: DiagnosisCheck[];
}

export function resolveDiagnosis(c: Content, d: Entry, r: Reader, params: Record<string, string> = {}): DiagnosisRun {
  const def = d.def;
  if (def.applies_when && !evaluate(substCondition(def.applies_when, params), r.ask)) {
    const ncs: any[] = def.not_covered ?? [];
    for (let i = 0; i < ncs.length; i++) {
      if (evaluate(substCondition(ncs[i].when, params), r.ask)) {
        return { checks: [], exit: { kind: 'not_covered', message: ncs[i].message, src: { file: d.file, path: [...d.path, 'not_covered', i] } } };
      }
    }
    return { checks: [], exit: { kind: 'uncovered', message: 'applies_when fails and no not_covered entry matches.', src: { file: d.file, path: [...d.path, 'applies_when'] } } };
  }
  const checks: DiagnosisCheck[] = def.checks.map((ch: any, i: number) => {
    const id = substParams(ch.inspect, params);
    const insp = c.inspections.get(id) ?? c.inspections.get(posify(id));
    const skipped = !!insp?.def.applies_when && !evaluate(substCondition(insp.def.applies_when, params), r.ask);
    const hits: DiagnosisCheck['hits'] = {};
    for (const st of insp?.def.states ?? []) {
      hits[st.id] = ch.override && st.id in ch.override ? ch.override[st.id] : st.leads_to ?? null;
    }
    return { id, def: insp?.def, hits, skipped, src: { file: d.file, path: [...d.path, 'checks', i] } };
  });
  return { checks };
}

export interface DiagnosisPath {
  id: string;
  /** index of the hit check, or -1 for no hit */
  hitIndex: number;
  hitState?: string;
  job: string;
  urgency?: string;
}

export function diagnosisPaths(run: DiagnosisRun, baseId: string, noHitJob: string): DiagnosisPath[] {
  const out: DiagnosisPath[] = [];
  run.checks.forEach((ch, i) => {
    if (ch.skipped) return;
    for (const [state, hit] of Object.entries(ch.hits)) {
      if (hit) out.push({ id: `${baseId}--${ch.id}-${state}`, hitIndex: i, hitState: state, job: hit.job, urgency: hit.urgency });
    }
  });
  out.push({ id: `${baseId}--no-hit`, hitIndex: -1, job: noHitJob });
  return out;
}

// ---------------------------------------------------------------- ids

export function comboId(c: Content, asked: string[], assign: Record<string, Value>): string {
  if (!asked.length) return 'any';
  return asked
    .map((k) => {
      const v = assign[k];
      const last = k.split('.').pop()!;
      if (typeof v === 'boolean' || String(v) === UNKNOWN) return `${last}-${String(v)}`;
      return String(v);
    })
    .join('.')
    .replace(/_/g, '-');
}

export function paramCombos(params: Record<string, { values: string[] }> | undefined): Record<string, string>[] {
  let combos: Record<string, string>[] = [{}];
  for (const [name, p] of Object.entries(params ?? {})) {
    combos = combos.flatMap((cmb) => p.values.map((v) => ({ ...cmb, [name]: v })));
  }
  return combos;
}
