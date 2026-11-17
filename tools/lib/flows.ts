// Expands every tutorial and diagnosis, simulates each path with the state labels,
// enforces the rules from approach.md "Build tool" and checks coverage.

import type { Content, Entry, TutorialEntry } from './content.js';
import { substParams, type Value } from './conditions.js';
import {
  combined, comboId, diagnosisPaths, enumerate, paramCombos, resolveDiagnosis, resolveTutorial, variantsOf,
  type DiagnosisPath, type DiagnosisRun, type Exit, type PathItem, type Src, type TutorialRun, type Variant,
} from './expand.js';
import type { Issues } from './issues.js';
import { lineAt } from './yamlfile.js';

export interface Combo {
  params: Record<string, string>;
  assign: Record<string, Value>;
  asked: string[];
  baseId: string;
  /** facts read but never asked (ask: never), with every value that gave this same result */
  silent: string[];
  alt: Record<string, Value[]>;
}

/**
 * Combinations that differ only in facts the app never asks, and give the same result,
 * are one path. Different results get the silent values appended to their id.
 */
class ComboIds {
  private seen = new Map<string, Array<{ sig: string; combo: Combo }>>();

  claim(res: { assign: Record<string, Value>; asked: string[]; read: string[] }, params: Record<string, string>, sig: string, c: Content): Combo | null {
    const prefix = Object.values(params).join('.');
    const key = [prefix, comboId(c, res.asked, res.assign)].filter(Boolean).join('.');
    const silent = res.read.filter((k) => !res.asked.includes(k) && !k.startsWith('choice.') && !k.startsWith('tool.'));
    const list = this.seen.get(key) ?? [];
    const same = list.find((e) => e.sig === sig);
    if (same) {
      for (const k of silent) {
        const vals = (same.combo.alt[k] ??= []);
        if (!vals.includes(res.assign[k])) vals.push(res.assign[k]);
      }
      return null;
    }
    const suffix = silent.map((k) => `${k.split('.').pop()}-${res.assign[k]}`.replace(/_/g, '-')).join('.');
    const baseId = list.length && suffix ? `${key}.${suffix}` : key;
    const combo: Combo = { params, assign: res.assign, asked: res.asked, baseId, silent, alt: Object.fromEntries(silent.map((k) => [k, [res.assign[k]]])) };
    list.push({ sig, combo });
    this.seen.set(key, list);
    return combo;
  }
}

export interface TutorialPath {
  id: string;
  combo: Combo;
  run: TutorialRun;
  variant: Variant;
  /** state labels before each executed item */
  before: Set<string>[];
  final: Set<string>;
  minutes: number;
}

export interface FlowExit {
  combo: Combo;
  exit: Exit;
}

export interface TutorialFlow {
  id: string;
  entry: TutorialEntry;
  paths: TutorialPath[];
  exits: FlowExit[];
}

export interface DiagnosisFlowPath {
  id: string;
  combo: Combo;
  run: DiagnosisRun;
  path: DiagnosisPath;
  minutes: number;
}

export interface DiagnosisFlow {
  id: string;
  entry: Entry;
  paths: DiagnosisFlowPath[];
  exits: FlowExit[];
}

export interface Flows {
  tutorials: TutorialFlow[];
  diagnoses: DiagnosisFlow[];
  /** rule name -> number of violations (0 = passed) */
  rules: Map<string, number>;
}

/** Every rule the simulation enforces, so the report can list passes too. */
export const SIM_RULES: Record<string, string> = {
  'coverage': 'Every combination of the facts a flow reads ends in a path, a shop exit or not_covered.',
  'end-with-state': 'Every path that reaches the end has nothing left apart.',
  'forbidden-while': 'No step runs while a state it forbids holds.',
  'sets-twice': 'A step does not set a label that is already set.',
  'clears-unset': 'A step does not clear a label that is not set.',
  'exit-needs-show-how-from': 'Every exit reached with something apart has show_how_from.',
  'show-how-from-not-ahead': 'show_how_from names a step or procedure later in the same sequence.',
  'jump-leaves-state': 'The steps from show_how_from put back everything that is apart.',
  'missing-safety-check': 'Every path, including jump-ahead paths, passes the safety checks for what was opened.',
  'early-stop-misplaced': 'A stop that needs nothing apart sits before the first step that opens something.',
  'exit-in-finish-with-state': 'finish runs only after everything is put back.',
  'check-needs-buttons': 'Every check and safety check on a path shows 2 or 3 buttons.',
  'too-many-buttons': 'At most three buttons or states per screen.',
  'choice-not-declared': 'A tutorial declares every run choice its conditions read.',
  'skip-not-ahead': 'A button skips only steps that come later in the same sequence.',
  'inspection-not-applicable': 'An inspection called on a path applies to that bike.',
  'diagnosis-tutorial-coverage': 'A diagnosis that leads to a job with a tutorial is covered by that tutorial for the same bike.',
};

/** Merges the same problem found on many paths into one issue that names the first path. */
class Aggregator {
  private map = new Map<string, { src: Src; id: string; rule: string; message: string; paths: string[]; severity: 'error' | 'warning' }>();
  constructor(private rules: Map<string, number>) {}

  add(rule: string, src: Src, id: string, message: string, pathId: string, severity: 'error' | 'warning' = 'error'): void {
    const line = lineAt(src.file, src.path);
    const key = `${rule}|${src.file.rel}|${line}|${id}|${message}`;
    const e = this.map.get(key);
    if (e) e.paths.push(pathId);
    else this.map.set(key, { src, id, rule, message, paths: [pathId], severity });
  }

  flush(issues: Issues): void {
    for (const e of this.map.values()) {
      const more = e.paths.length > 1 ? ` and ${e.paths.length - 1} more` : '';
      const msg = `${e.message} (path ${e.paths[0]}${more})`;
      const line = lineAt(e.src.file, e.src.path);
      if (e.severity === 'warning') {
        issues.warn(e.src.file.rel, e.id, e.rule, msg, line);
        continue;
      }
      this.rules.set(e.rule, (this.rules.get(e.rule) ?? 0) + 1);
      issues.error(e.src.file.rel, e.id, e.rule, msg, line);
    }
  }
}

function sub(src: Src, ...p: (string | number)[]): Src {
  return { file: src.file, path: [...src.path, ...p] };
}

function itemName(it: PathItem): string {
  return it.kind === 'inspect' ? `inspect ${it.id}` : `step ${it.id}`;
}

function minutesOf(items: PathItem[]): number {
  return items.reduce((sum, it) => sum + (it.def.minutes ?? 0), 0);
}

function labelsOf(list: string[] | undefined, params: Record<string, string>): string[] {
  return (list ?? []).map((l) => substParams(l, params));
}

/** Walks a variant and records the labels before each item. */
export function simulateVariant(v: Variant, params: Record<string, string>, onProblem?: (rule: string, it: PathItem, msg: string) => void) {
  const before: Set<string>[] = [];
  const state = new Set<string>();
  for (const it of v.items) {
    before.push(new Set(state));
    if (it.kind !== 'step') continue;
    for (const f of labelsOf(it.def.forbidden_while, params)) {
      if (state.has(f)) onProblem?.('forbidden-while', it, `Step ${it.id} must not run while "${f}" is set.`);
    }
    for (const l of labelsOf(it.def.clears, params)) {
      if (!state.has(l)) onProblem?.('clears-unset', it, `Step ${it.id} clears "${l}", which is not set at this point.`);
      state.delete(l);
    }
    for (const l of labelsOf(it.def.sets, params)) {
      if (state.has(l)) onProblem?.('sets-twice', it, `Step ${it.id} sets "${l}", which is already set.`);
      state.add(l);
    }
  }
  return { before, final: state };
}

function buildTutorialFlow(c: Content, t: TutorialEntry, agg: Aggregator): TutorialFlow {
  const flow: TutorialFlow = { id: t.def.id, entry: t, paths: [], exits: [] };
  const ids = new ComboIds();
  for (const params of paramCombos(t.def.params)) {
    const results = enumerate(c, (r) => resolveTutorial(c, t, r, params));
    for (const res of results) {
      const run = res.result;
      const sig = run.exit ? `exit|${run.exit.kind}|${run.exit.message}` : combined(run).map((i) => `${i.id}${i.generic ? '*' : ''}:${i.buttons.length}`).join(',');
      const combo = ids.claim(res, params, sig, c);
      if (!combo) continue;
      const baseId = combo.baseId;

      for (const k of res.read) {
        if (k.startsWith('choice.') && !(t.def.choices ?? []).includes(k.slice(7))) {
          agg.add('choice-not-declared', { file: t.file, path: ['tutorial'] }, `tutorial ${t.def.id}`, `Conditions read ${k}, but the tutorial does not list "${k.slice(7)}" under choices.`, baseId);
        }
      }
      for (const p of run.problems) agg.add(p.rule, p.src, p.id, p.message, baseId);

      if (run.exit) {
        flow.exits.push({ combo, exit: run.exit });
        if (run.exit.kind === 'uncovered') {
          const facts = [...res.asked, ...combo.silent].map((k) => `${k}=${res.assign[k]}`).join(', ') || 'any bike';
          agg.add('coverage', run.exit.src, `tutorial ${t.def.id}`, `${run.exit.message} No path, shop exit or not_covered for ${facts}. Add a case, or a not_covered entry for it.`, baseId);
        }
        continue;
      }

      const complete = combined(run);
      const sim0 = simulateVariant({ id: baseId, ending: 'complete', items: complete, afterJump: complete.map(() => false) }, params);
      const stateAt = (_v: Variant, index: number) => sim0.before[index];
      for (const v of variantsOf(run, baseId, stateAt)) {
        const sim = simulateVariant(v, params, (rule, it, msg) => agg.add(rule, it.src, `tutorial ${t.def.id} / ${itemName(it)}`, msg, v.id));
        const path: TutorialPath = { id: v.id, combo, run, variant: v, before: sim.before, final: sim.final, minutes: minutesOf(v.items) };
        flow.paths.push(path);
        checkVariant(c, t, path, params, agg);
      }
    }
  }
  return flow;
}

function checkVariant(c: Content, t: TutorialEntry, p: TutorialPath, params: Record<string, string>, agg: Aggregator): void {
  const v = p.variant;
  const tid = `tutorial ${t.def.id}`;
  const fmt = (s: Set<string>) => [...s].join(', ');

  // Buttons per screen on this path
  v.items.forEach((it) => {
    if (it.kind === 'step' && it.def.kind !== 'action') {
      if (it.buttons.length < 2) agg.add('check-needs-buttons', it.defSrc, `${tid} / ${itemName(it)}`, `On this path the ${it.def.kind} shows ${it.buttons.length} button(s); it needs 2 or 3.`, v.id);
      if (it.buttons.length > 3) agg.add('too-many-buttons', it.defSrc, `${tid} / ${itemName(it)}`, `On this path the step shows ${it.buttons.length} buttons; at most 3.`, v.id);
    }
  });

  if (v.ending === 'complete' && !v.skip) {
    // A skip may only reach forward. A target missing from this case is fine; one behind the button is not.
    v.items.forEach((from, index) => {
      for (const b of from.buttons) {
        for (const id of b.skips ?? []) {
          const behind = v.items.some((x, i) => i <= index && x.id === id);
          const elsewhere = v.items.some((x) => x.id === id && x.list !== from.list);
          if (behind || elsewhere) agg.add('skip-not-ahead', from.defSrc, `${tid} / ${itemName(from)}`, `Button "${b.label}" skips ${id}, which comes before it or outside its ${from.list} on this path. Skips only reach forward.`, v.id);
        }
      }
    });
  }

  if (v.ending === 'complete') {
    if (p.final.size) {
      agg.add('end-with-state', v.items[v.items.length - 1]?.src ?? { file: t.file, path: [] }, tid, `The path ends with "${fmt(p.final)}" still set. Add the steps that put it back.`, v.id);
    }
    // hands-off inspections with a stop must come before anything is opened
    v.items.forEach((it, i) => {
      if (it.kind !== 'inspect' || !it.def.hands_off) return;
      const stops = Object.values(it.outcomes ?? {}).some((o: any) => o && typeof o === 'object' && o.exit);
      if (stops && p.before[i].size) {
        agg.add('early-stop-misplaced', it.src, `${tid} / ${itemName(it)}`, `This check needs nothing apart and can stop, but it runs while "${fmt(p.before[i])}" is set. Move it before the first step that opens something.`, v.id);
      }
    });
  }

  if (v.stop) {
    const sp = v.stop;
    const it = v.items[sp.index];
    const state = p.before[sp.index];
    const src = it.kind === 'inspect' ? sub(it.src, 'outcomes', sp.key) : sub(it.defSrc, 'buttons', sp.buttonIndex ?? 0);
    const id = `${tid} / ${itemName(it)}`;
    if (it.list === 'finish' && state.size) {
      agg.add('exit-in-finish-with-state', src, id, `An exit in finish is reached with "${fmt(state)}" set. finish must run after everything is put back.`, v.id);
    }
    if (state.size && !sp.showHowFrom) {
      agg.add('exit-needs-show-how-from', src, id, `This exit (${sp.kind}, "${sp.label}") is reached with "${fmt(state)}" set. Add show_how_from naming the step that starts putting it back, and name what to put back in the message.`, v.id);
    }
    if (v.ending === 'stop' && state.size && sp.showHowFrom) {
      // the jump variant exists only when the target was found; detect a missing target here
      const all = combined(p.run);
      let found = false;
      for (let i = sp.index + 1; i < p.run.sequence.length; i++) {
        const x = all[i];
        if (x.id === sp.showHowFrom || x.via === sp.showHowFrom) found = true;
      }
      if (!found) agg.add('show-how-from-not-ahead', src, id, `show_how_from "${sp.showHowFrom}" is not a step or procedure later in this sequence (finish does not count).`, v.id);
      if (!/\b(back|put|take)\b/i.test(sp.message)) {
        // A cheap reminder only; the author knows what is apart.
        agg.add('exit-names-put-back', src, id, `The message does not say what to put back. It is reached with "${fmt(state)}" set.`, v.id, 'warning');
      }
    }
    if (v.ending === 'jump' && p.final.size) {
      agg.add('jump-leaves-state', src, id, `After the jump to "${sp.showHowFrom}" the path ends with "${fmt(p.final)}" still set. Jump to an earlier step, or add the missing steps.`, v.id);
    }
  }

  // Safety checks after a label was cleared
  const seen = new Set<string>();
  v.items.forEach((it) => {
    if (it.kind === 'step') for (const l of labelsOf(it.def.sets, params)) seen.add(l);
  });
  for (const label of seen) {
    const def = c.states.get(label) ?? c.states.get(label.replace(/\.(front|rear)$/, '.<pos>'));
    const required: string[] = def?.def.safety_checks ?? [];
    if (!required.length) continue;
    let clearedAt = -1;
    v.items.forEach((it, i) => {
      if (it.kind === 'step' && labelsOf(it.def.clears, params).includes(label)) clearedAt = i;
    });
    if (clearedAt < 0) continue; // still set: a stop path without the jump
    for (const chk of required) {
      const ok = v.items.slice(clearedAt + 1).some((it) => it.id === substParams(chk, params));
      if (!ok) agg.add('missing-safety-check', v.items[clearedAt].src, `${tid} / ${itemName(v.items[clearedAt])}`, `"${label}" was set on this path, so it must pass safety check ${chk} after it is put back.`, v.id);
    }
  }
}

function buildDiagnosisFlow(c: Content, d: Entry, agg: Aggregator): DiagnosisFlow {
  const flow: DiagnosisFlow = { id: d.def.id, entry: d, paths: [], exits: [] };
  const ids = new ComboIds();
  for (const params of paramCombos(d.def.params)) {
    const results = enumerate(c, (r) => resolveDiagnosis(c, d, r, params));
    for (const res of results) {
      const run = res.result;
      const sig = run.exit ? `exit|${run.exit.kind}|${run.exit.message}` : run.checks.map((x) => `${x.id}${x.skipped ? '-' : ''}`).join(',');
      const combo = ids.claim(res, params, sig, c);
      if (!combo) continue;
      const baseId = combo.baseId;
      if (run.exit) {
        flow.exits.push({ combo, exit: run.exit });
        if (run.exit.kind === 'uncovered') {
          const facts = [...res.asked, ...combo.silent].map((k) => `${k}=${res.assign[k]}`).join(', ') || 'any bike';
          agg.add('coverage', run.exit.src, `diagnosis ${d.def.id}`, `No path or not_covered entry for ${facts}. Add a not_covered entry for it.`, baseId);
        }
        continue;
      }
      for (const dp of diagnosisPaths(run, baseId, d.def.no_hit.job)) {
        const upto = dp.hitIndex < 0 ? run.checks : run.checks.slice(0, dp.hitIndex + 1);
        const minutes = upto.filter((ch) => !ch.skipped).reduce((s, ch) => s + (ch.def?.minutes ?? 0), 0);
        flow.paths.push({ id: dp.id, combo, run, path: dp, minutes });
        // A hit job with a tutorial: the tutorial must cover this bike.
        const job = c.jobs.get(dp.job);
        const t = job?.def.tutorial ? c.tutorials.get(job.def.tutorial) : undefined;
        if (t) {
          const fixed: Record<string, Value> = {};
          for (const [k, v] of Object.entries(res.assign)) if (!k.startsWith('choice.') && !k.startsWith('tool.')) fixed[k] = v;
          const tres = enumerate(c, (r) => resolveTutorial(c, t, r, params), fixed);
          if (tres.some((x) => x.result.exit && x.result.exit.kind === 'not_covered')) {
            agg.add('diagnosis-tutorial-coverage', run.checks[Math.max(dp.hitIndex, 0)].src, `diagnosis ${d.def.id}`,
              `This hit leads to job ${dp.job}, but tutorial ${t.def.id} says not covered for the same bike. Narrow applies_when or cover the bike in the tutorial.`, dp.id);
          }
        }
      }
    }
  }
  return flow;
}

/** Time range of the complete paths of a tutorial for a bike whose facts are fixed (choices stay open). */
export function tutorialTimeRange(c: Content, t: TutorialEntry, facts: Record<string, Value>, params: Record<string, string> = {}): string | null {
  const fixed: Record<string, Value> = {};
  for (const [k, v] of Object.entries(facts)) if (!k.startsWith('choice.') && !k.startsWith('tool.')) fixed[k] = v;
  const mins = enumerate(c, (r) => resolveTutorial(c, t, r, params), fixed)
    .filter((x) => !x.result.exit)
    .map((x) => minutesOf(combined(x.result)));
  if (!mins.length) return null;
  const lo = Math.min(...mins);
  const hi = Math.max(...mins);
  return lo === hi ? `${lo} min` : `${lo} to ${hi} min`;
}

export function buildFlows(c: Content, issues: Issues): Flows {
  const rules = new Map<string, number>(Object.keys(SIM_RULES).map((r) => [r, 0]));
  const agg = new Aggregator(rules);
  const tutorials = [...c.tutorials.values()].map((t) => buildTutorialFlow(c, t, agg));
  const diagnoses = [...c.diagnoses.values()].map((d) => buildDiagnosisFlow(c, d, agg));
  agg.flush(issues);
  return { tutorials, diagnoses, rules };
}
