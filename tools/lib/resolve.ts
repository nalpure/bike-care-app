// The resolver, shared by the build tool and the player. Dependency-free on purpose (only
// conditions.ts): it works on the data of build/bundle.json, so the app and the reviewed output
// cannot drift apart.
//
// It turns a tutorial or a diagnosis into the concrete list the user sees: case selection,
// procedure implementations, conditional steps, button sets, exits, jump targets and skips.
// It never plans or reorders anything.
//
// Source locations: every result carries `src` values made by a `locate` callback. The build tool
// passes one that maps bundle objects back to their YAML file and line; the player passes none.

import { evaluate, substCondition, substParams, UNKNOWN, type Condition, type Value } from './conditions.js';

// ---------------------------------------------------------------- bundle data

/** The content lists of build/bundle.json. Tutorials have their case files inlined as `case`. */
export interface BundleData {
  /** { id, label, icon }: a fact's group is the part of its key before the first dot */
  fact_groups: any[];
  facts: any[];
  choices: any[];
  states: any[];
  tools: any[];
  /** "one of these, depending on your part": a set of tools of which the bike needs one */
  tool_sets: any[];
  parts: any[];
  inspections: any[];
  jobs: any[];
  steps: any[];
  procedures: any[];
  tutorials: any[];
  diagnoses: any[];
  checks: any[];
}

export interface Index {
  fact_groups: Map<string, any>;
  facts: Map<string, any>;
  choices: Map<string, any>;
  states: Map<string, any>;
  tools: Map<string, any>;
  tool_sets: Map<string, any>;
  parts: Map<string, any>;
  inspections: Map<string, any>;
  jobs: Map<string, any>;
  steps: Map<string, any>;
  procedures: Map<string, any>;
  tutorials: Map<string, any>;
  diagnoses: Map<string, any>;
  checks: Map<string, any>;
}

export function indexBundle(b: BundleData): Index {
  const by = (list: any[] | undefined, key = 'id') => new Map<string, any>((list ?? []).map((d) => [d[key], d]));
  return {
    fact_groups: by(b.fact_groups),
    facts: by(b.facts, 'key'),
    choices: by(b.choices),
    states: by(b.states),
    tools: by(b.tools),
    tool_sets: by(b.tool_sets),
    parts: by(b.parts),
    inspections: by(b.inspections),
    jobs: by(b.jobs),
    steps: by(b.steps),
    procedures: by(b.procedures),
    tutorials: by(b.tutorials),
    diagnoses: by(b.diagnoses),
    checks: by(b.checks),
  };
}

/** Makes a source location for a bundle object, with an optional sub-path inside it. */
export type Locate<S> = (node: object, ...sub: (string | number)[]) => S;

const noLocation: Locate<any> = () => undefined;

// ---------------------------------------------------------------- lookups

/** remove-front-wheel -> remove-<pos>-wheel */
export function posify(id: string): string {
  return id.replace(/(^|-)(front|rear)(-|$)/, '$1<pos>$3');
}

/** The fact definition for a key, also for positional keys (brake.type.front -> brake.type.<pos>). */
export function factOf(ix: Index, key: string): any | undefined {
  return ix.facts.get(key) ?? ix.facts.get(key.replace(/\.(front|rear)$/, '.<pos>'));
}

/** A fact marked ask: never. Conditions read it, but the app never asks; it comes from the bike's data. */
export function neverAsked(ix: Index, key: string): boolean {
  return factOf(ix, key)?.ask === 'never';
}

function stepDef(ix: Index, id: string): any | undefined {
  return ix.steps.get(id) ?? ix.steps.get(posify(id));
}

function inspectionDef(ix: Index, id: string): any | undefined {
  return ix.inspections.get(id) ?? ix.inspections.get(posify(id));
}

function procedureDef(ix: Index, id: string): any | undefined {
  return ix.procedures.get(id) ?? ix.procedures.get(posify(id));
}

// ---------------------------------------------------------------- readers

export interface Reader {
  /** A key the app may ask about (route fact, choice). Counts as asked. */
  ask(key: string): Value;
  /** A key that changes what is shown (button set, conditional step) without being asked. */
  branch(key: string): Value;
  /** A key read for display only (tool lists). Never branches; unassigned reads as unknown. */
  peek(key: string): Value;
}

// ---------------------------------------------------------------- enumeration

/** Thrown by a reader when a key has no value yet. */
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

/** Every value a key can take: tools true or false, a choice's options, a fact's values plus unknown. */
export function domainOf(ix: Index, key: string): Value[] {
  if (key.startsWith('tool.')) return [true, false];
  if (key.startsWith('choice.')) return (ix.choices.get(key.slice(7))?.options ?? []).map((o: any) => o.id);
  const f = factOf(ix, key);
  if (!f) return [UNKNOWN];
  if (f.type === 'enum') return [...f.values, UNKNOWN];
  if (f.type === 'boolean') return [true, false, UNKNOWN];
  return [UNKNOWN];
}

/** Tools implied by chosen run-choice options (option stand requires bike-stand). */
export function impliedTool(ix: Index, assign: Record<string, Value>, key: string): boolean {
  if (!key.startsWith('tool.')) return false;
  const tool = key.slice(5);
  for (const [k, v] of Object.entries(assign)) {
    if (!k.startsWith('choice.')) continue;
    const opt = ix.choices.get(k.slice(7))?.options.find((o: any) => o.id === v);
    if (opt?.requires_tools?.includes(tool)) return true;
  }
  return false;
}

/**
 * Runs `resolve` once per combination of the keys it reads, branching on every key that is
 * neither fixed nor assigned yet. Keys are read in written order, so only keys that matter branch.
 */
export function enumerate<T>(ix: Index, resolve: (r: Reader) => T, fixed: Record<string, Value> = {}): Enumerated<T>[] {
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
      else if (impliedTool(ix, assign, key)) v = true;
      else throw new NeedKey(key);
      if (!read.includes(key)) read.push(key);
      if (isAsk && !asked.includes(key) && !neverAsked(ix, key)) asked.push(key);
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
      const values = domainOf(ix, e.key);
      for (let i = values.length - 1; i >= 0; i--) stack.push({ ...assign, [e.key]: values[i] });
    }
  }
  return out;
}

/** Minutes of a list of items. */
export function minutesOf(items: { def: any }[]): number {
  return items.reduce((s, it) => s + (it.def.minutes ?? 0), 0);
}

// ---------------------------------------------------------------- shared shapes

/** unsafe: do not ride. not_covered: not supported yet. not_needed: repair not needed. shop_only: a shop must do it. */
export type ExitKind = 'unsafe' | 'not_covered' | 'not_needed' | 'shop_only';

export interface Exit<S = unknown> {
  /** uncovered: the content has no answer for this bike (a build error; the player shows "not covered") */
  kind: ExitKind | 'uncovered';
  message: string;
  src: S;
}

export interface Problem<S = unknown> {
  rule: string;
  message: string;
  src: S;
  id: string;
}

/** One "one of these" set on a path: the options that fit this bike (all of them when its data does not say). */
export interface ToolSetUse {
  set: string;
  options: string[];
  /** true when the bike's data picked the options; false when all are shown */
  decided: boolean;
}

export interface ToolList {
  required: string[];
  one_of: ToolSetUse[];
  helpful: string[];
}

export interface PathItem<S = unknown> {
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
  src: S;
  /** where the step or inspection itself is defined */
  defSrc: S;
  tools: ToolList;
}

function toolsOf(ix: Index, def: any, r: Reader): ToolList {
  const pick = (list: any[] | undefined) =>
    (list ?? [])
      .filter((t) => typeof t === 'string' || evaluate(t.when, (k) => r.peek(k)) || conditionReadsUnknown(t.when, r))
      .map((t) => (typeof t === 'string' ? t : t.id));
  return { required: pick(def.tools?.required), one_of: (def.tools?.one_of ?? []).map((id: string) => toolSetUse(ix, id, r)), helpful: pick(def.tools?.helpful) };
}

/**
 * The options of a tool set that fit this bike. An option's when reads only facts from the bike's
 * data (ask: never), so nothing is asked: when the data names the option, only it is shown;
 * otherwise every option, and the app shows the set's tell_apart note.
 */
export function toolSetUse(ix: Index, id: string, r: Reader): ToolSetUse {
  const options: any[] = ix.tool_sets.get(id)?.options ?? [];
  const fits = options.filter((o) => o.when && evaluate(o.when, (k) => r.peek(k)));
  if (fits.length) return { set: id, options: fits.map((o) => o.tool), decided: true };
  return { set: id, options: options.map((o) => o.tool), decided: false };
}

/** Every tool a set of tool lists names, in order: needed, the shown options of each set, helpful. */
export function mergeTools(lists: ToolList[]): ToolList {
  const req = new Set<string>();
  const help = new Set<string>();
  const sets = new Map<string, ToolSetUse>();
  for (const l of lists) {
    l.required.forEach((t) => req.add(t));
    l.helpful.forEach((t) => help.add(t));
    for (const u of l.one_of) if (!sets.has(u.set)) sets.set(u.set, u);
  }
  const inSets = new Set([...sets.values()].flatMap((u) => u.options));
  for (const t of [...req, ...inSets]) help.delete(t);
  return { required: [...req], one_of: [...sets.values()], helpful: [...help] };
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

export interface TutorialRun<S = unknown> {
  exit?: Exit<S>;
  /** the case or cases chosen, for the walkthrough header */
  caseLabel: string;
  sequence: PathItem<S>[];
  finish: PathItem<S>[];
  problems: Problem<S>[];
}

/**
 * Whether a job covers this bike (its covers, written once): undefined when it does, otherwise the
 * first matching not_covered text, or 'uncovered' (a build error) when none matches.
 */
export function coverageExit<S = unknown>(ix: Index, jobId: string, r: Reader, params: Record<string, string> = {}, loc: Locate<S> = noLocation): Exit<S> | undefined {
  const job = ix.jobs.get(jobId);
  const cv = job?.covers;
  if (!cv || evaluate(substCondition(cv.when, params), r.ask)) return undefined;
  const ncs: any[] = cv.not_covered;
  for (let i = 0; i < ncs.length; i++) {
    if (evaluate(substCondition(ncs[i].when, params), r.ask)) return { kind: 'not_covered', message: ncs[i].text, src: loc(job, 'covers', 'not_covered', i) };
  }
  return { kind: 'uncovered', message: `Job ${jobId} does not cover this bike, and none of its not_covered entries matches.`, src: loc(job, 'covers') };
}

/** Resolves one tutorial (a bundle tutorial) for one bike, choice set and parameter set. */
export function resolveTutorial<S = unknown>(ix: Index, t: any, r: Reader, params: Record<string, string> = {}, loc: Locate<S> = noLocation): TutorialRun<S> {
  const run: TutorialRun<S> = { caseLabel: '', sequence: [], finish: [], problems: [] };
  const outside = coverageExit(ix, t.job, r, params, loc);
  if (outside) {
    run.exit = outside;
    return run;
  }
  const pick = (cases: any[]) => {
    for (const cs of cases) if (evaluate(substCondition(cs.when, params), r.ask)) return cs;
    return null;
  };
  const top = pick(t.cases);
  if (!top) {
    run.exit = { kind: 'uncovered', message: 'No case matches.', src: loc(t, 'cases') };
    return run;
  }
  let target = top;
  if (top.cases) {
    const leaf = pick(top.cases);
    if (!leaf) {
      run.exit = { kind: 'uncovered', message: 'No nested case matches.', src: loc(top, 'cases') };
      return run;
    }
    target = leaf;
  }
  const cf = target.case;
  if (!cf) {
    run.exit = { kind: 'uncovered', message: `Case file ${target.include} is missing.`, src: loc(target) };
    return run;
  }
  run.caseLabel = cf.name;
  // The tutorial's checks run first, in every case (declared once, not per case file).
  const pre: any[] = t.checks ?? [];
  for (let i = 0; i < pre.length; i++) expandItem(ix, pre[i], 'sequence', loc(t, 'checks', i), r, params, run, t.id, loc);
  for (const list of ['sequence', 'finish'] as const) {
    const items: any[] = cf[list] ?? [];
    for (let i = 0; i < items.length; i++) {
      const exit = expandItem(ix, items[i], list, loc(cf, list, i), r, params, run, t.id, loc);
      if (exit) {
        run.exit = exit;
        return run;
      }
    }
  }
  return run;
}

function expandItem<S>(
  ix: Index, it: any, list: 'sequence' | 'finish', src: S, r: Reader,
  params: Record<string, string>, run: TutorialRun<S>, tid: string, loc: Locate<S>, via?: string,
): Exit<S> | undefined {
  const out = list === 'sequence' ? run.sequence : run.finish;
  if (it.step) {
    pushStep(ix, substParams(it.step, params), list, src, r, params, out, loc, via);
    return;
  }
  if (it.procedure) return expandProcedure(ix, substParams(it.procedure, params), list, src, r, params, run, loc, via ?? substParams(it.procedure, params));
  if (it.inspect) {
    const id = substParams(it.inspect, params);
    const insp = inspectionDef(ix, id);
    if (!insp) return;
    if (insp.applies_when && !evaluate(substCondition(insp.applies_when, params), r.ask)) {
      run.problems.push({ rule: 'inspection-not-applicable', id: `tutorial ${tid} / inspect ${id}`, src, message: `Inspection ${id} does not apply to this bike (its applies_when fails), but the case calls it.` });
    }
    out.push({ kind: 'inspect', id, def: insp, list, via, outcomes: it.outcomes, buttons: [], generic: false, src, defSrc: loc(insp), tools: toolsOf(ix, insp, r) });
  }
  return;
}

function pushStep<S>(ix: Index, id: string, list: 'sequence' | 'finish', src: S, r: Reader, params: Record<string, string>, out: PathItem<S>[], loc: Locate<S>, via?: string): void {
  const s = stepDef(ix, id);
  if (!s) return;
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
  out.push({ kind: 'step', id, def: s, list, via, buttons, generic, src, defSrc: loc(s), tools: toolsOf(ix, s, r) });
}

function expandProcedure<S>(
  ix: Index, id: string, list: 'sequence' | 'finish', src: S, r: Reader,
  params: Record<string, string>, run: TutorialRun<S>, loc: Locate<S>, via: string, depth = 0,
): Exit<S> | undefined {
  const p = procedureDef(ix, id);
  if (!p || depth > 5) return;
  const impls: any[] = p.implementations;
  const idx = impls.findIndex((impl) => evaluate(substCondition(impl.when, params), r.ask));
  if (idx < 0) {
    return { kind: 'uncovered', message: `No implementation of procedure ${id} matches.`, src: loc(p, 'implementations') };
  }
  for (const it of impls[idx].steps) {
    if (typeof it === 'string') pushStep(ix, substParams(it, params), list, src, r, params, list === 'sequence' ? run.sequence : run.finish, loc, via);
    else if (it.procedure) {
      const exit = expandProcedure(ix, substParams(it.procedure, params), list, src, r, params, run, loc, via, depth + 1);
      if (exit) return exit;
    } else if (it.exit) return { kind: it.exit.kind, message: it.exit.text, src: loc(p, 'implementations', idx) };
  }
  return;
}

// ---------------------------------------------------------------- stops, jumps, skips

export interface StopPoint {
  /** index into the combined list (sequence then finish) */
  index: number;
  /** inspection state id, or the button id */
  key: string;
  /** for a button stop: its index in the step's buttons */
  buttonIndex?: number;
  label: string;
  kind: ExitKind;
  message: string;
  showHowFrom?: string;
}

/** The whole list the user walks: sequence, then finish. */
export function combined<S>(run: TutorialRun<S>): PathItem<S>[] {
  return [...run.sequence, ...run.finish];
}

/** Every exit a path can take, at the inspection state or button that leads to it. */
export function stopPoints<S>(run: TutorialRun<S>): StopPoint[] {
  const out: StopPoint[] = [];
  combined(run).forEach((item, index) => {
    if (item.kind === 'inspect') {
      for (const st of item.def.states) {
        const o = item.outcomes?.[st.id];
        if (o && typeof o === 'object' && o.exit) {
          out.push({ index, key: st.id, label: st.label, kind: o.exit.kind, message: o.exit.text, showHowFrom: o.exit.show_how_from });
        }
      }
    } else {
      item.buttons.forEach((b) => {
        const buttonIndex = (item.def.buttons ?? []).indexOf(b);
        if (b.exit) out.push({ index, key: b.id, buttonIndex, label: b.label, kind: b.exit.kind, message: b.exit.text, showHowFrom: b.exit.show_how_from });
      });
    }
  });
  return out;
}

/** Index of the jump target: the first item after `from` in the sequence that is the step or comes from the procedure. */
export function findJumpTarget<S>(run: TutorialRun<S>, from: number, target: string): number | undefined {
  const all = combined(run);
  for (let i = from + 1; i < run.sequence.length; i++) {
    const it = all[i];
    if (it.id === target || it.via === target || posify(it.id) === target || (it.via && posify(it.via) === target)) return i;
  }
  return undefined;
}

/**
 * Indexes of the later items that a button with `skips` leaves out: items after `index`,
 * in the same list (sequence or finish), whose id the button names.
 */
export function skippedBy<S>(all: PathItem<S>[], index: number, button: any): Set<number> {
  const out = new Set<number>();
  if (!button?.skips?.length) return out;
  const list = all[index].list;
  all.forEach((x, i) => {
    if (i > index && x.list === list && button.skips.includes(x.id)) out.add(i);
  });
  return out;
}

// ---------------------------------------------------------------- diagnoses

export interface DiagnosisCheck<S = unknown> {
  id: string;
  def: any;
  /** leads_to per state (null = not a hit) */
  hits: Record<string, { job: string; urgency: string } | null>;
  skipped: boolean;
  src: S;
}

export interface DiagnosisRun<S = unknown> {
  exit?: Exit<S>;
  checks: DiagnosisCheck<S>[];
}

export function resolveDiagnosis<S = unknown>(ix: Index, d: any, r: Reader, params: Record<string, string> = {}, loc: Locate<S> = noLocation): DiagnosisRun<S> {
  const outside = d.covers_like ? coverageExit(ix, d.covers_like, r, params, loc) : undefined;
  if (outside) return { checks: [], exit: outside };
  const checks: DiagnosisCheck<S>[] = d.checks.map((ch: any, i: number) => {
    const id = substParams(ch.inspect, params);
    const insp = inspectionDef(ix, id);
    const skipped = !!insp?.applies_when && !evaluate(substCondition(insp.applies_when, params), r.ask);
    const hits: DiagnosisCheck['hits'] = {};
    for (const st of insp?.states ?? []) {
      hits[st.id] = st.leads_to ?? null;
    }
    return { id, def: insp, hits, skipped, src: loc(d, 'checks', i) };
  });
  return { checks };
}
