// Turns a tutorial or diagnosis into concrete runs, one per combination of the keys it reads.
//
// The resolving itself (case selection, procedure implementations, conditional steps, button sets,
// exits, jump targets, skips) and the enumeration of combinations live in resolve.ts, which the player imports too. This file adds what
// only the build needs:
//  - path variants (stops, jumps, skips) and path ids;
//  - wrappers that run the shared resolver on this content's bundle data, with YAML source locations.

import type { Content, Entry, TutorialEntry } from './content.js';
import { UNKNOWN, type Value } from './conditions.js';
import { bundleOf } from './bundle.js';
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

export { NeedKey, type Enumerated } from './resolve.js';

export function enumerate<T>(c: Content, resolve: (r: R.Reader) => T, fixed: Record<string, Value> = {}): R.Enumerated<T>[] {
  return R.enumerate(bundleOf(c).index, resolve, fixed);
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
  /**
   * For each item, whether this path leaves it out: a follow-up inspection whose state was not
   * tapped. Hidden items stay in `items` so indexes match the combined list; they are not shown.
   */
  hidden: boolean[];
  /** a path through a follow-up: the inspection at `index` was answered with `state` */
  follow?: { index: number; state: string; label: string };
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
  // Follow-ups are hidden unless the path goes through them (`through`: index of that follow-up).
  const hide = (items: PathItem[], through?: number) => items.map((x) => !!x.after && x !== all[through ?? -1]);
  const parentOf = (i: number): number => {
    let p = i - 1;
    while (p >= 0 && !(all[p].kind === 'inspect' && all[p].id === all[i].after!.id)) p--;
    return p;
  };
  const followOf = (i: number): Variant['follow'] => {
    const p = parentOf(i);
    const state = all[i].after!.state;
    return { index: p, state, label: all[p]?.def.states.find((s: any) => s.id === state)?.label ?? state };
  };
  const complete: Variant = { id: baseId, ending: 'complete', items: all, afterJump: all.map(() => false), hidden: hide(all) };
  const out: Variant[] = [complete];
  all.forEach((item, index) => {
    // A complete path through a follow-up, when one of its states goes on.
    if (item.after && Object.values(item.outcomes ?? {}).some((o: any) => o === 'continue')) {
      out.push({ id: `${baseId}--${item.after.id}-${item.after.state}`, ending: 'complete', items: all, afterJump: all.map(() => false), hidden: hide(all, index), follow: followOf(index) });
    }
    for (const b of item.buttons) {
      if (!b.skips?.length) continue;
      const skipped = R.skippedBy(all, index, b);
      // A shared step may name targets that this case does not have; then the skip changes nothing here.
      if (!skipped.size) continue;
      const items = all.filter((_x, i) => !skipped.has(i));
      out.push({ id: `${baseId}--skip-${item.id}-${b.id}`, ending: 'complete', items, afterJump: items.map(() => false), hidden: hide(items), skip: { index, buttonId: b.id, label: b.label, ids: b.skips } });
    }
  });
  for (const sp of R.stopPoints(run)) {
    const sid = `${baseId}--${sp.kind.replace(/_/g, '-')}-${all[sp.index].id}-${sp.key}`;
    const upTo = all.slice(0, sp.index + 1);
    const through = all[sp.index].after ? sp.index : undefined;
    const follow = through !== undefined ? followOf(through) : undefined;
    const stopV: Variant = { id: sid, ending: 'stop', stop: sp, items: upTo, afterJump: upTo.map(() => false), hidden: hide(upTo, through), follow };
    out.push(stopV);
    const state = stateAt(complete, sp.index);
    if (sp.showHowFrom && state.size) {
      const j = R.findJumpTarget(run, sp.index, sp.showHowFrom);
      if (j !== undefined) {
        const tail = all.slice(j, run.sequence.length);
        const items = [...upTo, ...tail];
        out.push({ id: `${sid}--jump`, ending: 'jump', stop: sp, jumpIndex: j, items, afterJump: [...upTo.map(() => false), ...tail.map(() => true)], hidden: hide(items, through), follow });
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
