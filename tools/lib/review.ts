// Review units: what humans and agents review, each exactly once, with a content hash.
//
//   card:<kind>:<id>    one piece of user-facing text (step, inspection, fact question, bike sheet group, run choice,
//                       job, state label, tool), shown once with every context it appears in
//   tree:<kind>:<id>    the structure of one flow (tutorial, diagnosis, routine check): order,
//                       branches, exits and jumps, without repeating card texts
//   journey:<p>/<j>     one profile journey, end to end, as the user experiences it
//
// A sign-off in reviews/ledger.yaml names a unit, its hash at review time, a role and a verdict.
// A unit counts as reviewed for a role only while its hash is unchanged.

import { createHash } from 'node:crypto';
import type { Content } from './content.js';
import type { Condition } from './conditions.js';
import { combined } from './expand.js';
import type { Flows, TutorialFlow } from './flows.js';
import type { JourneyResult } from './journeys.js';
import { exitTag, NOTICE, toolName } from './render.js';
import { lineAt } from './yamlfile.js';
import type { Issues } from './issues.js';

export type Role = 'mechanic' | 'beginner';
export const ROLES: Role[] = ['mechanic', 'beginner'];

export interface Unit {
  id: string;
  kind: 'card' | 'tree' | 'journey';
  title: string;
  hash: string;
  /** roles that must sign this unit */
  roles: Role[];
  /** the file in build/review/ that shows it */
  file: string;
  lines: string[];
}

export type Status = 'approved' | 'changes_requested' | 'changed' | 'unreviewed';

export interface UnitStatus {
  unit: Unit;
  byRole: Record<string, { status: Status; by?: string; date?: string }>;
}

// ---------------------------------------------------------------- hashing

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) out[k] = stable((v as any)[k]);
    return out;
  }
  return v;
}

export function hashOf(v: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(v))).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------- contexts

interface Context {
  flow: string;
  where: string;
  choices: Set<string>;
  apart: Set<string>;
  via: Set<string>;
}

/** For every step and inspection: the flows, cases and states it appears in. */
function contextsOf(c: Content, flows: Flows): Map<string, Map<string, Context>> {
  const out = new Map<string, Map<string, Context>>();
  const add = (id: string, flow: string, where: string, choice: string, apart: Set<string> | null, via?: string) => {
    const m = out.get(id) ?? new Map<string, Context>();
    const key = `${flow}|${where}`;
    const ctx = m.get(key) ?? { flow, where, choices: new Set(), apart: new Set(), via: new Set() };
    if (choice) ctx.choices.add(choice);
    ctx.apart.add(apart && apart.size ? [...apart].join(' + ') : 'nothing apart');
    if (via) ctx.via.add(via);
    m.set(key, ctx);
    out.set(id, m);
  };
  for (const t of flows.tutorials) {
    for (const p of t.paths) {
      if (p.variant.ending === 'stop') continue;
      const choice = p.combo.asked.filter((k) => k.startsWith('choice.')).map((k) => String(p.combo.assign[k])).join(', ');
      p.variant.items.forEach((it, i) => {
        const where = `case ${p.run.caseLabel}${it.list === 'finish' ? ', finish' : ''}${p.variant.afterJump[i] ? ', after a jump ahead' : ''}`;
        add(`${it.kind === 'inspect' ? 'inspection' : 'step'}:${it.id}`, `tutorial ${t.id}`, where, choice, p.before[i], it.via);
      });
    }
  }
  for (const d of flows.diagnoses) d.entry.def.checks.forEach((ch: any, i: number) => add(`inspection:${ch.inspect}`, `diagnosis ${d.id}`, `check ${i + 1}`, '', null));
  for (const [id, ch] of c.checks) ch.def.inspections.forEach((it: any, i: number) => add(`inspection:${it.inspect}`, `routine check ${id}`, `item ${i + 1}`, '', null));
  return out;
}

function contextLines(ctx: Map<string, Context> | undefined): string[] {
  if (!ctx || !ctx.size) return ['<sub>Appears in: no flow yet.</sub>'];
  const L = ['<sub>Appears in:</sub>', ''];
  for (const x of ctx.values()) {
    const parts = [x.where];
    if (x.choices.size) parts.push(`when holding: ${[...x.choices].join(', ')}`);
    if (x.via.size) parts.push(`via ${[...x.via].map((v) => `\`${v}\``).join(', ')}`);
    parts.push(`before it: ${[...x.apart].join(' / ')}`);
    L.push(`- <sub>${x.flow}: ${parts.join('; ')}</sub>`);
  }
  return L;
}

// ---------------------------------------------------------------- cards

function cond(cnd: Condition | undefined): string {
  if (!cnd) return '';
  return Object.entries(cnd)
    .map(([k, v]) => (k === 'any_of' ? `any of (${(v as Condition[]).map(cond).join(' | ')})` : `${k} is ${(v as unknown[]).join(' or ')}`))
    .join(' and ');
}

function anim(a: any): string {
  return a.clip ? `"${a.caption}" (clip ${a.clip})` : `"${a.caption}" (${a.target} ${a.motion}${a.direction ? `, ${a.direction}` : ''}${a.amount ? `, ${a.amount}` : ''})`;
}

function toolsLine(c: Content, tools: any): string | null {
  if (!tools) return null;
  const name = (t: any) => (typeof t === 'string' ? toolName(c, t) : `${toolName(c, t.id)} (when ${cond(t.when)})`);
  const req = (tools.required ?? []).map(name);
  const sets = (tools.one_of ?? []).map((id: string) => c.toolSets.get(id)?.def.name ?? id);
  const help = (tools.helpful ?? []).map(name);
  if (!req.length && !sets.length && !help.length) return null;
  return `Tools. Needed: ${req.join('; ') || 'none'}.${sets.length ? ` One of these, depending on your part: ${sets.join('; ')}.` : ''} Helpful: ${help.join('; ') || 'none'}.`;
}

function sceneLine(def: any): string | null {
  const p: string[] = [];
  if (def.focus?.length) p.push(`focus ${def.focus.join(', ')}`);
  if (def.view) p.push(`view ${def.view}`);
  return p.length ? `<sub>3D: ${p.join(' · ')}</sub>` : null;
}

function stepCard(c: Content, s: any, ctx: Map<string, Context> | undefined): string[] {
  const kind = s.kind === 'safety_check' ? 'safety check' : s.kind;
  const L = [`<sub>${kind} · ${s.minutes} min</sub>`, '', `${s.text}`];
  if (s.when) L.push('', `<sub>Only when ${cond(s.when)}; if unknown: ${s.if_unknown}.</sub>`);
  if (s.generic_text) L.push('', `Generic text (fact unknown): ${s.generic_text}`);
  for (const d of s.details ?? []) L.push('', `> _When ${d.needs.join(', ')} is known:_ ${d.text}`);
  const tl = toolsLine(c, s.tools);
  if (tl) L.push('', tl);
  const scene = sceneLine(s);
  if (scene) L.push('', scene);
  if (s.animation) L.push('', `Animation: ${anim(s.animation)}`);
  const labels = [
    ...(s.sets ?? []).map((l: string) => `sets ${l}`),
    ...(s.clears ?? []).map((l: string) => `clears ${l}`),
    ...(s.forbidden_while ?? []).map((l: string) => `never while ${l}`),
  ];
  if (labels.length) L.push('', `<sub>State: ${labels.join(' · ')}</sub>`);
  if (s.buttons?.length) {
    L.push('');
    for (const b of s.buttons) {
      let res = b.text ?? '';
      if (b.block) res = `**BLOCK** (Next stays disabled): ${b.block}`;
      if (b.exit) res = `${exitTag(b.exit.kind)}: ${b.exit.text}${b.exit.show_how_from ? ` · jump: \`${b.exit.show_how_from}\`` : ''}`;
      if (b.text && (b.block || b.exit)) res = `${b.text} ${res}`;
      L.push(`- [ ] **${b.label}** <sub>\`${b.id}\`${b.when ? `, only when ${cond(b.when)}` : ''}</sub> → ${res}`);
      for (const a of b.solution ?? []) L.push(`  - Show solution: ${anim(a)}`);
      if (b.skips?.length) L.push(`  - Skips: ${b.skips.map((x: string) => `\`${x}\``).join(', ')}`);
    }
  }
  L.push('', ...contextLines(ctx));
  return L;
}

function inspectionCard(c: Content, d: any, ctx: Map<string, Context> | undefined): string[] {
  const L = [`<sub>inspection · ${d.minutes} min</sub>`, '', d.text];
  L.push('', `<sub>${d.hands_off ? 'Hands-off: usable in diagnoses and the routine check.' : 'Not hands-off: tutorials only.'}${d.applies_when ? ` Only when ${cond(d.applies_when)}.` : ''}</sub>`);
  for (const x of d.details ?? []) L.push('', `> _When ${x.needs.join(', ')} is known:_ ${x.text}`);
  const tl = toolsLine(c, d.tools);
  if (tl) L.push('', tl);
  const scene = sceneLine(d);
  if (scene) L.push('', scene);
  if (d.animation) L.push('', `Animation: ${anim(d.animation)}`);
  L.push('');
  for (const st of d.states) {
    const lead = st.leads_to ? ` → usually: **${c.jobs.get(st.leads_to.job)?.def.title ?? st.leads_to.job}** (${st.leads_to.urgency})` : '';
    L.push(`- [ ] **${st.label}** <sub>\`${st.id}\`</sub> — ${st.meaning}${lead}`);
  }
  L.push('', '<sub>What each state does in a tutorial is part of that tutorial\'s flow tree.</sub>', '', ...contextLines(ctx));
  return L;
}

export function cardUnits(c: Content, flows: Flows): Unit[] {
  const ctx = contextsOf(c, flows);
  const units: Unit[] = [];
  const file = 'build/review/cards.md';
  const add = (kind: string, id: string, title: string, def: unknown, roles: Role[], body: string[]) =>
    units.push({ id: `card:${kind}:${id}`, kind: 'card', title, hash: hashOf(def), roles, file, lines: body });

  for (const [id, e] of c.inspections) add('inspection', id, e.def.title, e.def, ['mechanic', 'beginner'], inspectionCard(c, e.def, ctx.get(`inspection:${id}`)));
  for (const [id, e] of c.steps) add('step', id, e.def.title, e.def, ['mechanic', 'beginner'], stepCard(c, e.def, ctx.get(`step:${id}`)));
  for (const [key, e] of c.facts) {
    const f = e.def;
    if (!f.question) continue;
    const body = [`"${f.question.en}"${f.question.de ? ` / "${f.question.de}"` : ''}`, '', `<sub>Label on the bike sheet: ${f.label.en}${f.label.de ? ` / ${f.label.de}` : ''}</sub>`, ''];
    if (f.help) body.push(`Help behind "?": ${f.help.en}${f.help.de ? ` / ${f.help.de}` : ''}`, '');
    for (const [v, a] of Object.entries<any>(f.answers ?? {})) body.push(`- \`${v}\`: ${a.en}${a.de ? ` / ${a.de}` : ''}`);
    body.push('- I\'ll check later (unknown)');
    if (f.question.picture) body.push('', `<sub>Picture set: ${f.question.picture}</sub>`);
    add('fact', key, `Question: ${key}`, f, ['beginner'], body);
  }
  const tr = (t: any) => `${t?.en ?? ''}${t?.de ? ` / ${t.de}` : ''}`;
  for (const [id, g] of c.factGroups) {
    const facts = [...c.facts.values()].map((e) => e.def).filter((f) => String(f.key).split('.')[0] === id);
    const body = [`<sub>The bike sheet's group "${tr(g.def.label)}", icon \`${g.def.icon}\`. One line per fact: its label, then what the user can enter.</sub>`, ''];
    for (const f of facts) {
      const range = f.min !== undefined || f.max !== undefined ? `, ${f.min ?? '…'} to ${f.max ?? '…'}` : '';
      const kind = f.type === 'number' ? `number${f.unit ? ` in ${f.unit}` : ''}${range}` : f.type;
      const how = f.question ? 'asked when needed' : f.ask === 'never' ? 'never asked, from the bike\'s data' : 'never asked';
      body.push(`- **${tr(f.label)}** <sub>\`${f.key}\`, ${kind}, ${how}</sub>`);
      if (!f.question) for (const [v, a] of Object.entries<any>(f.answers ?? {})) body.push(`  - \`${v}\`: ${tr(a)}`);
    }
    const def = { group: g.def, facts: facts.map((f) => ({ key: f.key, label: f.label, type: f.type, unit: f.unit, min: f.min, max: f.max, values: f.values, answers: f.question ? undefined : f.answers })) };
    add('fact-group', id, `Bike sheet: ${tr(g.def.label)}`, def, ['beginner'], body);
  }
  for (const [id, e] of c.choices) {
    const body = [`"${e.def.question}"`, ''];
    for (const o of e.def.options) {
      body.push(`- **${o.label}** <sub>\`${o.id}\`${o.recommended ? ', recommended' : ''}${o.requires_tools?.length ? `, needs ${o.requires_tools.map((t: string) => toolName(c, t)).join(', ')}` : ''}</sub>`);
      if (o.note) body.push(`  - ${o.note}`);
      if (o.warning) body.push(`  - ⚠ ${o.warning}`);
    }
    add('choice', id, `Run choice: ${id}`, e.def, ['mechanic', 'beginner'], body);
  }
  for (const [id, e] of c.jobs) {
    add('job', id, e.def.title, e.def, ['beginner'], [
      `Shop text: "${e.def.shop.tell}"`, '', `Price: ${e.def.shop.price_eur} (${e.def.shop.price_source})`, '',
      ...(e.def.service ? [`Service: every ${e.def.service.interval_km} km (${e.def.service.source})`, ''] : []),
      `Tutorial: ${e.def.tutorial ? `\`${e.def.tutorial}\`` : 'none (shop only)'}`,
    ]);
  }
  for (const [id, e] of c.states) {
    add('state', id, `State: ${id}`, e.def, ['mechanic', 'beginner'], [
      e.def.description, '', `Put back: "${e.def.put_back}"`, ...(e.def.warning ? ['', `Standing warning: "${e.def.warning}"`] : []),
      ...(e.def.safety_checks?.length ? ['', `Safety checks after it is cleared: ${e.def.safety_checks.map((s: string) => `\`${s}\``).join(', ')}`] : []),
    ]);
  }
  for (const [id, e] of c.tools) {
    const body = [`Name: "${e.def.name}" (${e.def.kind})`];
    if (e.def.mentions?.length) body.push(`<sub>Step texts may call it: ${e.def.mentions.map((m: string) => `"${m}"`).join(', ')}</sub>`);
    for (const s of e.def.substitutes ?? []) body.push(`- Instead you can use: ${s.name}${s.note ? ` (${s.note})` : ''}`);
    add('tool', id, e.def.name, e.def, ['mechanic', 'beginner'], body);
  }
  for (const [id, e] of c.toolSets) {
    const body = [`Name: "${e.def.name}" (one of these, depending on your part)`, '', `How to tell: "${e.def.tell_apart}"`, ''];
    for (const o of e.def.options) body.push(`- ${toolName(c, o.tool)}${o.when ? ` <sub>shown alone when ${cond(o.when)}</sub>` : ''}`);
    add('tool-set', id, e.def.name, e.def, ['mechanic', 'beginner'], body);
  }
  return units;
}

// ---------------------------------------------------------------- trees

/** The parts of a step or inspection that shape a flow, without its texts. */
function structureOfStep(s: any) {
  return {
    id: s.id, kind: s.kind, when: s.when, if_unknown: s.if_unknown, sets: s.sets, clears: s.clears, forbidden_while: s.forbidden_while,
    buttons: (s.buttons ?? []).map((b: any) => ({ id: b.id, block: !!b.block, exit: b.exit ? { kind: b.exit.kind, show_how_from: b.exit.show_how_from } : undefined, skips: b.skips, when: b.when })),
  };
}

function structureOfInspection(d: any) {
  return { id: d.id, applies_when: d.applies_when, hands_off: d.hands_off, states: d.states.map((s: any) => ({ id: s.id, leads_to: s.leads_to })) };
}

function itemTitle(c: Content, kind: 'step' | 'inspect', id: string): string {
  const def = kind === 'step' ? c.steps.get(id)?.def : c.inspections.get(id)?.def;
  return `${def?.title ?? id} · \`${id}\``;
}

function buttonsSummary(s: any): string {
  return (s.buttons ?? [])
    .map((b: any) => {
      const marks = [b.block ? 'BLOCK' : '', b.exit ? `EXIT ${b.exit.kind}${b.exit.show_how_from ? ` → jump to \`${b.exit.show_how_from}\`` : ''}` : '', b.skips ? `skips ${b.skips.join(', ')}` : '', b.when ? `only when ${cond(b.when)}` : '']
        .filter(Boolean)
        .join(', ');
      return `\`${b.id}\`${marks ? ` (${marks})` : ''}`;
    })
    .join(' · ');
}

function tutorialTree(c: Content, flow: TutorialFlow): { lines: string[]; structure: unknown } {
  const t = flow.entry;
  const def = t.def;
  const L: string[] = [];
  const used = { steps: new Set<string>(), inspections: new Set<string>(), procedures: new Set<string>() };

  // Questions and choices
  const asked = new Set<string>();
  const silent = new Set<string>();
  for (const p of flow.paths) for (const k of p.combo.asked) asked.add(k);
  for (const e of flow.exits) for (const k of e.combo.asked) asked.add(k);
  for (const x of [...flow.paths.map((p) => p.combo), ...flow.exits.map((e) => e.combo)]) for (const k of x.silent ?? []) silent.add(k);
  L.push('## Before the first step', '');
  L.push(`- Questions, only when not yet known: ${[...asked].filter((k) => !k.startsWith('choice.')).map((k) => `\`${k}\``).join(', ') || 'none'}`);
  if (silent.size) L.push(`- Read from the bike's data, never asked: ${[...silent].map((k) => `\`${k}\``).join(', ')}`);
  L.push(`- Run choices: ${(def.choices ?? []).map((x: string) => `\`${x}\``).join(', ') || 'none'}`, `- Difficulty ${def.difficulty}`, '');

  L.push(...coverageLines(c, def.job));

  // Branches
  L.push('## Branches', '', 'Evaluated top to bottom; the first match wins.', '');
  const caseLine = (cs: any, indent: string) => {
    const target = cs.include ? `case \`${cs.include.replace(/^cases\//, '').replace(/\.yaml$/, '')}\`` : 'nested branch:';
    L.push(`${indent}- when ${cond(cs.when)} → ${target}`);
    for (const leaf of cs.cases ?? []) caseLine(leaf, `${indent}  `);
  };
  for (const cs of def.cases) caseLine(cs, '');
  L.push('');

  const outcomeLines = (it: any): string[] =>
    Object.entries<any>(it.outcomes ?? {}).map(([state, o]) => {
      const res = o === 'continue' ? 'continue' : o.block ? `**BLOCK**: "${o.block}"` : `${exitTag(o.exit.kind)}: "${o.exit.text}"${o.exit.show_how_from ? ` · jump to \`${o.exit.show_how_from}\`` : ''}`;
      return `   - \`${state}\` → ${res}`;
    });

  // The tutorial's checks, once for every case
  if (def.checks?.length) {
    L.push('## Checks before the work, in every case', '', 'Not shown again when the user already answered them in this session, for example in a diagnosis.', '');
    def.checks.forEach((it: any, i: number) => {
      used.inspections.add(it.inspect);
      L.push(`${i + 1}. ${itemTitle(c, 'inspect', it.inspect)} · inspection`, ...outcomeLines(it));
    });
    L.push('');
  }

  // Each case once
  for (const [inc, cf] of t.cases) {
    const name = inc.replace(/^cases\//, '').replace(/\.yaml$/, '');
    const paths = flow.paths.filter((p) => p.run.caseLabel === name);
    const complete = paths.filter((p) => p.variant.ending === 'complete' && !p.variant.skip);
    const choices = [...new Set(complete.map((p) => p.combo.asked.filter((k) => k.startsWith('choice.')).map((k) => String(p.combo.assign[k])).join(', ')))].filter(Boolean);
    L.push(`## Case \`${name}\`${choices.length ? ` (${choices.join(' · ')})` : ''}`, '');
    L.push(`Time of the complete path: ${complete.map((p) => `${p.minutes} min${p.combo.asked.some((k) => k.startsWith('choice.')) ? ` (${p.combo.asked.filter((k) => k.startsWith('choice.')).map((k) => p.combo.assign[k]).join(', ')})` : ''}`).join(', ') || '-'}`, '');
    // what is apart before each case item, over all complete paths of this case
    const apartAt = (list: string, i: number): string => {
      const sets = new Set<string>();
      for (const p of complete) {
        const idx = p.variant.items.findIndex((it) => it.src.file === cf && it.src.path[0] === list && it.src.path[1] === i);
        if (idx >= 0) sets.add(p.before[idx].size ? [...p.before[idx]].join(' + ') : 'nothing');
      }
      return [...sets].join(' / ') || '?';
    };
    let n = (def.checks?.length ?? 0) + 1;
    for (const list of ['sequence', 'finish'] as const) {
      const items: any[] = cf.data[list] ?? [];
      if (!items.length) continue;
      if (list === 'finish') L.push('', '**Finish** (good path only; skipped after an exit):', '');
      items.forEach((it, i) => {
        const apart = `<sub>apart: ${apartAt(list, i)}</sub>`;
        if (it.step) {
          used.steps.add(it.step);
          const s = c.steps.get(it.step)?.def;
          const kind = s?.kind === 'safety_check' ? 'safety check' : s?.kind;
          const extra = [s?.when ? `only when ${cond(s.when)}` : '', ...(s?.sets ?? []).map((l: string) => `+${l}`), ...(s?.clears ?? []).map((l: string) => `−${l}`)].filter(Boolean).join(', ');
          L.push(`${n++}. ${itemTitle(c, 'step', it.step)} · ${kind}${extra ? ` · ${extra}` : ''} ${apart}`);
          if (s?.buttons?.some((b: any) => b.block || b.exit || b.skips)) L.push(`   - buttons: ${buttonsSummary(s)}`);
        } else if (it.procedure) {
          used.procedures.add(it.procedure);
          const p = c.procedures.get(it.procedure)?.def;
          L.push(`${n++}. procedure \`${it.procedure}\` ${apart}`);
          for (const impl of p?.implementations ?? []) {
            const steps = impl.steps.map((x: any) => {
              if (typeof x === 'string') {
                used.steps.add(x);
                const s = c.steps.get(x)?.def;
                const marks = [...(s?.sets ?? []).map((l: string) => `+${l}`), ...(s?.clears ?? []).map((l: string) => `−${l}`)].join(', ');
                return `${itemTitle(c, 'step', x)}${marks ? ` (${marks})` : ''}`;
              }
              if (x.procedure) return `procedure \`${x.procedure}\``;
              return `${exitTag(x.exit.kind)}: "${x.exit.text}"`;
            });
            L.push(`   - when ${cond(impl.when)}: ${steps.join(' → ') || 'nothing'}`);
          }
        } else if (it.inspect) {
          used.inspections.add(it.inspect);
          L.push(`${n++}. ${itemTitle(c, 'inspect', it.inspect)} · inspection ${apart}`, ...outcomeLines(it));
        }
      });
    }
    // Exits with a jump: where they land and what that path does
    const jumps = paths.filter((p) => p.variant.ending === 'jump');
    if (jumps.length) {
      L.push('', 'Jump-ahead paths:', '');
      for (const p of jumps) {
        const all = combined(p.run);
        const sp = p.variant.stop!;
        L.push(`- \`${p.id}\`: exit at \`${all[sp.index].id}\` with ${[...p.before[sp.index]].join(' + ')} → jumps to \`${all[p.variant.jumpIndex!].id}\`, ends with ${p.final.size ? `**${[...p.final].join(', ')} still set**` : 'nothing apart'} and the shop summary`);
      }
    }
    L.push('');
  }

  // Exits before the first step, from the expansion
  if (flow.exits.length) {
    L.push('## Exits before the first step', '');
    for (const e of flow.exits) {
      const facts = [...e.combo.asked, ...(e.combo.silent ?? [])].map((k) => `${k} = ${(e.combo.alt?.[k] ?? [e.combo.assign[k]]).join(' or ')}`).join(', ');
      L.push(`- ${facts || 'any bike'} → ${exitTag(e.exit.kind)}`);
    }
    L.push('');
  }

  const structure = {
    tutorial: def,
    cases: [...t.cases.entries()].map(([k, f]) => [k, f.data]),
    procedures: [...used.procedures].map((id) => c.procedures.get(id)?.def),
    steps: [...used.steps].map((id) => structureOfStep(c.steps.get(id)?.def ?? {})),
    inspections: [...used.inspections].map((id) => structureOfInspection(c.inspections.get(id)?.def ?? { states: [] })),
    states: [...c.states.values()].map((s) => ({ id: s.def.id, safety_checks: s.def.safety_checks })),
    covers: c.jobs.get(def.job)?.def.covers,
  };
  return { lines: L, structure };
}

/** The bikes a job covers, and the not-covered texts for the others (jobs.yaml, covers). */
function coverageLines(c: Content, jobId: string, via?: string): string[] {
  const cv = c.jobs.get(jobId)?.def.covers;
  if (!cv) return [];
  const L = ['## Bikes covered', '', `${via ? `${via} ` : ''}From job \`${jobId}\` (jobs.yaml). Covers bikes where ${cond(cv.when)}. Any other bike ends at the first match:`, ''];
  for (const nc of cv.not_covered) L.push(`- when ${cond(nc.when)} → ${exitTag('not_covered')}: "${nc.text}"`);
  L.push('');
  return L;
}

function diagnosisTree(c: Content, d: any): { lines: string[]; structure: unknown } {
  const L = [`Symptom: "${d.symptom}"`, ''];
  if (d.covers_like) L.push(...coverageLines(c, d.covers_like, 'The same bikes as the job (covers_like).'));
  L.push('Checks, in order. The first state that leads to a job ends the diagnosis:', '');
  d.checks.forEach((ch: any, i: number) => {
    const insp = c.inspections.get(ch.inspect)?.def;
    L.push(`${i + 1}. ${itemTitle(c, 'inspect', ch.inspect)} · ${insp?.minutes} min${insp?.applies_when ? ` · only when ${cond(insp.applies_when)}` : ''}`);
    for (const st of insp?.states ?? []) {
      const hit = st.leads_to;
      L.push(`   - \`${st.id}\` → ${hit ? `job **${c.jobs.get(hit.job)?.def.title ?? hit.job}** (${hit.urgency})` : 'next check'}`);
    }
  });
  L.push('', `No hit → job **${c.jobs.get(d.no_hit.job)?.def.title ?? d.no_hit.job}**.`, '');
  const structure = { diagnosis: d, covers: d.covers_like ? c.jobs.get(d.covers_like)?.def.covers : undefined, inspections: d.checks.map((ch: any) => structureOfInspection(c.inspections.get(ch.inspect)?.def ?? { states: [] })) };
  return { lines: L, structure };
}

function checkTree(c: Content, ch: any): { lines: string[]; structure: unknown } {
  const L = ['Every state that leads to a job becomes a to-do item. Inspections that do not apply to the bike are skipped.', ''];
  ch.inspections.forEach((it: any, i: number) => {
    const insp = c.inspections.get(it.inspect)?.def;
    L.push(`${i + 1}. ${itemTitle(c, 'inspect', it.inspect)}${it.pos ? ` (${it.pos.join(', ')})` : ''}${insp?.applies_when ? ` · only when ${cond(insp.applies_when)}` : ''}`);
    for (const st of insp?.states ?? []) L.push(`   - \`${st.id}\` → ${st.leads_to ? `to-do **${c.jobs.get(st.leads_to.job)?.def.title ?? st.leads_to.job}** (${st.leads_to.urgency})` : 'ok'}`);
  });
  L.push('');
  return { lines: L, structure: { check: ch, inspections: ch.inspections.map((it: any) => structureOfInspection(c.inspections.get(it.inspect)?.def ?? { states: [] })) } };
}

export function treeUnits(c: Content, flows: Flows): Unit[] {
  const units: Unit[] = [];
  for (const f of flows.tutorials) {
    const { lines, structure } = tutorialTree(c, f);
    units.push({ id: `tree:tutorial:${f.id}`, kind: 'tree', title: `Tutorial: ${c.jobs.get(f.entry.def.job)?.def.title ?? f.id}`, hash: hashOf(structure), roles: ['mechanic'], file: `build/review/trees/${f.id}.md`, lines });
  }
  for (const d of flows.diagnoses) {
    const { lines, structure } = diagnosisTree(c, d.entry.def);
    units.push({ id: `tree:diagnosis:${d.id}`, kind: 'tree', title: `Diagnosis: ${d.entry.def.symptom}`, hash: hashOf(structure), roles: ['mechanic'], file: `build/review/trees/${d.id}.md`, lines });
  }
  for (const [id, ch] of c.checks) {
    const { lines, structure } = checkTree(c, ch.def);
    units.push({ id: `tree:check:${id}`, kind: 'tree', title: ch.def.title, hash: hashOf(structure), roles: ['mechanic'], file: `build/review/trees/${id}.md`, lines });
  }
  return units;
}

export function journeyUnits(profiles: Map<string, { results: JourneyResult[] }>): Unit[] {
  const units: Unit[] = [];
  for (const [pid, p] of profiles) {
    for (const r of p.results) {
      units.push({ id: `journey:${pid}/${r.journey}`, kind: 'journey', title: r.title, hash: hashOf(r.markdown), roles: ['beginner'], file: `build/review/journeys/${pid}.md`, lines: [] });
    }
  }
  return units;
}

// ---------------------------------------------------------------- ledger

export interface LedgerEntry {
  unit: string;
  hash: string;
  role: Role;
  by: string;
  date: string;
  verdict: 'approved' | 'changes_requested';
  note?: string;
}

export function statusOf(units: Unit[], ledger: LedgerEntry[]): UnitStatus[] {
  return units.map((unit) => {
    const byRole: UnitStatus['byRole'] = {};
    for (const role of unit.roles) {
      const entries = ledger.filter((e) => e.unit === unit.id && e.role === role);
      const last = entries[entries.length - 1];
      if (!last) byRole[role] = { status: 'unreviewed' };
      else if (last.hash !== unit.hash) byRole[role] = { status: 'changed', by: last.by, date: last.date };
      else byRole[role] = { status: last.verdict, by: last.by, date: last.date };
    }
    return { unit, byRole };
  });
}

export function checkLedger(c: Content, units: Unit[], issues: Issues): LedgerEntry[] {
  if (!c.ledger) return [];
  const ids = new Set(units.map((u) => u.id));
  const entries: LedgerEntry[] = c.ledger.data.reviews ?? [];
  entries.forEach((e, i) => {
    if (!ids.has(e.unit)) issues.warn(c.ledger!.rel, e.unit, 'ledger-unknown-unit', `The ledger signs "${e.unit}", which no longer exists. Leave it as history or remove it.`, lineAt(c.ledger!, ['reviews', i]));
  });
  return entries;
}

// ---------------------------------------------------------------- files

const MARK: Record<Status, string> = { approved: '✅ approved', changes_requested: '✏️ changes requested', changed: '🔄 changed since review', unreviewed: '⬜ not reviewed' };

function statusLine(s: UnitStatus): string {
  const roles = Object.entries(s.byRole).map(([r, x]) => `${r}: ${MARK[x.status]}${x.by ? ` (${x.by}, ${x.date})` : ''}`);
  return `<sub>Unit \`${s.unit.id}\` · hash \`${s.unit.hash}\` · ${roles.join(' · ')}</sub>`;
}

export function reviewFiles(statuses: UnitStatus[], journeyMarkdown: Map<string, string>): Map<string, string> {
  const files = new Map<string, string>();
  const head = (title: string, intro: string[]) => [`# ${title}`, '', `> ${NOTICE}`, '', ...intro, ''];

  // cards.md
  const cards = statuses.filter((s) => s.unit.kind === 'card');
  const groups: Array<[string, string]> = [
    ['inspection', 'Inspections'], ['step', 'Steps'], ['fact', 'Questions'], ['fact-group', 'Bike sheet'], ['choice', 'Run choices'],
    ['job', 'Jobs and shop texts'], ['state', 'State labels'], ['tool', 'Tools'], ['tool-set', 'Tool sets (one of these)'],
  ];
  const C = head('Card sheet', [
    'Every piece of text the user sees, exactly once. Review the wording as a beginner, the mechanics as a mechanic.',
    'Where a card appears, and what is apart at that moment, is listed under it. Order, branches and exits are reviewed in the flow trees.',
  ]);
  for (const [kind, title] of groups) {
    const list = cards.filter((s) => s.unit.id.startsWith(`card:${kind}:`));
    if (!list.length) continue;
    C.push(`## ${title}`, '');
    for (const s of list) C.push(`### ${s.unit.title}`, '', statusLine(s), '', ...s.unit.lines, '');
  }
  files.set('build/review/cards.md', C.join('\n'));

  // trees
  for (const s of statuses.filter((x) => x.unit.kind === 'tree')) {
    const T = head(`Flow tree: ${s.unit.title}`, [
      statusLine(s),
      '',
      'The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).',
      'To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.',
    ]);
    files.set(s.unit.file, [...T, ...s.unit.lines].join('\n'));
  }

  // journeys
  for (const [file, md] of journeyMarkdown) files.set(file, md);

  // index
  const I = head('Review status', [
    'One line per review unit. A sign-off counts only while the unit is unchanged (same hash).',
    'Sign with `npm run review -- sign <unit> --role mechanic|beginner --by "<name>"`. See `npm run review -- help`.',
  ]);
  const counts = (kind: string) => {
    const list = statuses.filter((s) => s.unit.kind === kind);
    const open = list.filter((s) => Object.values(s.byRole).some((x) => x.status !== 'approved')).length;
    return `${list.length - open} of ${list.length} fully approved`;
  };
  I.push(`- Cards: ${counts('card')}`, `- Flow trees: ${counts('tree')}`, `- Journeys: ${counts('journey')}`, '');
  I.push('| Unit | Title | Mechanic | Beginner | File |', '| --- | --- | --- | --- | --- |');
  for (const s of statuses) {
    const cell = (r: string) => (s.byRole[r] ? MARK[s.byRole[r].status] : '—');
    I.push(`| \`${s.unit.id}\` | ${s.unit.title.replace(/\|/g, '\\|')} | ${cell('mechanic')} | ${cell('beginner')} | [${s.unit.file.replace('build/review/', '')}](${s.unit.file.replace('build/review/', '')}) |`);
  }
  files.set('build/review/index.md', [...I, ''].join('\n'));
  return files;
}
