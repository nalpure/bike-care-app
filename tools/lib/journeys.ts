// Profile journeys: what one test bike's owner sees from the first tap to the end.
// Strict: every question, inspection and safety check the journey reaches must be answered
// in the profile, or the check fails. Profiles are for reviewers only; the app never reads them.

import type { Content, Entry, TutorialEntry } from './content.js';
import { evaluate, substCondition, substParams, UNKNOWN, type Value } from './conditions.js';
import {
  combined, factsAhead, findJumpTarget, NeedKey, nextQuestion, readRoutine, resolveDiagnosis, resolveTutorial, type DiagnosisCheck, type Reader,
} from './expand.js';
import { tutorialTimeRange } from './flows.js';
import { neverAsked } from './refs.js';
import type { Issues } from './issues.js';
import {
  choiceBlock, exitScreen, factLine, NOTICE, priceText, questionLine, renderCard, renderDiagnosisCheck, renderJobScreen, toolName,
  toolSummary, toolTiers, type Known,
} from './render.js';
import { lineAt } from './yamlfile.js';

export interface JourneyResult {
  profile: string;
  journey: string;
  title: string;
  ending: string;
  minutes: number;
  questions: number;
  /** this journey on its own, for its review hash */
  markdown: string;
}

interface Finding {
  inspection: string;
  state: string;
  label: string;
  meaning: string;
}

class Run {
  known = new Map<string, Value>();
  asked: Array<{ stage: string; key: string; value: Value }> = [];
  minutes = 0;
  L: string[] = [];
  usedSees = new Set<string>();
  usedTutorialSees = new Set<string>();
  findings: Finding[] = [];
  /** every inspection answered in this session (inspection id -> state), so no check is done twice */
  session = new Map<string, string>();
  failed = false;

  constructor(
    private c: Content,
    public p: Entry,
    public j: any,
    public ji: number,
    private issues: Issues,
  ) {
    for (const [k, v] of Object.entries<Value>(p.def.facts ?? {})) this.known.set(k, v);
  }

  error(rule: string, msg: string, ...path: (string | number)[]) {
    this.failed = true;
    const full = [...this.p.path, 'journeys', this.ji, ...path];
    this.issues.error(this.p.file.rel, `profile ${this.p.def.id} / journey ${this.j.id}`, rule, msg, lineAt(this.p.file, full));
  }

  knownFn: Known = (k) => {
    const v = this.known.get(k);
    return v === undefined || v === UNKNOWN ? undefined : v;
  };

  private choiceValue(key: string): Value {
    const id = key.slice(7);
    const v = this.j.choices?.[id];
    if (v === undefined) {
      this.error('profile-missing-choice', `The journey reaches the run choice "${id}", but the journey has no choices.${id}.`, 'choices');
      return this.c.choices.get(id)?.def.options[0]?.id ?? UNKNOWN;
    }
    return v;
  }

  private toolValue(key: string): Value {
    const tool = key.slice(5);
    if ((this.p.def.tools ?? []).includes(tool)) return true;
    for (const [ch, opt] of Object.entries<any>(this.j.choices ?? {})) {
      const o = this.c.choices.get(ch)?.def.options.find((x: any) => x.id === opt);
      if (o?.requires_tools?.includes(tool)) return true;
    }
    return false;
  }

  reader(stage: string): Reader {
    const ask = (key: string): Value => {
      if (key.startsWith('choice.')) return this.choiceValue(key);
      if (key.startsWith('tool.')) return this.toolValue(key);
      if (this.known.has(key)) return this.known.get(key)!;
      if (neverAsked(this.c, key)) return UNKNOWN;
      const answers = this.p.def.answers ?? {};
      if (key in answers) {
        this.known.set(key, answers[key]);
        this.asked.push({ stage, key, value: answers[key] });
        return answers[key];
      }
      this.error('profile-missing-answer', `The journey asks "${key}", but the profile has neither a fact nor an answer for it. Add it to answers (use unknown for "I'll check later").`, 'start');
      this.known.set(key, UNKNOWN);
      this.asked.push({ stage, key, value: UNKNOWN });
      return UNKNOWN;
    };
    const look = (key: string): Value => {
      if (key.startsWith('choice.')) return this.choiceValue(key);
      if (key.startsWith('tool.')) return this.toolValue(key);
      return this.known.get(key) ?? UNKNOWN;
    };
    return { ask, branch: look, peek: look };
  }

  /**
   * The facts phase (owner, 2026-11-27): asks, in the author's order (the flow's questions), every fact a path
   * still ahead reads. Ahead means over every value of what is not known yet, choices and tools included, as
   * the app sees it before its choices; the profile's own choices are not used here.
   */
  factsPhase(stage: string, order: string[] | undefined, resolve: (r: Reader) => unknown, params: Record<string, string> = {}): void {
    const look = (assumed: Record<string, Value>): Reader => {
      const ask = (key: string): Value => {
        if (key in assumed) return assumed[key];
        if (key.startsWith('choice.') || key.startsWith('tool.')) throw new NeedKey(key);
        if (this.known.has(key)) return this.known.get(key)!;
        if (neverAsked(this.c, key)) return UNKNOWN;
        throw new NeedKey(key);
      };
      const peek = (key: string): Value => (key in assumed ? assumed[key] : this.known.get(key) ?? UNKNOWN);
      return { ask, branch: peek, peek };
    };
    const reader = this.reader(stage);
    for (let key = nextQuestion(order, factsAhead(this.c, resolve, look), params); key; key = nextQuestion(order, factsAhead(this.c, resolve, look), params)) {
      reader.ask(key);
    }
  }

  questions(stage: string): string[] {
    const qs = this.asked.filter((a) => a.stage === stage);
    if (!qs.length) return [];
    return [...qs.map((a, i) => `${i + 1}. ${questionLine(this.c, a.key, a.value)}`), ''];
  }
}

function bikeTable(c: Content, p: any): string[] {
  const facts = Object.entries<Value>(p.facts ?? {}).map(([k, v]) => factLine(c, k, v)).join('<br>') || 'nothing known';
  const answers = Object.entries<Value>(p.answers ?? {}).map(([k, v]) => factLine(c, k, v)).join('<br>') || 'none';
  const tools = (p.tools ?? []).map((t: string) => toolName(c, t)).join('<br>') || 'none';
  return ['| | |', '| --- | --- |', `| Known before the first flow | ${facts} |`, `| Answers when asked | ${answers} |`, `| Tools with them | ${tools} |`, ''];
}

function shopSummary(c: Content, r: Run, jobId: string, extra: string[] = []): string[] {
  const job = c.jobs.get(jobId)?.def;
  const bike = [...r.known.entries()].filter(([, v]) => v !== UNKNOWN).map(([k, v]) => factLine(c, k, v)).join('; ') || 'nothing known';
  return [
    '**Shop summary** (to show or tell the mechanic):',
    '',
    `- Bike: ${r.p.def.name}. ${bike}`,
    `- Job: ${job?.title ?? jobId}`,
    `- Tell the mechanic: "${job?.shop.tell ?? ''}"`,
    ...r.findings.map((f) => `- Found: ${f.label} (\`${f.inspection}\`: ${f.state})`),
    ...extra,
    `- Price: ${priceText(job)}`,
    '',
  ];
}

function notCovered(message: string): string[] {
  return [`**Not covered yet:** ${message}`, '', 'Buttons: [Find a shop] [Ask the assistant]', ''];
}

// ---------------------------------------------------------------- diagnosis

function runDiagnosis(c: Content, r: Run, d: Entry): { job?: string; urgency?: string; ending?: string; remaining: DiagnosisCheck[] } {
  r.factsPhase('diagnosis', d.def.questions, (x) => resolveDiagnosis(c, d, x, r.j.params ?? {}), r.j.params ?? {});
  const run = resolveDiagnosis(c, d, r.reader('diagnosis'), r.j.params ?? {});
  r.L.push(`### Symptom: "${d.def.symptom}"`, '');
  const qs = r.questions('diagnosis');
  r.L.push(qs.length ? 'Questions the app asks first:' : 'No questions: the app already knows what it needs.', '', ...qs);
  if (run.exit) {
    r.L.push(...notCovered(run.exit.message));
    return { ending: `not covered (${d.def.id})`, remaining: [] };
  }
  r.L.push('#### Checks', '');
  let n = 1;
  for (let i = 0; i < run.checks.length; i++) {
    const ch = run.checks[i];
    if (ch.skipped) continue;
    const state = r.j.sees?.[ch.id];
    r.usedSees.add(ch.id);
    if (state === undefined) {
      r.error('profile-missing-sees', `The diagnosis reaches inspection "${ch.id}", but the journey has no sees.${ch.id}.`, 'sees');
      return { ending: 'incomplete profile', remaining: [] };
    }
    r.L.push(...renderDiagnosisCheck(c, ch, n++, state, r.knownFn, false, 'diagnosis', 5));
    r.minutes += ch.def.minutes;
    r.session.set(ch.id, state);
    const hit = ch.hits[state];
    if (hit) {
      const st = ch.def.states.find((s: any) => s.id === state);
      r.findings.push({ inspection: ch.id, state, label: st.label, meaning: st.meaning });
      r.L.push(`Finding stored on the bike: \`${ch.id}\` = ${state}.`, '');
      return { job: hit.job, urgency: hit.urgency, remaining: run.checks.slice(i + 1).filter((x) => !x.skipped) };
    }
  }
  r.L.push('No check found a cause.', '');
  return { job: d.def.no_hit.job, remaining: [] };
}

// ---------------------------------------------------------------- tutorial

function runTutorial(c: Content, r: Run, t: TutorialEntry): string {
  const params = r.j.params ?? {};
  r.factsPhase('tutorial', t.def.questions, (x) => resolveTutorial(c, t, x, params), params);
  const run = resolveTutorial(c, t, r.reader('tutorial'), params);
  const def = t.def;
  r.L.push(`### Tutorial: ${c.jobs.get(def.job)?.def.title ?? def.id}`, '');
  r.L.push('#### Before you start', '');
  const qs = r.questions('tutorial');
  r.L.push(qs.length ? 'Questions:' : 'No questions: everything needed is already known.', '', ...qs);
  if (run.exit) {
    if (run.exit.kind === 'not_covered' || run.exit.kind === 'uncovered') {
      r.L.push(...notCovered(run.exit.message));
      return 'not covered';
    }
    r.L.push(...exitScreen(run.exit.kind, run.exit.message, false));
    if (run.exit.kind === 'shop_only') r.L.push(...shopSummary(c, r, def.job));
    return `${run.exit.kind} before the first step`;
  }
  for (const ch of def.choices ?? []) r.L.push(...choiceBlock(c, ch, r.j.choices?.[ch]));
  const all = combined(run);
  const tools = toolSummary(c, all);
  const has = (t: string) => (r.p.def.tools ?? []).includes(t);
  r.L.push(`Tools picker. ${toolTiers(c, tools, (x) => (has(x) ? ' ✓' : ''))}. (✓ = the owner has it)`, '');
  const time = tutorialTimeRange(c, t, Object.fromEntries(r.known), params);
  r.L.push(`Time shown for this bike: ${time ?? '?'} (depends on how the bike is held).`, '');

  r.L.push('#### Steps', '');
  const startMinutes = r.minutes;
  let stopFound = '';
  const state = new Set<string>();
  const sees = r.j.tutorial_sees ?? {};
  let jumped = false;
  let finishShown = false;
  let n = 1;
  const skipIds = new Map<string, string>();
  // Before the first step, an inspection answered earlier in this session is not shown again.
  // After work has started it is a re-check of the result and is always shown.
  let workStarted = false;
  for (let i = 0; i < all.length; i++) {
    const it = all[i];
    if (it.list === 'finish') {
      if (jumped) break;
      if (!finishShown) r.L.push('##### Finish', '');
      finishShown = true;
    }
    if (skipIds.has(it.id)) {
      r.L.push(`##### – ${it.def.title} · \`${it.id}\` · skipped: the owner answered "${skipIds.get(it.id)}" earlier`, '');
      continue;
    }
    const before = new Set(state);
    if (it.kind === 'step') {
      workStarted = true;
      for (const l of it.def.clears ?? []) state.delete(substParams(l, params));
      for (const l of it.def.sets ?? []) state.add(substParams(l, params));
    }
    // What does the owner tap here?
    let chosen: string | undefined;
    let repeat = false;
    let outcome: { kind: 'continue' | 'block' | 'exit'; exitKind?: string; message?: string; showHowFrom?: string; good?: string } = { kind: 'continue' };
    if (it.kind === 'inspect') {
      repeat = !workStarted && r.session.has(it.id);
      chosen = repeat ? r.session.get(it.id) : sees[it.id];
      if (!repeat && chosen !== undefined) r.usedTutorialSees.add(it.id);
      // In a tutorial, Next takes the inspection's default state.
      if (chosen === undefined && it.def.default !== undefined) chosen = it.def.default;
      if (chosen === undefined) {
        r.error('profile-missing-sees', `The tutorial reaches inspection "${it.id}", but the journey has no tutorial_sees.${it.id}.`, 'tutorial_sees');
        return 'incomplete profile';
      }
      const o = it.outcomes?.[chosen];
      if (o && typeof o === 'object') {
        if (o.block) outcome = { kind: 'block', message: o.block, good: it.def.default !== undefined ? undefined : it.def.states.find((s: any) => it.outcomes?.[s.id] === 'continue')?.label };
        if (o.exit) outcome = { kind: 'exit', exitKind: o.exit.kind, message: o.exit.text, showHowFrom: o.exit.show_how_from };
      }
    } else if (it.buttons.length) {
      // With a question, Next without an answer means the goal is met.
      const decisive = !it.def.question && it.buttons.some((b: any) => b.block || b.exit);
      chosen = sees[it.id];
      if (chosen !== undefined) r.usedTutorialSees.add(it.id);
      if (decisive && chosen === undefined) {
        r.error('profile-missing-sees', `The tutorial reaches step "${it.id}", which can block or exit, but the journey has no tutorial_sees.${it.id} (the id of the button the owner taps).`, 'tutorial_sees');
        return 'incomplete profile';
      }
      const b = it.buttons.find((x: any) => x.id === chosen);
      if (chosen !== undefined && !b) {
        r.error('unknown-button', `Step ${it.id} shows no button with id "${chosen}" on this path.`, 'tutorial_sees', it.id);
        return 'incomplete profile';
      }
      if (b?.block) outcome = { kind: 'block', message: b.block, good: it.def.question ? undefined : it.buttons.find((x: any) => !x.block && !x.exit)?.label };
      if (b?.exit) outcome = { kind: 'exit', exitKind: b.exit.kind, message: b.exit.text, showHowFrom: b.exit.show_how_from };
      for (const s of b?.skips ?? []) skipIds.set(s, b.label);
    }
    if (repeat) {
      const label = it.def.states.find((s: any) => s.id === chosen)?.label ?? chosen;
      r.L.push(`##### – ${it.def.title} · \`${it.id}\` · not shown again: answered earlier in this session ("${label}")`, '');
    } else {
      r.L.push(...renderCard(c, it, { number: n++, known: r.knownFn, chosen, before, after: new Set(state), level: 5, onPath: true }));
      r.minutes += it.def.minutes;
      // A tutorial learns no facts about the bike (owner, 2026-11-27): an answer is kept for this session only.
      if (it.kind === 'inspect' && chosen !== undefined) r.session.set(it.id, chosen);
    }

    if (outcome.kind === 'block') {
      if (outcome.good === undefined) {
        // Next means it is fixed now: for the session the inspection is in its default state.
        if (it.kind === 'inspect') r.session.set(it.id, it.def.default);
        r.L.push('The owner fixes it and taps Next (Next is never locked on a card with a question).', '');
      }
      else r.L.push(`Next stays disabled. After the fix, the owner taps "${outcome.good}" and goes on.`, '');
      continue;
    }
    if (outcome.kind === 'exit') {
      const apart = [...state];
      const canJump = apart.length > 0 && !!outcome.showHowFrom;
      const label = it.kind === 'inspect' ? it.def.states.find((s: any) => s.id === chosen)?.label : it.buttons.find((x: any) => x.id === chosen)?.label;
      r.L.push(...exitScreen(outcome.exitKind!, outcome.message!, canJump));
      if (!canJump && outcome.exitKind === 'not_needed' && !apart.length) {
        r.L.push('The repair is not needed. Nothing is left apart.', '');
        return `not needed at ${it.id}`;
      }
      if (!canJump) {
        r.L.push(...shopSummary(c, r, def.job, [`- Stopped at: \`${it.id}\`, "${chosen}"`, ...(apart.length ? [`- **Still set: ${apart.join(', ')}**`] : [])]));
        return `exit (${outcome.exitKind}) at ${it.id}`;
      }
      const choice = r.j.after_stop;
      if (!choice) {
        r.error('profile-missing-after-stop', `The journey reaches a stop with a jump button at "${it.id}", but has no after_stop (show_how or find_shop).`, 'after_stop');
        return 'incomplete profile';
      }
      if (choice === 'find_shop') {
        r.L.push('The owner taps "Find a shop".', '', ...shopSummary(c, r, def.job, [`- Stopped at: \`${it.id}\`, "${chosen}"`, `- **Still set: ${apart.join(', ')}**`]));
        return `stop at ${it.id}, left with ${apart.join(', ')}`;
      }
      const j = findJumpTarget(run, i, outcome.showHowFrom!);
      if (j === undefined) {
        r.L.push('**The jump target is missing.** (The check reports this as an error.)', '');
        return 'broken jump';
      }
      r.L.push(`The owner taps "Show me how to put it back". **Jumped ahead** in the same tutorial to \`${all[j].id}\`; ${j - i - 1} step(s) skipped. The progress bar moves forward once.`, '');
      stopFound = `- Found during the tutorial: "${label}" (\`${it.id}\`)`;
      jumped = true;
      i = j - 1;
      continue;
    }
  }
  const tutorialTime = `Tutorial time: ${r.minutes - startMinutes} min.`;
  if (jumped) {
    r.L.push('#### End', '', ...shopSummary(c, r, def.job, [stopFound, `- Already done: tutorial \`${def.id}\` up to the stop; the bike is back on its wheels`]), tutorialTime, '');
    return state.size ? `jump ahead, but ${[...state].join(', ')} still set` : 'stop, jump ahead, bike put back, shop';
  }
  r.L.push('#### End', '', `Done. Nothing is left apart.${state.size ? ` **Still set: ${[...state].join(', ')}**` : ''} ${tutorialTime}`, '');
  return 'tutorial complete';
}

// ---------------------------------------------------------------- routine check

function runRoutine(c: Content, r: Run, id: string): string {
  const ch = c.checks.get(id)!.def;
  r.factsPhase('check', ch.questions, (x) => readRoutine(c, c.checks.get(id)!, x));
  const reader = r.reader('check');
  r.L.push(`### ${ch.title}`, '');
  const qs = r.questions('check');
  if (qs.length) r.L.push('Questions the app asks first:', '', ...qs);
  const todo: string[] = [];
  let n = 1;
  for (const item of ch.inspections) {
    const insp = c.inspections.get(item.inspect)!;
    for (const pos of item.pos ?? [null]) {
      const key = pos ? `${item.inspect}.${pos}` : item.inspect;
      const params: Record<string, string> = pos ? { pos } : {};
      if (insp.def.applies_when) {
        if (!evaluate(substCondition(insp.def.applies_when, params), reader.ask)) {
          r.L.push(`### – \`${key}\` · skipped (does not apply to this bike)`, '');
          continue;
        }
      }
      const state = r.j.sees?.[key];
      r.usedSees.add(key);
      if (state === undefined) {
        r.error('profile-missing-sees', `The routine check reaches "${key}", but the journey has no sees.${key}.`, 'sees');
        return 'incomplete profile';
      }
      const hits: DiagnosisCheck['hits'] = {};
      for (const st of insp.def.states) hits[st.id] = st.leads_to ?? null;
      r.L.push(...renderDiagnosisCheck(c, { id: key, def: insp.def, hits, skipped: false, src: { file: insp.file, path: insp.path } }, n++, state, r.knownFn, false, 'check', 5));
      r.minutes += insp.def.minutes;
      if (!pos) r.session.set(key, state);
      const st = insp.def.states.find((s: any) => s.id === state);
      if (st?.leads_to) {
        const job = c.jobs.get(st.leads_to.job)?.def;
        todo.push(`- [ ] ${job?.title ?? st.leads_to.job} (${st.leads_to.urgency}) · from \`${key}\` = ${state} · opens ${job?.tutorial ? `tutorial \`${job.tutorial}\`` : 'the job screen (shop only, no guide yet)'}`);
      }
    }
  }
  r.L.push('#### To-do list on the bike', '', ...(todo.length ? todo : ['Nothing to do.']), '');
  return todo.length ? `${todo.length} to-do item(s)` : 'no to-do items';
}

// ---------------------------------------------------------------- entry

export function runProfile(c: Content, p: Entry, issues: Issues): { markdown: string; results: JourneyResult[] } {
  const prof = p.def;
  const L: string[] = [`# Profile: ${prof.name}`, '', `> ${NOTICE}`, ''];
  if (prof.description) L.push(prof.description, '');
  L.push(...bikeTable(c, prof));
  const results: JourneyResult[] = [];
  prof.journeys.forEach((j: any, ji: number) => {
    const r = new Run(c, p, j, ji, issues);
    r.L.push(`## Journey ${ji + 1}: ${j.title}`, '', `<sub>journey id \`${j.id}\`</sub>`, '');
    let ending = '';
    if (j.start.diagnosis) {
      const d = c.diagnoses.get(j.start.diagnosis)!;
      const res = runDiagnosis(c, r, d);
      if (res.ending) ending = res.ending;
      else if (res.job) {
        const job = c.jobs.get(res.job)?.def;
        const t = job?.tutorial ? c.tutorials.get(job.tutorial) : undefined;
        r.L.push(...renderJobScreen(c, res.job, res.urgency, t ? tutorialTimeRange(c, t, Object.fromEntries(r.known), j.params ?? {}) : null, 3));
        let choice = j.job_choice;
        if (!t) {
          if (choice === 'diy') r.error('profile-job-choice', `Job ${res.job} has no tutorial, so the owner can only choose the shop.`, 'job_choice');
          choice = 'shop';
        } else if (!choice) {
          r.error('profile-missing-job-choice', `The journey reaches the job screen for ${res.job}, but has no job_choice (diy or shop).`, 'job_choice');
          choice = 'shop';
        }
        r.L.push(`The owner chooses: **${choice === 'diy' ? 'Do it myself' : 'Take it to a shop'}**.`, '');
        if (choice === 'shop' || !t) {
          r.L.push(...shopSummary(c, r, res.job));
          ending = `shop: ${job?.title ?? res.job}`;
          if (res.remaining.length && res.urgency !== 'do_not_ride') {
            r.L.push(`Afterwards, "Did it fix it?" If not, the diagnosis continues with ${res.remaining.map((x) => `\`${x.id}\``).join(', ')}.`, '');
          }
        } else {
          ending = runTutorial(c, r, t);
          if (ending === 'tutorial complete' && res.remaining.length) {
            r.L.push(`"Did it fix it?" If not, the diagnosis continues with ${res.remaining.map((x) => `\`${x.id}\``).join(', ')}.`, '');
          }
        }
      }
    } else if (j.start.tutorial) {
      ending = runTutorial(c, r, c.tutorials.get(j.start.tutorial)!);
    } else if (j.start.check) {
      ending = runRoutine(c, r, j.start.check);
    }
    for (const k of Object.keys(j.sees ?? {})) if (!r.usedSees.has(k)) issues.warn(p.file.rel, `profile ${prof.id} / journey ${j.id}`, 'profile-unused-entry', `sees.${k} is never reached on this journey.`, lineAt(p.file, [...p.path, 'journeys', ji, 'sees', k]));
    for (const k of Object.keys(j.tutorial_sees ?? {})) if (!r.usedTutorialSees.has(k)) issues.warn(p.file.rel, `profile ${prof.id} / journey ${j.id}`, 'profile-unused-entry', `tutorial_sees.${k} is never reached on this journey.`, lineAt(p.file, [...p.path, 'journeys', ji, 'tutorial_sees', k]));
    r.L.push(`**Journey ends:** ${ending}. **Time:** ${r.minutes} min. **Questions asked:** ${r.asked.length}.`, '', '---', '');
    L.push(...r.L);
    results.push({ profile: prof.id, journey: j.id, title: j.title, ending, minutes: r.minutes, questions: r.asked.length, markdown: r.L.join('\n') });
  });
  return { markdown: L.join('\n'), results };
}
