// Plain Markdown renderings of what the user sees. Reviewers read these, never the YAML.

import type { Content } from './content.js';
import { fillText, UNKNOWN, type Value } from './conditions.js';
import { combined, type DiagnosisCheck, type PathItem } from './expand.js';
import { mergeTools, type ToolList, type ToolSetUse } from './resolve.js';
import { tutorialTimeRange, type Combo, type DiagnosisFlow, type DiagnosisFlowPath, type TutorialFlow, type TutorialPath } from './flows.js';
import { factDef } from './refs.js';

export const NOTICE = 'Test build. The repair steps are unverified drafts and were not checked by a mechanic.';

export type Known = (key: string) => Value | undefined;
export const nothingKnown: Known = () => undefined;

export function fill(text: string | undefined, known: Known): string {
  return fillText(text ?? '', known);
}

export function toolName(c: Content, id: string): string {
  return c.tools.get(id)?.def.name ?? id;
}

/** "drive.gear_type = derailleur" with the answer text when there is one. */
export function factLine(c: Content, key: string, value: Value): string {
  if (key.startsWith('choice.')) {
    const ch = c.choices.get(key.slice(7));
    const opt = ch?.def.options.find((o: any) => o.id === value);
    return `${ch?.def.question ?? key} → ${opt?.label ?? value}`;
  }
  if (key.startsWith('tool.')) return `${toolName(c, key.slice(5))}: ${value ? 'has it' : 'does not have it'}`;
  const f = factDef(c, key);
  const ans = f?.def.answers?.[String(value)]?.en;
  if (String(value) === UNKNOWN) return `\`${key}\` = unknown ("${unknownAnswer(f?.def)}")`;
  return ans ? `\`${key}\` = ${value} ("${ans}")` : `\`${key}\` = ${value}`;
}

/** The unknown answer as the user reads it: the fact's own wording (answers.unknown), else the app's "I'll check later". */
export function unknownAnswer(f: any): string {
  return f?.answers?.unknown?.en ?? "I'll check later";
}

/** A fact asked with the 3D view (any of focus, show, view, animation): asked after the plain questions. */
export function has3d(f: any): boolean {
  return !!f && ['focus', 'show', 'view', 'animation'].some((k) => f[k] !== undefined);
}

export function questionLine(c: Content, key: string, value: Value): string {
  if (key.startsWith('choice.')) return factLine(c, key, value);
  const f = factDef(c, key);
  const q = f?.def.question?.en ?? key;
  const with3d = has3d(f?.def) ? ' <sub>(with the 3D view)</sub>' : '';
  if (String(value) === UNKNOWN) return `"${q}" → ${unknownAnswer(f?.def)}${with3d}`;
  const ans = f?.def.answers?.[String(value)]?.en ?? String(value);
  return `"${q}" → ${ans}${with3d}`;
}

function humanKind(it: PathItem): string {
  if (it.kind === 'inspect') return 'inspection';
  return it.def.kind === 'safety_check' ? 'safety check' : it.def.kind;
}

function sceneLine(def: any): string | null {
  const parts: string[] = [];
  if (def.focus?.length) parts.push(`focus ${def.focus.join(', ')}`);
  if (def.show?.length) parts.push(`show ${def.show.join(', ')}`);
  if (def.view) parts.push(`view ${def.view}`);
  return parts.length ? `<sub>3D: ${parts.join(' · ')}</sub>` : null;
}

function animLine(a: any): string {
  return a.clip ? `"${a.caption}" (clip ${a.clip})` : `"${a.caption}" (${a.target} ${a.motion}${a.direction ? `, ${a.direction}` : ''}${a.amount ? `, ${a.amount}` : ''})`;
}

function detailsLines(def: any, known: Known, showAll: boolean): string[] {
  const out: string[] = [];
  for (const d of def.details ?? []) {
    const all = d.needs.every((k: string) => known(k) !== undefined && known(k) !== UNKNOWN);
    if (all) out.push(`> ${fill(d.text, known)}`);
    else if (showAll) out.push(`> _Only when ${d.needs.join(', ')} is known:_ ${d.text}`);
  }
  return out;
}

export interface CardOptions {
  number: number;
  known: Known;
  /** in path walkthroughs, show details lines that need unknown facts, marked */
  showAllDetails?: boolean;
  /** state id or button label this path takes */
  chosen?: string;
  /** labels set before / after this item, to show changes */
  before?: Set<string>;
  after?: Set<string>;
  /** extra lines under the heading */
  note?: string;
  /** a path or journey: no chosen answer means the user tapped Next (marked) */
  onPath?: boolean;
  /** heading level, default 3 */
  level?: number;
}

/** One card: heading, text, scene, animation, buttons or states. */
export function renderCard(c: Content, it: PathItem, o: CardOptions): string[] {
  const L: string[] = [];
  const via = it.via ? ` · from procedure \`${it.via}\`` : '';
  L.push(`${'#'.repeat(o.level ?? 3)} ${o.number}. ${it.def.title} · \`${it.id}\` · ${humanKind(it)} · ${it.def.minutes} min${via}`);
  L.push('');
  if (o.note) L.push(o.note, '');
  const text = it.generic ? it.def.generic_text : it.def.text;
  L.push(fill(text, o.known));
  const det = detailsLines(it.def, o.known, !!o.showAllDetails);
  if (det.length) L.push('', ...det);
  const scene = sceneLine(it.def);
  if (scene) L.push('', scene);
  if (it.def.animation) L.push('', `Animation: ${animLine(it.def.animation)}`);
  const tools = [...it.tools.required.map((t) => toolName(c, t)), ...it.tools.one_of.map((u) => oneOfText(c, u)), ...it.tools.helpful.map((t) => `${toolName(c, t)} (helpful)`)];
  if (tools.length) L.push('', `Tools: ${tools.join('; ')}`);

  const stateLine = (st: any): string => {
    const outc = it.outcomes?.[st.id];
    let res = '→ continue';
    if (outc && typeof outc === 'object') {
      if (outc.block) res = `→ **BLOCK**: ${fill(outc.block, o.known)}`;
      if (outc.exit) res = `→ ${exitTag(outc.exit.kind)}: ${fill(outc.exit.text, o.known)}${outc.exit.show_how_from ? ` · jump: \`${outc.exit.show_how_from}\`` : ''}`;
    }
    const mark = o.chosen === st.id ? ' ◀ **this path**' : '';
    return `- [ ] **${fill(st.label, o.known)}** — ${fill(st.meaning, o.known)} ${res}${mark}`;
  };
  // Answers are the exception: Next without an answer is the good answer.
  const nextMark = o.onPath && o.chosen === undefined ? ' ◀ **this path**' : '';
  const dflt = it.kind === 'inspect' ? it.def.states.find((s: any) => s.id === it.def.default) : undefined;
  if (it.kind === 'inspect' && dflt && it.outcomes) {
    // A tutorial call: the default state has no button.
    L.push('', `**${fill(it.def.question, o.known)}**`, '');
    for (const st of it.def.states) {
      if (st.id === dflt.id) continue;
      L.push(stateLine(st));
    }
    L.push(`- [ ] **Next** (no answer) — ${fill(dflt.meaning, o.known)} → continue${o.chosen === dflt.id ? ' ◀ **this path**' : nextMark}`);
  } else if (it.kind === 'inspect') {
    L.push('');
    if (dflt) L.push(`<sub>In tutorials: "${fill(it.def.question, o.known)}" above the other states; "${fill(dflt.label, o.known)}" has no button, Next means it.</sub>`, '');
    else if (it.def.question) L.push(`**${fill(it.def.question, o.known)}**${it.outcomes ? ' <sub>A tap on an answer that goes on moves to the next card at once.</sub>' : ''}`, '');
    for (const st of it.def.states) L.push(stateLine(st));
  } else if (it.buttons.length && it.def.question) {
    L.push('', `**${fill(it.def.question, o.known)}**`, '');
    for (const b of it.buttons) {
      const mark = o.chosen === b.id ? ' ◀ **this path**' : '';
      let res = b.text ? fill(b.text, o.known) : '';
      if (b.block) res = `**UNSAFE until fixed**: ${fill(b.block, o.known)} Next means it is fixed now`;
      if (b.exit) res = `${exitTag(b.exit.kind)}: ${fill(b.exit.text, o.known)}${b.exit.show_how_from ? ` · jump: \`${b.exit.show_how_from}\`` : ''}`;
      if (b.text && (b.block || b.exit)) res = `${fill(b.text, o.known)} ${res}`;
      L.push(`- [ ] **${fill(b.label, o.known)}** <sub>\`${b.id}\`</sub> → ${res}${mark}`);
      for (const a of b.solution ?? []) L.push(`  - Plays at once: ${animLine(a)}`);
      if (b.skips?.length) L.push(`  - Skips: ${b.skips.map((s: string) => `\`${s}\``).join(', ')}`);
    }
    L.push(`- [ ] **Next** (no answer) → the goal in the text is met${nextMark}`);
  } else if (it.buttons.length) {
    L.push('');
    for (const b of it.buttons) {
      const mark = o.chosen === b.id ? ' ◀ **this path**' : '';
      let res = b.text ? fill(b.text, o.known) : '';
      if (b.block) res = `**BLOCK** (Next stays disabled): ${fill(b.block, o.known)}`;
      if (b.exit) res = `${exitTag(b.exit.kind)}: ${fill(b.exit.text, o.known)}${b.exit.show_how_from ? ` · jump: \`${b.exit.show_how_from}\`` : ''}`;
      if (b.text && (b.block || b.exit)) res = `${fill(b.text, o.known)} ${res}`;
      L.push(`- [ ] **${fill(b.label, o.known)}** <sub>\`${b.id}\`</sub> → ${res}${mark}`);
      for (const a of b.solution ?? []) L.push(`  - Show solution: ${animLine(a)}`);
      if (b.skips?.length) L.push(`  - Skips: ${b.skips.map((s: string) => `\`${s}\``).join(', ')}`);
    }
  }
  if (o.before && o.after) {
    const added = [...o.after].filter((l) => !o.before!.has(l));
    const removed = [...o.before].filter((l) => !o.after!.has(l));
    if (added.length || removed.length) {
      const parts = [...added.map((l) => `+${l}`), ...removed.map((l) => `−${l}`)];
      L.push('', `<sub>State: ${parts.join(' ')} → now: ${o.after.size ? [...o.after].join(', ') : 'nothing apart'}</sub>`);
    }
  }
  L.push('');
  return L;
}

export function toolSummary(_c: Content, items: PathItem[]): ToolList {
  return mergeTools(items.map((it) => it.tools));
}

/** "Small cross-head screwdriver or Small hex keys (Look at ...)" for a tool set on a path. */
export function oneOfText(c: Content, u: ToolSetUse, mark: (id: string) => string = () => ''): string {
  const names = u.options.map((t) => `${toolName(c, t)}${mark(t)}`).join(' or ');
  if (u.decided) return `${names} (the bike's data says which)`;
  return `${names} (${c.toolSets.get(u.set)?.def.tell_apart ?? ''})`;
}

/** The three tiers as one line: "Needed: ... One of these: ... Helpful: ...". */
export function toolTiers(c: Content, t: ToolList, mark: (id: string) => string = () => '', sep = '. '): string {
  const names = (ids: string[]) => ids.map((x) => `${toolName(c, x)}${mark(x)}`).join('; ') || 'none';
  const parts = [`Needed: ${names(t.required)}`];
  if (t.one_of.length) parts.push(`One of these, depending on your part: ${t.one_of.map((u) => oneOfText(c, u, mark)).join('; ')}`);
  parts.push(`Helpful: ${names(t.helpful)}`);
  return parts.join(sep);
}

export function choiceBlock(c: Content, choiceId: string, chosen: Value | undefined): string[] {
  const ch = c.choices.get(choiceId);
  if (!ch) return [];
  const L = [`**${ch.def.question}**`, ''];
  for (const o of ch.def.options) {
    const flags = [o.recommended ? 'recommended' : '', o.requires_tools?.length ? `needs: ${o.requires_tools.map((t: string) => toolName(c, t)).join(', ')}` : '']
      .filter(Boolean)
      .join('; ');
    const mark = chosen === o.id ? ' ◀ **chosen**' : '';
    L.push(`- ${o.label}${flags ? ` (${flags})` : ''}${mark}`);
    if (o.note) L.push(`  - ${o.note}`);
    if (o.warning) L.push(`  - ⚠ ${o.warning}`);
  }
  L.push('');
  return L;
}

function header(rows: Array<[string, string]>): string[] {
  return ['| | |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|')} |`), ''];
}

export function factsCell(c: Content, combo: Combo): string {
  const facts = combo.asked.filter((k) => !k.startsWith('choice.') && !k.startsWith('tool.'));
  const params = Object.entries(combo.params).map(([k, v]) => `${k} = ${v}`);
  const silent = (combo.silent ?? []).map((k) => {
    const vals = combo.alt?.[k] ?? [combo.assign[k]];
    return `\`${k}\` = ${vals.join(' or ')} (never asked; from the bike's data)`;
  });
  return [...params, ...facts.map((k) => factLine(c, k, combo.assign[k])), ...silent].join('<br>') || 'any bike';
}

function choicesCell(c: Content, combo: Combo): string {
  const ch = combo.asked.filter((k) => k.startsWith('choice.') || k.startsWith('tool.'));
  return ch.map((k) => factLine(c, k, combo.assign[k])).join('<br>') || 'none';
}

// ---------------------------------------------------------------- tutorial paths

const EXIT_TAGS: Record<string, string> = {
  unsafe: '**EXIT, unsafe**',
  not_covered: '**EXIT, not covered**',
  not_needed: '**EXIT, not needed**',
  shop_only: '**EXIT, shop only**',
};

export function exitTag(kind: string): string {
  return EXIT_TAGS[kind] ?? `**EXIT, ${kind}**`;
}

/** The exit screen the player shows: title, message and buttons, by kind. */
export function exitScreen(kind: string, message: string, canJump: boolean): string[] {
  const titles: Record<string, string> = {
    unsafe: 'Stop screen (unsafe)',
    not_covered: 'Not covered yet',
    not_needed: 'Not needed',
    shop_only: 'Shop only',
  };
  const buttons: Record<string, string[]> = {
    unsafe: ['Find a shop'],
    not_covered: ['Find a shop', 'Ask the assistant'],
    not_needed: ['Done'],
    shop_only: ['Find a shop'],
  };
  const b = [...(canJump ? ['Show me how to put it back'] : []), ...(buttons[kind] ?? ['Find a shop'])];
  return [`**${titles[kind] ?? kind}** (the progress bar does not move): "${message}"`, '', `Buttons: ${b.map((x) => `[${x}]`).join(' ')}`, ''];
}

export function endingText(p: TutorialPath, all: PathItem[]): string {
  const v = p.variant;
  if (v.ending === 'complete' && v.skip) return `Complete; "${v.skip.label}" at \`${all[v.skip.index].id}\` skips ${v.skip.ids.map((s) => `\`${s}\``).join(', ')}`;
  if (v.ending === 'complete') return 'Complete: all steps and the finish';
  const sp = v.stop!;
  const n = sp.index + 1;
  const at = `exit (${sp.kind}) at step ${n} (\`${all[sp.index].id}\`: "${sp.label}")`;
  if (v.ending === 'stop') return p.before[sp.index].size ? `${at}; user leaves with "${[...p.before[sp.index]].join(', ')}" still set` : `${at}; nothing apart`;
  return `${at}; user taps "Show me how to put it back", jumps ahead to \`${all[v.jumpIndex ?? 0].id}\` (step ${n + 1} below) and ends with the shop summary`;
}

export function renderTutorialPath(c: Content, flow: TutorialFlow, p: TutorialPath): string {
  const t = flow.entry.def;
  const job = c.jobs.get(t.job)?.def;
  const v = p.variant;
  const all = combined(p.run);
  const tools = toolSummary(c, v.items);
  const L: string[] = [];
  L.push(`# ${job?.title ?? t.id}: ${p.combo.baseId}${v.ending === 'complete' ? '' : ` (${v.ending === 'jump' ? 'exit, then jump ahead' : 'exit'})`}`, '');
  L.push(`> ${NOTICE}`, '');
  L.push(
    ...header([
      ['Path', `\`${p.id}\``],
      ['Tutorial', `\`${t.id}\` · case \`${p.run.caseLabel}\` · difficulty ${t.difficulty}`],
      ['Bike', factsCell(c, p.combo)],
      ['Run choices', choicesCell(c, p.combo)],
      ['Ends', endingText(p, all)],
      ['Time', `${p.minutes} min`],
      ['Tools', toolTiers(c, tools, undefined, '<br>')],
    ]),
  );

  L.push('## Before you start', '');
  const qs = p.combo.asked.filter((k) => !k.startsWith('choice.') && !k.startsWith('tool.'));
  let n = 1;
  for (const k of qs) L.push(`${n++}. Question, skipped when already known: ${questionLine(c, k, p.combo.assign[k])}`);
  if (qs.length) L.push('');
  for (const chId of t.choices ?? []) L.push(...choiceBlock(c, chId, p.combo.assign[`choice.${chId}`]));
  L.push(`Tools picker. ${toolTiers(c, tools)}.`, '');

  L.push('## Steps', '');
  let finishShown = false;
  let jumpShown = false;
  let number = 0;
  v.items.forEach((it, i) => {
    number++;
    if (it.list === 'finish' && !finishShown) {
      L.push('#### Finish (good path only)', '');
      finishShown = true;
    }
    if (v.afterJump[i] && !jumpShown) {
      const skipped = (v.jumpIndex ?? 0) - (v.stop!.index + 1);
      L.push(`> **Jumped ahead** in the same tutorial: the user tapped "Show me how to put it back". ${skipped > 0 ? `${skipped} step(s) skipped.` : 'No steps skipped.'} The progress bar moves forward once.`, '');
      jumpShown = true;
    }
    const chosen = v.stop && i === v.stop.index ? v.stop.key : v.skip && i === v.skip.index ? v.skip.buttonId : undefined;
    const after = i + 1 < p.before.length ? p.before[i + 1] : p.final;
    const beforeWork = !v.items.slice(0, i).some((x) => x.kind === 'step');
    const note = it.kind === 'inspect' && beforeWork ? '<sub>Not shown again if this session already answered it, for example in the diagnosis. The earlier answer decides the outcome.</sub>' : undefined;
    L.push(...renderCard(c, it, { number, known: nothingKnown, showAllDetails: true, chosen, before: p.before[i], after, note, onPath: true }));
    if (v.stop && i === v.stop.index) {
      const sp = v.stop;
      const apart = p.before[i];
      L.push(...exitScreen(sp.kind, sp.message, apart.size > 0 && !!sp.showHowFrom));
    }
  });

  L.push('## End', '');
  if (v.ending === 'complete') {
    L.push(`The tutorial is done. Nothing is left apart. Total: ${p.minutes} min.`);
  } else if (v.stop!.kind === 'not_needed') {
    L.push(`The repair is not needed.${p.final.size ? ` **Still set: ${[...p.final].join(', ')}**` : ' Nothing is left apart.'}`);
  } else {
    L.push(`Shop summary, shown to hand over at the shop:`, '');
    L.push(`- Job: ${job?.title ?? t.job}`);
    L.push(`- Tell the mechanic: "${job?.shop.tell ?? ''}"`);
    L.push(`- Found: "${v.stop!.label}" at \`${all[v.stop!.index].id}\``);
    L.push(`- Already done: steps 1 to ${v.items.length} of this tutorial`);
    L.push(`- Price: ${priceText(job)}`);
    if (p.final.size) L.push(`- **Still set: ${[...p.final].join(', ')}**`);
  }
  L.push('');
  return L.join('\n');
}

export function priceText(job: any): string {
  if (!job) return 'no estimate yet';
  const p = job.shop.price_eur;
  return /^<.*>$/.test(p) ? 'no estimate yet' : `${p} EUR (${job.shop.price_source})`;
}

export function renderTutorialIndex(c: Content, flow: TutorialFlow): string {
  const L = [`# Tutorial \`${flow.id}\`: all paths`, '', `> ${NOTICE}`, ''];
  L.push('| Path | Bike and choices | Ends | Time |', '| --- | --- | --- | --- |');
  for (const p of flow.paths) {
    const all = combined(p.run);
    L.push(`| [${p.id}](${p.id}.md) | ${factsCell(c, p.combo)}<br>${choicesCell(c, p.combo)} | ${endingText(p, all)} | ${p.minutes} min |`);
  }
  L.push('', '## Exits before the first step', '', '| Bike | Exit | Message |', '| --- | --- | --- |');
  for (const e of flow.exits) L.push(`| ${factsCell(c, e.combo)} | ${e.exit.kind} | ${e.exit.message} |`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- diagnoses

export function renderDiagnosisPath(c: Content, flow: DiagnosisFlow, p: DiagnosisFlowPath): string {
  const d = flow.entry.def;
  const job = c.jobs.get(p.path.job)?.def;
  const L: string[] = [];
  const end = p.path.hitIndex < 0 ? 'no check found a cause' : `\`${p.run.checks[p.path.hitIndex].id}\`: ${p.path.hitState}`;
  L.push(`# Diagnosis "${d.symptom}": ${end}`, '', `> ${NOTICE}`, '');
  L.push(
    ...header([
      ['Path', `\`${p.id}\``],
      ['Bike', factsCell(c, p.combo)],
      ['Ends', `Job \`${p.path.job}\`${p.path.urgency ? ` (${p.path.urgency})` : ''}`],
      ['Time', `${p.minutes} min`],
    ]),
  );
  const qs = p.combo.asked;
  if (qs.length) {
    L.push('## Before you start', '');
    qs.forEach((k, i) => L.push(`${i + 1}. Question, skipped when already known: ${questionLine(c, k, p.combo.assign[k])}`));
    L.push('');
  }
  L.push('## Checks', '', 'The first state that leads to a job ends the diagnosis.', '');
  let n = 1;
  p.run.checks.forEach((ch, i) => {
    if (p.path.hitIndex >= 0 && i > p.path.hitIndex) return;
    if (ch.skipped) {
      L.push(`### – \`${ch.id}\` · skipped (does not apply to this bike)`, '');
      return;
    }
    const chosen = i === p.path.hitIndex ? p.path.hitState : undefined;
    L.push(...renderDiagnosisCheck(c, ch, n++, chosen, nothingKnown, true));
  });
  const facts: Record<string, Value> = {};
  for (const k of p.combo.asked) facts[k] = p.combo.assign[k];
  const t = job?.tutorial ? c.tutorials.get(job.tutorial) : undefined;
  L.push(...renderJobScreen(c, p.path.job, p.path.urgency, t ? tutorialTimeRange(c, t, facts, p.combo.params) : null));
  const rest = p.path.hitIndex >= 0 ? p.run.checks.slice(p.path.hitIndex + 1).filter((x) => !x.skipped) : [];
  if (rest.length) L.push(`After the job: "Did it fix it?" If not, the diagnosis continues with ${rest.map((x) => `\`${x.id}\``).join(', ')}.`, '');
  return L.join('\n');
}

/** A diagnosis or routine-check inspection: each state says whether it ends the diagnosis. */
export function renderDiagnosisCheck(
  c: Content, ch: DiagnosisCheck, n: number, chosen: string | undefined, known: Known, markOk: boolean,
  mode: 'diagnosis' | 'check' = 'diagnosis', level = 3,
): string[] {
  const L = [`${'#'.repeat(level)} ${n}. ${ch.def.title} · \`${ch.id}\` · inspection · ${ch.def.minutes} min`, '', fill(ch.def.text, known), ''];
  const scene = sceneLine(ch.def);
  if (scene) L.push(scene, '');
  for (const st of ch.def.states) {
    const hit = ch.hits[st.id];
    const title = hit ? c.jobs.get(hit.job)?.def.title ?? hit.job : '';
    const res = mode === 'check'
      ? (hit ? `→ to-do: **${title}** (${hit.urgency})` : '→ ok')
      : (hit ? `→ result: **${title}** (${hit.urgency})` : '→ next check');
    const mine = chosen !== undefined ? st.id === chosen : markOk && !hit;
    L.push(`- [ ] **${fill(st.label, known)}** — ${fill(st.meaning, known)} ${res}${mine ? ' ◀ **this path**' : ''}`);
  }
  L.push('');
  return L;
}

export function renderJobScreen(c: Content, jobId: string, urgency: string | undefined, timeRange: string | null, level = 2): string[] {
  const job = c.jobs.get(jobId)?.def;
  const L = [`${'#'.repeat(level)} Job screen: ${job?.title ?? jobId}${urgency === 'do_not_ride' ? ' · **do not ride**' : urgency ? ` · ${urgency}` : ''}`, ''];
  if (job?.tutorial) {
    const t = c.tutorials.get(job.tutorial)?.def;
    L.push(`- **Do it myself**: tutorial \`${job.tutorial}\`${timeRange ? `, ${timeRange} for this bike` : ''}, difficulty ${t?.difficulty ?? '?'}`);
  } else {
    L.push('- Do it myself: no guide yet');
  }
  L.push(`- **Take it to a shop**: "${job?.shop.tell ?? ''}" Price: ${priceText(job)}.`, '');
  return L;
}

export function renderDiagnosisIndex(c: Content, flow: DiagnosisFlow): string {
  const L = [`# Diagnosis \`${flow.id}\`: all paths`, '', `> ${NOTICE}`, ''];
  L.push('| Path | Bike | Ends at job | Time |', '| --- | --- | --- | --- |');
  for (const p of flow.paths) L.push(`| [${p.id}](${p.id}.md) | ${factsCell(c, p.combo)} | ${p.path.job}${p.path.urgency ? ` (${p.path.urgency})` : ''} | ${p.minutes} min |`);
  L.push('', '## Not covered', '', '| Bike | Exit | Message |', '| --- | --- | --- |');
  for (const e of flow.exits) L.push(`| ${factsCell(c, e.combo)} | ${e.exit.kind} | ${e.exit.message} |`);
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------- routine check

export function renderRoutineCheck(c: Content, id: string): string {
  const ch = c.checks.get(id)!.def;
  const L = [`# ${ch.title} (\`${id}\`)`, '', `> ${NOTICE}`, '', 'Every state that leads to a job becomes a to-do item on the bike. Inspections that do not apply to the bike are skipped.', ''];
  let n = 1;
  for (const it of ch.inspections) {
    const insp = c.inspections.get(it.inspect)!.def;
    for (const pos of it.pos ?? [null]) {
      L.push(`### ${n++}. ${insp.title} · \`${it.inspect}\`${pos ? ` (${pos})` : ''} · ${insp.minutes} min`, '');
      if (insp.applies_when) L.push(`<sub>Only when: ${Object.entries(insp.applies_when).map(([k, v]) => `${k} is ${(v as any[]).join(' or ')}`).join(' and ')}</sub>`, '');
      L.push(insp.text, '');
      for (const st of insp.states) {
        const todo = st.leads_to ? `→ to-do: **${c.jobs.get(st.leads_to.job)?.def.title ?? st.leads_to.job}** (${st.leads_to.urgency})` : '→ ok';
        L.push(`- [ ] **${st.label}** — ${st.meaning} ${todo}`);
      }
      L.push('');
    }
  }
  return L.join('\n');
}
