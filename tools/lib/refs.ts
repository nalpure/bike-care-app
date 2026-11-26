// Static rules: every reference exists, and the per-file rules that need no path expansion.

import type { Content, Entry } from './content.js';
import { conditionPairs, PLACEHOLDER, type Condition } from './conditions.js';
import type { Issues } from './issues.js';
import { lineAt, type YamlFile, type YPath } from './yamlfile.js';

export interface Ctx {
  c: Content;
  issues: Issues;
}

interface Loc {
  file: YamlFile;
  path: YPath;
  id: string;
}

const err = (x: Ctx, loc: Loc, rule: string, msg: string) =>
  x.issues.error(loc.file.rel, loc.id, rule, msg, lineAt(loc.file, loc.path));
const warn = (x: Ctx, loc: Loc, rule: string, msg: string) =>
  x.issues.warn(loc.file.rel, loc.id, rule, msg, lineAt(loc.file, loc.path));
const sub = (loc: Loc, ...p: YPath): Loc => ({ ...loc, path: [...loc.path, ...p] });
const locOf = (e: Entry, kind: string): Loc => ({ file: e.file, path: e.path, id: `${kind} ${e.def.id ?? e.def.key}` });

/** Finds a fact definition; brake.type.front also matches a definition brake.type.<pos>. */
export function factDef(c: Content, key: string): Entry | undefined {
  const direct = c.facts.get(key);
  if (direct) return direct;
  const generic = key.replace(/\.(front|rear)$/, '.<pos>');
  return c.facts.get(generic);
}

/** A number fact's value is a number between its min and max. */
function checkNumber(x: Ctx, loc: Loc, key: string, f: any, v: unknown): void {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) err(x, loc, 'fact-range', `Fact ${key} is a number, not "${v}".`);
  else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max))
    err(x, loc, 'fact-range', `Fact ${key}: ${n} is outside ${f.min ?? '…'} to ${f.max ?? '…'}.`);
}

/** A fact the app never asks (ask: never): conditions read it, but it stays unknown unless the bike's data has it. */
export function neverAsked(c: Content, key: string): boolean {
  return factDef(c, key)?.def.ask === 'never';
}

export function stateLabelExists(c: Content, label: string): boolean {
  if (c.states.has(label)) return true;
  return c.states.has(label.replace(/\.(front|rear)$/, '.<pos>'));
}

export function checkCondition(x: Ctx, cond: Condition | undefined, loc: Loc): void {
  if (!cond) return;
  for (const [key, value] of conditionPairs(cond)) {
    if (key.startsWith('tool.')) {
      const id = key.slice(5);
      if (!x.c.tools.has(id)) err(x, loc, 'unknown-tool', `Condition reads ${key}, but tool "${id}" is not in content/tools.yaml.`);
      if (typeof value !== 'boolean') err(x, loc, 'condition-value', `${key} can only be true or false, not "${value}".`);
      continue;
    }
    if (key.startsWith('choice.')) {
      const id = key.slice(7);
      const ch = x.c.choices.get(id);
      if (!ch) err(x, loc, 'unknown-choice', `Condition reads ${key}, but choice "${id}" is not in content/choices.yaml.`);
      else if (!ch.def.options.some((o: any) => o.id === String(value)))
        err(x, loc, 'condition-value', `${key} has no option "${value}". Options: ${ch.def.options.map((o: any) => o.id).join(', ')}.`);
      continue;
    }
    if (key.startsWith('param.')) {
      err(x, loc, 'condition-key', `${key}: conditions on parameters are not supported. Use <pos> in the fact key instead.`);
      continue;
    }
    const f = factDef(x.c, key);
    if (!f) {
      err(x, loc, 'unknown-fact', `Condition reads fact "${key}", which is not in content/facts.yaml.`);
      continue;
    }
    if (!f.def.question && f.def.ask !== 'never') {
      err(x, loc, 'fact-needs-question', `Condition reads fact "${key}", so the app may need to ask it, but the fact has no question in content/facts.yaml.`);
    }
    const v = String(value);
    if (v === 'unknown') continue;
    if (f.def.values && !f.def.values.map(String).includes(v))
      err(x, loc, 'condition-value', `Fact ${key} has no value "${v}". Values: ${f.def.values.join(', ')}, unknown.`);
    if (f.def.type === 'boolean' && v !== 'true' && v !== 'false')
      err(x, loc, 'condition-value', `Fact ${key} is true or false, not "${v}".`);
    if (f.def.type === 'text')
      err(x, loc, 'condition-on-text', `Fact ${key} is free text; conditions cannot test it. Use it in a placeholder or details line.`);
  }
}

/** Placeholders: the fact exists; fallback wording is required unless the fact is guaranteed by details.needs. */
export function checkText(x: Ctx, text: string | undefined, loc: Loc, needs: string[] = []): void {
  if (typeof text !== 'string') return;
  for (const m of text.matchAll(PLACEHOLDER)) {
    const key = m[1];
    const fallback = m[2];
    if (!factDef(x.c, key)) {
      err(x, loc, 'unknown-fact', `Placeholder {${key}} names a fact that is not in content/facts.yaml.`);
      continue;
    }
    if (fallback === undefined && !needs.includes(key)) {
      err(x, loc, 'placeholder-fallback', `Placeholder {${key}} needs fallback wording for an unknown value: {${key}|...}.`);
    }
    if (fallback !== undefined && fallback.trim() === '') {
      err(x, loc, 'placeholder-fallback', `Placeholder {${key}|} has empty fallback wording.`);
    }
  }
  if (/\{[^}]*\}/.test(text.replace(PLACEHOLDER, ''))) {
    err(x, loc, 'placeholder-form', `Text has a brace that is not a valid placeholder {fact.key|fallback}.`);
  }
}

function sentences(text: string): number {
  return text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0).length;
}

/** Every text of a step or inspection the user reads on its card, lower-cased, for the mention rule. */
function cardText(def: any): string {
  const parts: string[] = [def.text, def.generic_text, def.question, ...(def.details ?? []).map((d: any) => d.text)];
  for (const b of def.buttons ?? []) parts.push(b.label, b.text, b.block, b.exit?.text);
  for (const s of def.states ?? []) parts.push(s.label, s.meaning);
  return parts.filter(Boolean).join(' \n ').toLowerCase();
}

/** The words that count as naming a tool: its full name and its mentions. */
export function toolWords(tool: any): string[] {
  return [tool.name, ...(tool.mentions ?? [])].map((w: string) => w.toLowerCase());
}

function mentions(text: string, word: string): boolean {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${esc}`).test(text);
}

function checkToolUse(x: Ctx, tools: any, loc: Loc, def: any): void {
  if (!tools) return;
  const text = cardText(def);
  for (const kind of ['required', 'helpful'] as const) {
    (tools[kind] ?? []).forEach((t: any, i: number) => {
      const id = typeof t === 'string' ? t : t.id;
      const tool = x.c.tools.get(id);
      if (!tool) err(x, sub(loc, 'tools', kind, i), 'unknown-tool', `Tool "${id}" is not in content/tools.yaml.`);
      else if (!toolWords(tool.def).some((w) => mentions(text, w))) {
        err(x, sub(loc, 'tools', kind, i), 'tool-not-mentioned', `Tool "${id}" is listed, but the text never names it. Name it in the text ("${tool.def.name}"${tool.def.mentions ? ` or ${tool.def.mentions.map((m: string) => `"${m}"`).join(', ')}` : ''}), add a short word to its mentions in content/tools.yaml, or take it off the list.`);
      }
      if (typeof t === 'object') checkCondition(x, t.when, sub(loc, 'tools', kind, i));
    });
  }
  (tools.one_of ?? []).forEach((id: string, i: number) => {
    const set = x.c.toolSets.get(id);
    if (!set) {
      err(x, sub(loc, 'tools', 'one_of', i), 'unknown-tool', `Tool set "${id}" is not in content/tools.yaml under tool_sets.`);
      return;
    }
    const opts = set.def.options.map((o: any) => x.c.tools.get(o.tool)).filter(Boolean);
    if (!opts.some((t: any) => toolWords(t.def).some((w) => mentions(text, w)))) {
      err(x, sub(loc, 'tools', 'one_of', i), 'tool-not-mentioned', `Tool set "${id}" is listed, but the text names none of its tools (${opts.map((t: any) => `"${t.def.mentions?.[0] ?? t.def.name}"`).join(', ')}).`);
    }
  });
}

/** Tool sets: the options exist, and their conditions read only facts the app never asks. */
function checkToolSet(x: Ctx, e: Entry): void {
  const loc = locOf(e, 'tool set');
  if (x.c.tools.has(e.def.id)) err(x, loc, 'duplicate-id', `"${e.def.id}" is both a tool and a tool set. Give them different ids.`);
  checkText(x, e.def.tell_apart, loc);
  e.def.options.forEach((o: any, i: number) => {
    const ol = sub(loc, 'options', i);
    if (!x.c.tools.has(o.tool)) err(x, ol, 'unknown-tool', `Tool "${o.tool}" is not in content/tools.yaml.`);
    checkCondition(x, o.when, sub(ol, 'when'));
    for (const [key] of conditionPairs(o.when)) {
      if (key.startsWith('tool.') || key.startsWith('choice.') || (factDef(x.c, key) && !neverAsked(x.c, key))) {
        err(x, ol, 'tool-set-when', `An option reads ${key}, but options may read only facts marked ask: never (the bike's data), so the tools screen never asks a question.`);
      }
    }
  });
}

function checkAnimation(x: Ctx, a: any, loc: Loc): void {
  if (!a) return;
  const isClip = a.clip !== undefined;
  const isGeneric = a.target !== undefined || a.motion !== undefined;
  if (isClip === isGeneric || (isGeneric && (!a.target || !a.motion))) {
    err(x, loc, 'animation-kind', 'An animation is either a named clip (clip, caption) or a generic motion (target, motion, caption, optional direction and amount).');
  }
  if (isClip && (a.direction || a.amount)) err(x, loc, 'animation-kind', 'A clip takes no direction or amount; they belong to the clip.');
  if (a.clip && !x.c.catalog.clips.has(a.clip)) err(x, loc, 'unknown-clip', `Clip "${a.clip}" is not in ${x.c.catalog.source}.`);
  if (a.target && !x.c.catalog.nodes.has(a.target)) err(x, loc, 'unknown-node', `Animation target "${a.target}" is not a 3D node in ${x.c.catalog.source}.`);
  if (a.motion && x.c.catalog.motions.size && !x.c.catalog.motions.has(a.motion)) err(x, loc, 'unknown-motion', `Motion "${a.motion}" is not supported.`);
  if (a.view && !x.c.catalog.views.has(a.view)) err(x, loc, 'unknown-view', `View "${a.view}" is not in ${x.c.catalog.source}.`);
  checkText(x, a.caption, loc);
}

function checkScene(x: Ctx, def: any, loc: Loc): void {
  (def.focus ?? []).forEach((n: string, i: number) => {
    if (!x.c.catalog.nodes.has(n)) err(x, sub(loc, 'focus', i), 'unknown-node', `Focus node "${n}" is not a 3D node in ${x.c.catalog.source}.`);
  });
  (def.show ?? []).forEach((n: string, i: number) => {
    if (!x.c.catalog.nodes.has(n)) err(x, sub(loc, 'show', i), 'unknown-node', `Show node "${n}" is not a 3D node in ${x.c.catalog.source}.`);
    else if ((def.focus ?? []).includes(n)) err(x, sub(loc, 'show', i), 'show-and-focus', `Node "${n}" is in both focus and show; list it once, in focus.`);
  });
  if (def.view && !x.c.catalog.views.has(def.view)) err(x, sub(loc, 'view'), 'unknown-view', `View "${def.view}" is not in ${x.c.catalog.source}.`);
  checkAnimation(x, def.animation, sub(loc, 'animation'));
}

function checkDetails(x: Ctx, def: any, loc: Loc): void {
  (def.details ?? []).forEach((d: any, i: number) => {
    for (const k of d.needs) if (!factDef(x.c, k)) err(x, sub(loc, 'details', i), 'unknown-fact', `details.needs names fact "${k}", which is not in content/facts.yaml.`);
    checkText(x, d.text, sub(loc, 'details', i), d.needs);
    for (const m of d.text.matchAll(PLACEHOLDER)) {
      if (!d.needs.includes(m[1])) err(x, sub(loc, 'details', i), 'details-needs', `details text uses {${m[1]}}, which is not listed in its needs.`);
    }
  });
}

function checkLabels(x: Ctx, labels: string[] | undefined, loc: Loc, field: string): void {
  (labels ?? []).forEach((l, i) => {
    if (!stateLabelExists(x.c, l)) err(x, sub(loc, field, i), 'unknown-state-label', `State label "${l}" is not in content/states.yaml.`);
  });
}

/** remove-front-wheel -> remove-<pos>-wheel, to find a definition written with a parameter. */
export function posify(id: string): string {
  return id.replace(/(^|-)(front|rear)(-|$)/, '$1<pos>$3');
}

export function stepExists(c: Content, id: string): boolean {
  return c.steps.has(id) || c.steps.has(posify(id));
}

export function procedureExists(c: Content, id: string): boolean {
  return c.procedures.has(id) || c.procedures.has(posify(id));
}

export function stepOrProcedureExists(c: Content, id: string): boolean {
  return stepExists(c, id) || procedureExists(c, id);
}

function checkButtons(x: Ctx, step: any, loc: Loc): void {
  const buttons: any[] = step.buttons ?? [];
  if (step.kind === 'action' && buttons.length) {
    err(x, sub(loc, 'buttons'), 'action-has-buttons', 'An action step has no state buttons. Make it a check, or move the buttons to a check step.');
  }
  if (step.kind === 'action' && step.question) {
    err(x, sub(loc, 'question'), 'action-has-buttons', 'An action step asks no question. Make it a check.');
  }
  // With a question, Next is the good answer and the buttons are only the problems (one is enough).
  const min = step.question ? 1 : 2;
  if (step.kind !== 'action' && buttons.length < min) {
    err(x, loc, 'check-needs-buttons', step.question ? `A ${step.kind} with a question needs 1 to 3 problem answers; it has ${buttons.length}.` : `A ${step.kind} needs 2 or 3 state buttons; it has ${buttons.length}.`);
  }
  checkText(x, step.question, sub(loc, 'question'));
  buttons.forEach((b, i) => {
    const bl = sub(loc, 'buttons', i);
    if ((b.block || b.exit?.kind === 'unsafe') && step.kind !== 'safety_check') {
      err(x, bl, 'unsafe-only-in-safety-checks', `Button "${b.label}" has ${b.block ? 'block' : 'an unsafe exit'}, but this step is a ${step.kind}. Only safety checks and inspection calls may block or exit as unsafe.`);
    }
    if (b.block && b.exit) err(x, bl, 'button-kind', `Button "${b.label}" has both block and exit. Choose one.`);
    if (b.exit && b.solution) err(x, bl, 'no-solution-on-exit', `Button "${b.label}" ends the tutorial, so it cannot offer a solution.`);
    if (!b.text && !b.block && !b.exit) err(x, bl, 'button-needs-text', `Button "${b.label}" needs text, block or exit.`);
    if (b.skips) {
      if (b.block || b.exit) err(x, bl, 'button-kind', `Button "${b.label}" cannot both skip steps and ${b.block ? 'block' : 'exit'}.`);
      if (step.kind === 'action') err(x, bl, 'skip-unsafe', 'Only check steps can skip later steps.');
      for (const target of b.skips) {
        const t = x.c.steps.get(target);
        if (!t) {
          err(x, bl, 'unknown-step', `skips names step "${target}", which is not defined in content/steps/.`);
          continue;
        }
        if (t.def.kind === 'safety_check' || t.def.sets?.length || t.def.clears?.length) {
          err(x, bl, 'skip-unsafe', `Button "${b.label}" skips ${target}, but a safety check or a step that sets or clears a state label must never be skipped.`);
        }
      }
    }
    if (b.exit?.show_how_from && !stepOrProcedureExists(x.c, b.exit.show_how_from)) {
      err(x, bl, 'unknown-show-how-from', `show_how_from "${b.exit.show_how_from}" is neither a step nor a procedure.`);
    }
    checkCondition(x, b.when, bl);
    for (const k of ['label', 'text', 'block'] as const) checkText(x, b[k], bl);
    checkText(x, b.exit?.text, bl);
    (b.solution ?? []).forEach((a: any, j: number) => checkAnimation(x, a, sub(bl, 'solution', j)));
    if (b.label && b.label.split(/\s+/).length > 10) warn(x, bl, 'label-too-long', `Button label has more than 10 words: "${b.label}".`);
  });
  if (!step.question && buttons.some((b) => b.block) && !buttons.some((b) => !b.block && !b.exit)) {
    err(x, sub(loc, 'buttons'), 'block-needs-fix', 'A step with a block button needs a good state the user can tap once it is fixed.');
  }
  const labels = buttons.map((b) => b.label);
  if (new Set(labels).size !== labels.length) err(x, sub(loc, 'buttons'), 'duplicate-label', 'Two buttons have the same label.');
  const ids = buttons.map((b) => b.id);
  if (new Set(ids).size !== ids.length) err(x, sub(loc, 'buttons'), 'duplicate-id', 'Two buttons have the same id.');
}

function checkStep(x: Ctx, e: Entry): void {
  const s = e.def;
  const loc = locOf(e, 'step');
  checkCondition(x, s.when, sub(loc, 'when'));
  if (s.if_unknown === 'generic' && !s.generic_text) err(x, loc, 'generic-needs-text', 'if_unknown: generic needs generic_text.');
  if (s.generic_text && s.if_unknown !== 'generic' && s.if_unknown !== 'ask') warn(x, loc, 'unused-generic-text', 'generic_text is only shown with if_unknown: generic or ask.');
  checkToolUse(x, s.tools, loc, s);
  (s.parts ?? []).forEach((p: string, i: number) => {
    if (!x.c.parts.has(p)) err(x, sub(loc, 'parts', i), 'unknown-part', `Part "${p}" is not in content/tools.yaml under parts.`);
  });
  checkLabels(x, s.sets, loc, 'sets');
  checkLabels(x, s.clears, loc, 'clears');
  checkLabels(x, s.forbidden_while, loc, 'forbidden_while');
  checkScene(x, s, loc);
  checkDetails(x, s, loc);
  checkText(x, s.text, sub(loc, 'text'));
  checkText(x, s.generic_text, sub(loc, 'generic_text'));
  checkButtons(x, s, loc);
  if (sentences(s.text) > 2) warn(x, sub(loc, 'text'), 'text-too-long', 'Step text has more than two sentences. Writing rule: one action, at most two short sentences.');
}

function checkInspection(x: Ctx, e: Entry): void {
  const d = e.def;
  const loc = locOf(e, 'inspection');
  checkCondition(x, d.applies_when, sub(loc, 'applies_when'));
  checkToolUse(x, d.tools, loc, d);
  checkScene(x, d, loc);
  checkDetails(x, d, loc);
  checkText(x, d.text, sub(loc, 'text'));
  const ids = d.states.map((s: any) => s.id);
  if (new Set(ids).size !== ids.length) err(x, sub(loc, 'states'), 'duplicate-id', 'Two states have the same id.');
  if (d.default !== undefined && !ids.includes(d.default)) err(x, sub(loc, 'default'), 'unknown-state', `default "${d.default}" is not a state of ${d.id}. States: ${ids.join(', ')}.`);
  if (d.default !== undefined && d.states.find((s: any) => s.id === d.default)?.leads_to) err(x, sub(loc, 'default'), 'default-continues', `default "${d.default}" leads to a job. The default is the usual, good state.`);
  checkText(x, d.question, sub(loc, 'question'));
  d.states.forEach((s: any, i: number) => {
    const sl = sub(loc, 'states', i);
    if (s.leads_to && !x.c.jobs.has(s.leads_to.job)) err(x, sl, 'unknown-job', `leads_to names job "${s.leads_to.job}", which is not in content/jobs.yaml.`);
    checkText(x, s.label, sl);
    checkText(x, s.meaning, sl);
    for (const [k, v] of Object.entries<any>(s.sets ?? {})) {
      const kl = sub(sl, 'sets', k);
      const f = factDef(x.c, k);
      if (!f) {
        err(x, kl, 'unknown-fact', `sets names fact "${k}", which is not in content/facts.yaml.`);
        continue;
      }
      // A fact a condition reads would change the planned path in the middle of the flow.
      if (f.def.question || f.def.ask === 'never') err(x, kl, 'sets-fact', `Fact ${k} has a question or ask: never, so conditions may read it. An inspection sets only facts that no condition reads.`);
      if (f.def.values && !f.def.values.map(String).includes(String(v))) err(x, kl, 'condition-value', `Fact ${k} has no value "${v}". Values: ${f.def.values.join(', ')}.`);
      if (f.def.type === 'boolean' && typeof v !== 'boolean') err(x, kl, 'condition-value', `Fact ${k} is true or false, not "${v}".`);
    }
  });
  // Two states that set the same facts cannot be told apart when the facts are already known.
  const sigs = d.states.filter((s: any) => s.sets).map((s: any) => JSON.stringify(Object.entries(s.sets).sort()));
  if (new Set(sigs).size !== sigs.length) err(x, sub(loc, 'states'), 'sets-fact', 'Two states set the same facts to the same values.');
  if (d.states.every((s: any) => s.leads_to)) warn(x, sub(loc, 'states'), 'no-ok-state', 'Every state leads to a job. Usually one state is the good state, without leads_to.');
}

function checkProcedure(x: Ctx, e: Entry): void {
  const loc = locOf(e, 'procedure');
  e.def.implementations.forEach((impl: any, i: number) => {
    const il = sub(loc, 'implementations', i);
    checkCondition(x, impl.when, sub(il, 'when'));
    impl.steps.forEach((it: any, j: number) => {
      const jl = sub(il, 'steps', j);
      if (typeof it === 'string') {
        if (!stepExists(x.c, it)) err(x, jl, 'unknown-step', `Step "${it}" is not defined in content/steps/. (Call a procedure as {procedure: id}.)`);
      } else if (it.procedure) {
        if (!procedureExists(x.c, it.procedure)) err(x, jl, 'unknown-procedure', `Procedure "${it.procedure}" is not in content/procedures.yaml.`);
        if (it.procedure === e.def.id) err(x, jl, 'procedure-recursion', 'A procedure cannot call itself.');
      } else {
        checkText(x, it.exit?.text, jl);
        if (it.exit?.show_how_from) err(x, jl, 'exit-jump-outside', 'An exit in a procedure runs before anything is opened, so it cannot jump.');
      }
    });
  });
}

/** Items of a case file's sequence or finish, or of the tutorial's checks (base ['tutorial', 'checks']). */
function checkFlowItems(x: Ctx, items: any[], file: YamlFile, base: YPath, list: 'sequence' | 'finish', tid: string): void {
  items.forEach((it, i) => {
    const loc: Loc = { file, path: [...base, i], id: `tutorial ${tid}` };
    const kinds = ['step', 'procedure', 'inspect'].filter((k) => it[k] !== undefined);
    if (kinds.length !== 1) {
      err(x, loc, 'item-kind', `Each item has exactly one of step, procedure, inspect; this one has ${kinds.join(', ') || 'none'}.`);
      return;
    }
    if (it.outcomes && !it.inspect) err(x, loc, 'outcomes-only-on-inspect', 'outcomes belong to an inspect item only. Steps carry their own buttons.');
    if (it.step) {
      loc.id = `tutorial ${tid} / step ${it.step}`;
      if (!stepExists(x.c, it.step)) err(x, loc, 'unknown-step', `Step "${it.step}" is not defined in content/steps/.`);
    }
    if (it.procedure) {
      loc.id = `tutorial ${tid} / procedure ${it.procedure}`;
      if (!procedureExists(x.c, it.procedure)) err(x, loc, 'unknown-procedure', `Procedure "${it.procedure}" is not in content/procedures.yaml.`);
    }
    if (it.inspect) checkInspectCall(x, loc, it.inspect, it.outcomes, list, tid, false);
  });
}

/** One inspection call in a tutorial and its outcomes; a follow-up ({ inspect, outcomes }) is checked the same way. */
function checkInspectCall(x: Ctx, loc: Loc, id: string, outcomes: any, list: 'sequence' | 'finish', tid: string, follow: boolean): void {
  loc.id = `tutorial ${tid} / inspect ${id}`;
  const insp = x.c.inspections.get(id);
  if (!insp) {
    err(x, loc, 'unknown-inspection', `Inspection "${id}" is not in content/inspections.yaml.`);
    return;
  }
  if (!outcomes) {
    err(x, loc, 'inspect-needs-outcomes', 'A tutorial maps every state of an inspection to continue, block, stop or end.');
    return;
  }
  const states: string[] = insp.def.states.map((s: any) => s.id);
  for (const s of states) if (!(s in outcomes)) err(x, sub(loc, 'outcomes'), 'outcomes-match-states', `No outcome for state "${s}" of ${id}.`);
  for (const [s, o] of Object.entries<any>(outcomes)) {
    const ol = sub(loc, 'outcomes', s);
    if (!states.includes(s)) err(x, ol, 'outcomes-match-states', `Inspection ${id} has no state "${s}". States: ${states.join(', ')}.`);
    if (typeof o !== 'object') continue;
    if (o.inspect !== undefined) {
      if (follow) err(x, ol, 'follow-up', 'A follow-up inspection cannot have a follow-up of its own.');
      else if (o.inspect === id) err(x, ol, 'follow-up', 'A follow-up is a different inspection.');
      else checkInspectCall(x, { ...ol }, o.inspect, o.outcomes, list, tid, true);
      continue;
    }
    const k = ['block', 'exit'].filter((key) => o[key] !== undefined);
    if (k.length !== 1) err(x, ol, 'outcome-kind', 'An outcome is continue, a follow-up { inspect, outcomes }, or has exactly one of block, exit.');
    const sh = o.exit?.show_how_from;
    if (sh && list === 'finish') err(x, ol, 'jump-in-finish', 'finish runs only on the good path, so its exits cannot jump ahead.');
    if (sh && !stepOrProcedureExists(x.c, sh)) err(x, ol, 'unknown-show-how-from', `show_how_from "${sh}" is neither a step nor a procedure.`);
    checkText(x, o.block ?? o.exit?.text, ol);
  }
  const dflt = insp.def.default;
  if (dflt !== undefined && dflt in outcomes && outcomes[dflt] !== 'continue') {
    err(x, sub(loc, 'outcomes', dflt), 'default-continues', `State "${dflt}" is the default of ${id} (Next means it), so its outcome must be continue.`);
  }
  if (Object.values(outcomes).some((o: any) => o?.block) && !Object.values(outcomes).includes('continue')) {
    err(x, sub(loc, 'outcomes'), 'block-needs-fix', 'An inspection call with a block needs a state that continues once it is fixed.');
  }
}

/** The follow-up calls inside an inspection call's outcomes: [state, { inspect, outcomes }]. */
function followUps(outcomes: any): Array<[string, any]> {
  return Object.entries<any>(outcomes ?? {}).filter(([, o]) => o && typeof o === 'object' && o.inspect !== undefined);
}

function checkTutorial(x: Ctx, t: any, e: Entry & { cases?: Map<string, YamlFile> }): void {
  const loc = locOf(e, 'tutorial');
  if (!x.c.jobs.has(t.job)) err(x, loc, 'unknown-job', `The folder content/tutorials/${t.job} names job "${t.job}", which is not in content/jobs.yaml. Name the folder after its job.`);
  (t.choices ?? []).forEach((ch: string, i: number) => {
    if (!x.c.choices.has(ch)) err(x, sub(loc, 'choices', i), 'unknown-choice', `Choice "${ch}" is not in content/choices.yaml.`);
  });
  (t.parts ?? []).forEach((p: string, i: number) => {
    if (!x.c.parts.has(p)) err(x, sub(loc, 'parts', i), 'unknown-part', `Part "${p}" does not exist.`);
  });
  // The tutorial's checks run before anything is apart, in every case.
  checkFlowItems(x, t.checks ?? [], e.file, [...e.path, 'checks'], 'sequence', t.id);
  (t.checks ?? []).forEach((it: any, i: number) => {
    const l = sub(loc, 'checks', i);
    const calls: Array<[Loc, any]> = [[l, it], ...followUps(it.outcomes).map(([s, f]): [Loc, any] => [sub(l, 'outcomes', s), f])];
    for (const [cl, call] of calls) {
      const insp = x.c.inspections.get(call.inspect);
      if (insp && !insp.def.hands_off) err(x, cl, 'hands-off-only', `Inspection ${call.inspect} is not hands_off. A tutorial's checks run before the work and use only hands-off inspections.`);
      for (const [s, o] of Object.entries<any>(call.outcomes ?? {})) {
        if (o?.exit?.show_how_from) err(x, sub(cl, 'outcomes', s), 'exit-jump-outside', "A tutorial's checks run before anything is apart, so their exits cannot jump.");
      }
    }
  });
  t.cases.forEach((cs: any, i: number) => {
    const l = sub(loc, 'cases', i);
    if ((cs.include === undefined) === (cs.cases === undefined)) err(x, l, 'case-target', 'A case has exactly one of include, cases.');
    checkCondition(x, cs.when, sub(l, 'when'));
    (cs.cases ?? []).forEach((leaf: any, j: number) => checkCondition(x, leaf.when, sub(l, 'cases', j, 'when')));
  });
  for (const [, cf] of e.cases ?? new Map()) {
    checkFlowItems(x, cf.data.sequence ?? [], cf, ['sequence'], 'sequence', t.id);
    checkFlowItems(x, cf.data.finish ?? [], cf, ['finish'], 'finish', t.id);
  }
}

function checkDiagnosis(x: Ctx, e: Entry): void {
  const d = e.def;
  const loc = locOf(e, 'diagnosis');
  if (d.covers_like) {
    const job = x.c.jobs.get(d.covers_like);
    if (!job) err(x, sub(loc, 'covers_like'), 'unknown-job', `covers_like names job "${d.covers_like}", which does not exist.`);
    else if (!job.def.covers) err(x, sub(loc, 'covers_like'), 'unknown-job', `covers_like names job "${d.covers_like}", which has no covers.`);
  }
  checkText(x, d.symptom, loc);
  d.checks.forEach((ch: any, i: number) => {
    const l = sub(loc, 'checks', i);
    const insp = x.c.inspections.get(ch.inspect);
    if (!insp) {
      err(x, l, 'unknown-inspection', `Inspection "${ch.inspect}" is not in content/inspections.yaml.`);
      return;
    }
    if (!insp.def.hands_off) err(x, l, 'hands-off-only', `Inspection ${ch.inspect} is not hands_off. Diagnoses use only hands-off inspections.`);
  });
  if (!x.c.jobs.has(d.no_hit.job)) err(x, sub(loc, 'no_hit'), 'unknown-job', `no_hit names job "${d.no_hit.job}", which does not exist.`);
}

function checkRoutine(x: Ctx, e: Entry): void {
  const loc = locOf(e, 'check');
  e.def.inspections.forEach((it: any, i: number) => {
    const insp = x.c.inspections.get(it.inspect);
    if (!insp) err(x, sub(loc, 'inspections', i), 'unknown-inspection', `Inspection "${it.inspect}" is not in content/inspections.yaml.`);
    else if (!insp.def.hands_off) err(x, sub(loc, 'inspections', i), 'hands-off-only', `Inspection ${it.inspect} is not hands_off. The routine check uses only hands-off inspections.`);
  });
}

function checkProfile(x: Ctx, e: Entry): void {
  const p = e.def;
  const loc = locOf(e, 'profile');
  for (const field of ['facts', 'answers'] as const) {
    for (const [k, v] of Object.entries<any>(p[field] ?? {})) {
      const l = sub(loc, field, k);
      const f = factDef(x.c, k);
      if (!f) {
        err(x, l, 'unknown-fact', `Fact "${k}" is not in content/facts.yaml.`);
        continue;
      }
      const s = String(v);
      if (field === 'facts' && s === 'unknown') err(x, l, 'profile-fact', `Leave "${k}" out of facts instead of setting it to unknown.`);
      if (s !== 'unknown' && f.def.values && !f.def.values.map(String).includes(s)) err(x, l, 'condition-value', `Fact ${k} has no value "${s}".`);
      if (s !== 'unknown' && f.def.type === 'number') checkNumber(x, l, k, f.def, v);
      if (field === 'answers' && k in (p.facts ?? {})) err(x, l, 'profile-fact', `"${k}" is in both facts and answers. A known fact is never asked.`);
    }
  }
  (p.tools ?? []).forEach((t: string, i: number) => {
    if (!x.c.tools.has(t)) err(x, sub(loc, 'tools', i), 'unknown-tool', `Tool "${t}" is not in content/tools.yaml.`);
  });
  p.journeys.forEach((j: any, i: number) => {
    const jl = sub(loc, 'journeys', i);
    const s = j.start;
    if (s.diagnosis && !x.c.diagnoses.has(s.diagnosis)) err(x, sub(jl, 'start'), 'unknown-diagnosis', `Diagnosis "${s.diagnosis}" does not exist.`);
    if (s.tutorial && !x.c.tutorials.has(s.tutorial)) err(x, sub(jl, 'start'), 'unknown-tutorial', `Tutorial "${s.tutorial}" does not exist.`);
    if (s.check && !x.c.checks.has(s.check)) err(x, sub(jl, 'start'), 'unknown-check', `Check "${s.check}" does not exist.`);
    for (const [ch, opt] of Object.entries<any>(j.choices ?? {})) {
      const cd = x.c.choices.get(ch);
      if (!cd) {
        err(x, sub(jl, 'choices', ch), 'unknown-choice', `Choice "${ch}" does not exist.`);
        continue;
      }
      const o = cd.def.options.find((op: any) => op.id === opt);
      if (!o) err(x, sub(jl, 'choices', ch), 'condition-value', `Choice ${ch} has no option "${opt}".`);
      for (const t of o?.requires_tools ?? []) {
        if (!(p.tools ?? []).includes(t)) err(x, sub(jl, 'choices', ch), 'profile-missing-tool', `Option ${ch}: ${opt} needs tool "${t}", which this profile does not list under tools.`);
      }
    }
    for (const [k, v] of Object.entries<any>(j.sees ?? {})) {
      const iid = k.replace(/\.(front|rear)$/, '');
      const insp = x.c.inspections.get(iid);
      if (!insp) err(x, sub(jl, 'sees', k), 'unknown-inspection', `sees names inspection "${iid}", which does not exist.`);
      else if (!insp.def.states.some((st: any) => st.id === v)) err(x, sub(jl, 'sees', k), 'unknown-state', `Inspection ${iid} has no state "${v}".`);
    }
    for (const [k, v] of Object.entries<any>(j.tutorial_sees ?? {})) {
      const insp = x.c.inspections.get(k);
      const step = x.c.steps.get(k);
      if (insp) {
        if (!insp.def.states.some((st: any) => st.id === v)) err(x, sub(jl, 'tutorial_sees', k), 'unknown-state', `Inspection ${k} has no state "${v}".`);
        else if (v === insp.def.default) err(x, sub(jl, 'tutorial_sees', k), 'unknown-button', `"${v}" is the default of ${k}: in a tutorial it has no button. Leave tutorial_sees.${k} out; the owner taps Next.`);
      } else if (step) {
        if (!(step.def.buttons ?? []).some((b: any) => b.id === v)) err(x, sub(jl, 'tutorial_sees', k), 'unknown-button', `Step ${k} has no button with id "${v}".`);
      } else err(x, sub(jl, 'tutorial_sees', k), 'unknown-ref', `"${k}" is neither an inspection nor a step.`);
    }
  });
}

export function checkStatic(c: Content, issues: Issues): void {
  const x: Ctx = { c, issues };
  for (const e of c.toolSets.values()) checkToolSet(x, e);
  for (const e of c.steps.values()) checkStep(x, e);
  for (const e of c.inspections.values()) checkInspection(x, e);
  for (const e of c.procedures.values()) checkProcedure(x, e);
  for (const e of c.tutorials.values()) checkTutorial(x, e.def, e);
  for (const e of c.diagnoses.values()) checkDiagnosis(x, e);
  for (const e of c.checks.values()) checkRoutine(x, e);
  for (const e of c.profiles.values()) checkProfile(x, e);
  for (const e of c.jobs.values()) {
    const loc = locOf(e, 'job');
    if (e.def.covers) {
      const cl = sub(loc, 'covers');
      checkCondition(x, e.def.covers.when, sub(cl, 'when'));
      e.def.covers.not_covered.forEach((nc: any, i: number) => {
        checkCondition(x, nc.when, sub(cl, 'not_covered', i, 'when'));
        checkText(x, nc.text, sub(cl, 'not_covered', i));
      });
    }
    checkText(x, e.def.shop.tell, sub(loc, 'shop'));
  }
  for (const e of c.states.values()) {
    (e.def.safety_checks ?? []).forEach((s: string, i: number) => {
      if (!c.steps.has(s)) err(x, sub(locOf(e, 'state'), 'safety_checks', i), 'unknown-step', `Safety check "${s}" is not a step.`);
    });
  }
  for (const e of c.choices.values()) {
    e.def.options.forEach((o: any, i: number) => {
      for (const t of o.requires_tools ?? []) if (!c.tools.has(t)) err(x, sub(locOf(e, 'choice'), 'options', i), 'unknown-tool', `Tool "${t}" is not in content/tools.yaml.`);
    });
  }
  const groupsUsed = new Set<string>();
  for (const e of c.facts.values()) {
    const f = e.def;
    const loc = locOf(e, 'fact');
    if (f.answers && f.values) {
      for (const v of f.values) if (!(String(v) in f.answers)) err(x, loc, 'fact-answers', `Fact ${f.key} has no answer text for value "${v}".`);
    }
    const group = String(f.key).split('.')[0];
    groupsUsed.add(group);
    if (!c.factGroups.has(group)) err(x, loc, 'fact-group', `Fact ${f.key} is in group "${group}", which has no entry in fact_groups. Add one with a label and an icon.`);
    if (f.min !== undefined && f.max !== undefined && f.min >= f.max) err(x, loc, 'fact-range', `Fact ${f.key}: min ${f.min} must be below max ${f.max}.`);
    for (const v of f.values ?? []) if (f.type === 'number') checkNumber(x, loc, f.key, f, v);
  }
  for (const e of c.factGroups.values())
    if (!groupsUsed.has(e.def.id)) err(x, locOf(e, 'fact group'), 'fact-group', `Fact group "${e.def.id}" has no facts. Remove it.`);
  checkUnused(x);
}

function checkUnused(x: Ctx): void {
  const usedSteps = new Set<string>();
  const usedProcs = new Set<string>();
  const usedInsp = new Set<string>();
  for (const p of x.c.procedures.values())
    for (const impl of p.def.implementations)
      for (const it of impl.steps) {
        if (typeof it === 'string') usedSteps.add(it);
        else if (it.procedure) usedProcs.add(it.procedure);
      }
  for (const t of x.c.tutorials.values()) {
    for (const cf of t.cases.values())
      for (const it of [...(cf.data.sequence ?? []), ...(cf.data.finish ?? [])]) {
        if (it.step) usedSteps.add(it.step);
        if (it.procedure) usedProcs.add(it.procedure);
        if (it.inspect) usedInsp.add(it.inspect);
      }
    for (const it of t.def.checks ?? []) {
      usedInsp.add(it.inspect);
      for (const [, f] of followUps(it.outcomes)) usedInsp.add(f.inspect);
    }
    for (const cf of t.cases.values())
      for (const it of [...(cf.data.sequence ?? []), ...(cf.data.finish ?? [])]) for (const [, f] of followUps(it.outcomes)) usedInsp.add(f.inspect);
  }
  for (const d of x.c.diagnoses.values()) for (const ch of d.def.checks) usedInsp.add(ch.inspect);
  for (const ch of x.c.checks.values()) for (const it of ch.def.inspections) usedInsp.add(it.inspect);
  const isUsed = (set: Set<string>, id: string) => set.has(id) || [...set].some((u) => u.replace(/(front|rear)/, '<pos>') === id);
  for (const [id, e] of x.c.steps) if (!isUsed(usedSteps, id)) warn(x, locOf(e, 'step'), 'unused', `Step ${id} is not used by any tutorial or procedure.`);
  for (const [id, e] of x.c.procedures) if (!isUsed(usedProcs, id)) warn(x, locOf(e, 'procedure'), 'unused', `Procedure ${id} is not used by any tutorial.`);
  for (const [id, e] of x.c.inspections) if (!usedInsp.has(id)) warn(x, locOf(e, 'inspection'), 'unused', `Inspection ${id} is not used by any flow.`);
}
