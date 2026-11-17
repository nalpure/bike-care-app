// Turns a tutorial or diagnosis into concrete runs, one per combination of the keys it reads.
//
// The resolving itself (case selection, procedure implementations, conditional steps, button sets,
// exits, jump targets, skips) lives in resolve.ts, which the player imports too. This file adds what
// only the build needs:
//  - enumerate(): a Reader that branches on every key it has not seen yet, to find all paths;
//  - path variants (stops, jumps, skips) and path ids;
//  - wrappers that run the shared resolver on this content's bundle data, with YAML source locations.

import type { Content, Entry, TutorialEntry } from './content.js';
import { UNKNOWN, type Value } from './conditions.js';
import { bundleOf } from './bundle.js';
import { factDef, neverAsked } from './refs.js';
import * as R from './resolve.js';
import type { YamlFile, YPath } from './yamlfile.js';

export { combined, findJumpTarget, skippedBy, stopPoints } from './resolve.js';
export type { ExitKind, Reader, StopPoint, ToolList } from './resolve.js';

// ---------------------------------------------------------------- shared shapes with source locations

export interface Src {
  file: YamlFile;
  path: YPath;
}

export type Exit = R.Exit<Src>;
export type Problem = R.Problem<Src>;
export type PathItem = R.PathItem<Src>;
export type TutorialRun = R.TutorialRun<Src>;
export type DiagnosisCheck = R.DiagnosisCheck<Src>;
export type DiagnosisRun = R.DiagnosisRun<Src>;

export function resolveTutorial(c: Content, t: TutorialEntry, r: R.Reader, params: Record<string, string> = {}): TutorialRun {
  const b = bundleOf(c);
  return R.resolveTutorial(b.index, b.index.tutorials.get(t.def.id), r, params, b.locate);
}

export function resolveDiagnosis(c: Content, d: Entry, r: R.Reader, params: Record<string, string> = {}): DiagnosisRun {
  const b = bundleOf(c);
  return R.resolveDiagnosis(b.index, d.def, r, params, b.locate);
}

// ---------------------------------------------------------------- enumeration

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

export function enumerate<T>(c: Content, resolve: (r: R.Reader) => T, fixed: Record<string, Value> = {}): Enumerated<T>[] {
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
      if (isAsk && !asked.includes(key) && !neverAsked(c, key)) asked.push(key);
      return v;
    };
    const reader: R.Reader = {
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

// ---------------------------------------------------------------- tutorial path variants

export interface Variant {
  id: string;
  ending: 'complete' | 'stop' | 'jump';
  stop?: R.StopPoint;
  /** index into the combined list where the jump lands */
  jumpIndex?: number;
  /** executed items in order */
  items: PathItem[];
  /** for each executed item, whether it was reached by the jump */
  afterJump: boolean[];
  /** a complete path where a button skipped later steps */
  skip?: { index: number; buttonId: string; label: string; ids: string[] };
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

export function variantsOf(run: TutorialRun, baseId: string, stateAt: (v: Variant, index: number) => Set<string>): Variant[] {
  const all = R.combined(run);
  const complete: Variant = { id: baseId, ending: 'complete', items: all, afterJump: all.map(() => false) };
  const out: Variant[] = [complete];
  all.forEach((item, index) => {
    for (const b of item.buttons) {
      if (!b.skips?.length) continue;
      const skipped = R.skippedBy(all, index, b);
      // A shared step may name targets that this case does not have; then the skip changes nothing here.
      if (!skipped.size) continue;
      const items = all.filter((_x, i) => !skipped.has(i));
      out.push({ id: `${baseId}--skip-${item.id}-${b.id}`, ending: 'complete', items, afterJump: items.map(() => false), skip: { index, buttonId: b.id, label: b.label, ids: b.skips } });
    }
  });
  for (const sp of R.stopPoints(run)) {
    const sid = `${baseId}--${sp.kind.replace(/_/g, '-')}-${all[sp.index].id}-${sp.key}`;
    const upTo = all.slice(0, sp.index + 1);
    const stopV: Variant = { id: sid, ending: 'stop', stop: sp, items: upTo, afterJump: upTo.map(() => false) };
    out.push(stopV);
    const state = stateAt(complete, sp.index);
    if (sp.showHowFrom && state.size) {
      const j = R.findJumpTarget(run, sp.index, sp.showHowFrom);
      if (j !== undefined) {
        const tail = all.slice(j, run.sequence.length);
        out.push({ id: `${sid}--jump`, ending: 'jump', stop: sp, jumpIndex: j, items: [...upTo, ...tail], afterJump: [...upTo.map(() => false), ...tail.map(() => true)] });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- diagnoses

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
