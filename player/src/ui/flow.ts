// Every screen of a journey: questions, run choices, tools, cards, exits, job, shop summary, done.
// One card component serves inspections, steps and checks.

import { UNKNOWN } from '../../../tools/lib/conditions.js';
import type { Card, Journey, Peek, Screen, ShopSummary } from '../engine/journey.js';
import type { StageView } from './stage.js';
import type { App } from './app.js';
import { bikeTitle } from '../engine/bikes.js';
import { h, icon, ICON } from './dom.js';

const EXIT_TITLE: Record<string, string> = {
  unsafe: 'Do not ride',
  not_covered: 'Not supported yet',
  not_needed: 'Not needed',
  shop_only: 'A shop has to do this',
};

const POSITION_LABEL: Record<string, string> = { front: 'Front', rear: 'Rear' };

function top(app: App, title: string, small: string, opts: { close?: boolean } = {}): HTMLElement {
  return h('div.wh',
    h('button.ib', { 'aria-label': opts.close ? 'Close' : 'Back', 'data-test': opts.close ? 'close' : 'back', onclick: () => (opts.close ? app.closeJourney() : app.back()) }, icon(opts.close ? ICON.close : ICON.back)),
    h('div.t', h('small', small), h('b', title)),
  );
}

function screenWith(app: App, head: HTMLElement, body: (HTMLElement | null)[], cta?: (HTMLElement | null)[]): HTMLElement {
  return h('section.screen', head, h('div.scroll', body), cta ? h('div.cta', cta) : null);
}

export function renderJourney(app: App, j: Journey): HTMLElement {
  const s = j.screen();
  switch (s.kind) {
    case 'position':
      return screenWith(app, top(app, app.bikeName, 'Before you start'), [
        h('h1.h2q', 'Which one?'),
        h('div.qopts', s.values.map((v) => h('button.opt', { 'data-test': `pos-${v}`, onclick: () => app.act((x) => x.answerPosition(s.param, v), 'next') }, h('span.ol', POSITION_LABEL[v] ?? v)))),
      ]);
    case 'question':
      return renderQuestion(app, j, s);
    case 'tool-question':
      return screenWith(app, top(app, app.bikeName, 'Before you start'), [
        h('h1.h2q', `Do you have this? ${app.c.toolName(s.tool)}`),
        h('div.qopts',
          h('button.opt', { onclick: () => app.act((x) => x.answerTool(s.tool, true), 'next') }, h('span.ol', 'Yes')),
          h('button.opt', { onclick: () => app.act((x) => x.answerTool(s.tool, false), 'next') }, h('span.ol', 'No')),
        ),
      ]);
    case 'choice':
      return renderChoice(app, s);
    case 'parts':
      return screenWith(app, top(app, app.bikeName, 'Before you start'), [
        h('h1.h2q', 'Parts you need'),
        h('ul.list', s.parts.map((p) => h('li', h('div.li', h('span.tx', h('b', p.name ?? p.id), p.note ? h('span', p.note) : null))))),
      ], [h('button.btn.primary.wide', { onclick: () => app.act((x) => x.partsOk(), 'next') }, 'I have them')]);
    case 'tools':
      return renderTools(app, j, s);
    case 'card':
      return renderCard(app, j, s.card);
    case 'exit':
      return renderExit(app, s);
    case 'not-covered':
      if (s.wrongBike) {
        // The why comes from the job's not_covered text; the line below it is only for when none matches.
        const change = app.canChangeBike;
        return screenWith(app, top(app, app.bikeName, 'End of this guide'), [
          h('h1.h2q', 'This guide does not fit this bike'),
          h('p', { 'data-test': 'why' }, s.message || 'This guide does not cover this bike yet.'),
          h('p.lead', change
            ? 'Choose another bike, or get help: a shop can do it, or ask the assistant.'
            : 'We do not show a guess. A shop can help, or ask the assistant.'),
        ], [
          change ? h('button.btn.primary.wide', { 'data-test': 'change-bike', onclick: () => app.changeBike() }, 'Choose another bike') : null,
          h(change ? 'button.btn.wide' : 'button.btn.primary.wide', { 'data-test': 'find-shop', onclick: () => app.act((x) => x.exitFindShop()) }, 'Find a shop'),
          h('button.btn.wide', { 'data-test': 'ask', onclick: () => app.openOverlay({ k: 'assistant' }) }, 'Ask the assistant'),
        ]);
      }
      return screenWith(app, top(app, app.bikeName, 'End of this guide'), [
        h('h1.h2q', 'Not covered yet'),
        h('p', s.message),
        h('p.lead', 'We do not show a guess. A shop can help, or ask the assistant.'),
      ], [
        h('button.btn.primary.wide', { 'data-test': 'find-shop', onclick: () => app.act((x) => x.exitFindShop()) }, 'Find a shop'),
        h('button.btn.wide', { 'data-test': 'ask', onclick: () => app.openOverlay({ k: 'assistant' }) }, 'Ask the assistant'),
      ]);
    case 'job':
      return renderJob(app, s);
    case 'shop':
      return renderShop(app, s.summary);
    case 'done':
      return screenWith(app, top(app, s.title, 'Done', { close: true }), [
        h('h1.h1', 'Done'),
        h('p.lead', `Nothing is left apart.${s.minutes ? ` That took about ${s.minutes} minutes of work.` : ''}`),
        s.askFixed ? h('h2.h2', 'Did it fix it?') : null,
      ], s.askFixed
        ? [
          h('button.btn.primary.wide', { 'data-test': 'fixed-yes', onclick: () => {
            app.closeJourney();
            app.toast('Nice work. Happy riding.');
          } }, 'Yes, it works'),
          h('button.btn.wide', { 'data-test': 'fixed-no', onclick: () => app.act((x) => x.notFixed(), 'next') }, 'No, still not right'),
        ]
        : [h('button.btn.primary.wide', { 'data-test': 'done', onclick: () => {
          app.closeJourney();
          app.toast('Nice work. Happy riding.');
        } }, 'Back to the start')]);
    case 'todo':
      return screenWith(app, top(app, s.title, 'Result', { close: true }), [
        h('h1.h1', s.items.length ? 'To do on this bike' : 'All looks fine'),
        s.items.length ? h('p.lead', 'Each item opens what you can do about it.') : h('p.lead', 'The check found nothing to do.'),
        h('ul.list', s.items.map((f) => {
          const st = app.c.inspection(f.inspection)?.states.find((x: any) => x.id === f.state);
          return h('li', h('button.li', { 'data-test': `todo-${f.job}`, onclick: () => app.act((x) => x.openTodo(f), 'next') },
            h('span.tx', h('b', app.c.jobTitle(f.job!)), h('span', st?.label ?? '')),
            f.urgency === 'do_not_ride' ? h('span.badge.warn', 'Do not ride') : h('span.badge', 'Soon'),
          ));
        })),
      ], [h('button.btn.primary.wide', { 'data-test': 'done', onclick: () => app.closeJourney() }, 'Done')]);
    case 'keep':
      return renderKeep(app, j, s);
    case 'closed':
      return h('section.screen');
  }
}

// ---------------------------------------------------------------- keep what the flow learned

function renderKeep(app: App, j: Journey, s: Extract<Screen, { kind: 'keep' }>): HTMLElement {
  const c = app.c;
  const label = (k: string) => c.t(c.fact(k)?.label) || k;
  const lines = s.learned.length
    ? h('ul.bul', { 'data-test': 'keep-facts' }, s.learned.map(([k, v]) => h('li', `${label(k)}: ${c.valueText(k, v)}`)))
    : null;
  // Side by side, so the name field keeps its room on a phone held sideways.
  const skip = h('button.btn', { 'data-test': 'keep-skip', onclick: () => app.act((x) => x.keepSkip(), 'next') }, 'Not now');
  if (s.bike) {
    return screenWith(app, top(app, s.bike, 'Before you go on'), [
      h('h1.h2q', `Save this to ${s.bike}?`),
      h('p.lead', 'The app learned this about your bike. Saved, it will not ask again.'),
      lines,
    ], [h('div.row2', skip, h('button.btn.primary', { 'data-test': 'keep-save', onclick: () => {
      app.act((x) => x.keepSave(), 'next');
      app.toast(`Saved to ${s.bike}`);
    } }, 'Save'))]);
  }
  const title = bikeTitle(j.bikeFacts);
  const name = h('input.text', { value: title, maxlength: 32, placeholder: 'e.g. Blue city bike', 'aria-label': 'Name of the bike', 'data-test': 'keep-name' }) as HTMLInputElement;
  const save = h('button.btn.primary', { 'data-test': 'keep-save', disabled: !title, onclick: () => {
    const n = name.value.trim();
    if (!n) return;
    app.act((x) => x.keepSave(n), 'next');
    const b = j.garageBike;
    if (b) {
      app.adoptSession(b);
      app.toast(`Added "${b.name}" to your garage`);
    }
  } }, 'Add to my garage') as HTMLButtonElement;
  name.addEventListener('input', () => (save.disabled = !name.value.trim()));
  name.addEventListener('keydown', (e) => e.key === 'Enter' && save.click());
  return screenWith(app, top(app, app.bikeName, 'Before you go on'), [
    h('h1.h2q', 'Keep this bike in your garage?'),
    h('p.lead', s.learned.length ? 'The app learned this about it. In your garage, it will not ask again.' : 'Then the to-do items found stay with it.'),
    lines,
    s.findings ? h('p.s', `${s.findings === 1 ? 'One finding' : `${s.findings} findings`} from this check go with it.`) : null,
    h('div.field', h('label', 'Name of the bike'), name),
  ], [h('div.row2', skip, save)]);
}

// ---------------------------------------------------------------- questions and pre-steps

function renderQuestion(app: App, j: Journey, s: Extract<Screen, { kind: 'question' }>): HTMLElement {
  const c = app.c;
  const f = s.fact;
  const q = f?.question;
  const values = c.factValues(s.key);
  const answer = (v: any) => app.act((x) => x.answerFact(s.key, v), 'next');
  const pic = q?.picture;
  const helpText = f?.help ? c.t(f.help) : '';
  const box = h('div.helpbox', { hidden: true, 'data-test': 'help-text' },
    h('p', helpText),
    h('p.s', 'Still not sure? The assistant can help.'),
  );
  const hb = h('button.helpbtn', {
    'aria-label': 'Help with this question', 'aria-expanded': 'false', 'data-test': 'help',
    onclick: () => {
      box.hidden = !box.hidden;
      hb.setAttribute('aria-expanded', String(!box.hidden));
    },
  }, '?');
  const body: (HTMLElement | null)[] = [h('div.qhead', h('h1.h2q', q ? c.t(q) : s.key), helpText ? hb : null), helpText ? box : null];
  if (values.length) {
    body.push(h('div.qopts', values.map((v) =>
      h('button.opt', { 'data-test': `answer-${v}`, onclick: () => answer(v) },
        pic ? h('span.pic', { 'aria-hidden': 'true' }, 'Picture') : null,
        h('span.ol', c.valueText(s.key, v)),
      ),
    )));
  } else {
    const inp = h('input.text', { type: f?.type === 'number' ? 'number' : 'text', 'aria-label': 'Your answer' }) as HTMLInputElement;
    body.push(inp, h('button.btn.primary.wide', { onclick: () => inp.value.trim() && answer(f?.type === 'number' ? Number(inp.value) : inp.value.trim()) }, 'Continue'));
  }
  body.push(h('button.link', { 'data-test': 'answer-unknown', onclick: () => answer(UNKNOWN) }, 'I\'ll check later'));
  return screenWith(app, top(app, app.bikeName, 'Before you start · one question'), body);
}

function renderChoice(app: App, s: Extract<Screen, { kind: 'choice' }>): HTMLElement {
  const c = app.c;
  const ch = s.choice;
  return screenWith(app, top(app, app.bikeName, 'Before you start'), [
    h('h1.h2q', ch.question),
    h('div.qopts', ch.options.map((o: any) =>
      h('button.opt', { 'data-test': `choice-${o.id}`, onclick: () => app.act((x) => x.choose(ch.id, o.id), 'next') },
        h('span.ol',
          h('span', o.label, o.recommended ? h('span.badge.ready', { style: 'margin-left:8px;vertical-align:2px' }, 'Recommended') : null),
          o.note ? h('small', o.note) : null,
          o.requires_tools?.length ? h('small', `Needs: ${o.requires_tools.map((t: string) => c.toolName(t)).join(', ')}`) : null,
          o.warning ? h('span.warn', o.warning) : null,
        ),
      ),
    )),
  ]);
}

function renderTools(app: App, j: Journey, s: Extract<Screen, { kind: 'tools' }>): HTMLElement {
  const c = app.c;
  const tick = (id: string) => {
    const t = c.tool(id);
    const on = s.ticked.includes(id);
    return h('button.tick', { role: 'checkbox', 'aria-checked': String(on), 'data-test': `tool-${id}`, onclick: () => app.act((x) => x.toggleTool(id)) },
      h('span.box', icon(ICON.check)),
      h('span.tx', h('b', c.toolName(id)), t?.substitutes?.length ? h('span', `Or: ${t.substitutes.map((x: any) => x.name).join('; ')}`) : null),
    );
  };
  // A set the bike's data has decided is one tool that is simply needed.
  const needed = [...s.required, ...s.oneOf.filter((u) => u.decided).flatMap((u) => u.options)];
  const open = s.oneOf.filter((u) => !u.decided);
  const count = (ids: string[]) => `${ids.filter((x) => s.ticked.includes(x)).length} of ${ids.length}`;
  /** one tier: a heading with what it means, the tools, and how many are ticked */
  const tier = (cls: string, title: string, sub: string | null, ids: string[]) => h(`section.tier.${cls}`, { 'data-test': `tier-${cls}` },
    h('div.tierhead', h('b', title), h('span.badge', count(ids))),
    sub ? h('p.s', sub) : null,
    h('div.group', ids.map(tick)),
  );
  const missing = needed.filter((x) => !s.ticked.includes(x));
  return screenWith(app, top(app, 'Your tools', 'Before you start'), [
    h('p.lead', 'Tick what you have. The guide uses this to pick its steps.'),
    needed.length ? tier('needed', 'Needed', 'The guide cannot be done properly without these.', needed) : null,
    ...open.map((u) => tier('oneof', 'One of these, depending on your bike', c.ix.tool_sets.get(u.set)?.tell_apart ?? 'Use the one that fits your bike.', u.options)),
    s.helpful.length ? tier('helpful', 'Helpful', 'Not needed, but they make it easier.', s.helpful) : null,
    missing.length ? h('div.note', h('span', 'Not ticked yet: '), h('strong', missing.map((x) => c.toolName(x)).join('; ')), h('span', '. Some steps need it. You can still start and read along, or take the bike to a shop.')) : null,
  ], [h('button.btn.primary.wide', { 'data-test': 'start', onclick: () => app.act((x) => x.startTutorial(), 'next') }, 'Start the guide')]);
}

// ---------------------------------------------------------------- card column

/**
 * The card column. The text box (one element for the whole app, `COL.guide`) scrolls through up to
 * three slots: the previous card above, the current card, and the next card below, each at least
 * as tall as the box and dimmed while it is not in view. The browser's own scrolling, with snap
 * points, moves between them: touch, touchpad, mouse wheel and keys alike, one card per gesture
 * (`scroll-snap-stop`). When the scroll comes to rest on a neighbour, the journey moves there
 * (`next`, `backCard`) and the column is filled again around the new card at the same place on
 * screen, so nothing jumps. A move made another way (Next, Back, an answer that goes on) fills
 * the column with the view where it was and then scrolls to the new card, so it looks the same.
 *
 * The neighbours come from `Journey.peekNext` and `peekBack`, so they are the very screens the
 * moves lead to. A card that still waits for an answer shows the top of the next card, which the
 * box does not stop on ('locked'): scrolling there springs back. Where the answers lead to
 * different cards (a diagnosis), nothing is shown below until the answer is given.
 *
 * The box stays in the page from card to card (`patchCard`): a touchpad gesture belongs to the
 * element it started on, and Chrome drops the rest of a gesture whose element was removed.
 */
const COL = {
  guide: null as HTMLElement | null,
  /** where the view is: the slot at the top of the box, and how far into it */
  anchor: null as { key: string; offset: number } | null,
  next: null as (() => void) | null,
  back: null as (() => void) | null,
  timer: 0,
  /**
   * The column is scrolling to the new card by itself (after Next, Back or an answer that goes on).
   * Until it gets there, a rest means nothing: the jump that starts it ends with a scrollend while
   * the view still shows the card it came from, which would read as scrolling back to it.
   */
  moving: null as { to: number; until: number } | null,
  /** the 3D view of each card in the column (none in text-only mode or for a screen that is no card) */
  views: {} as Partial<Record<'prev' | 'cur' | 'next', StageView>>,
  /** which of them the 3D view shows */
  shown: 'cur' as 'prev' | 'cur' | 'next',
  stage: null as { show(v: StageView): void } | null,
};

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HAS_SCROLLEND = typeof window !== 'undefined' && 'onscrollend' in window;

function guideEl(): HTMLElement {
  if (COL.guide) return COL.guide;
  const g = h('div.guide');
  let raf = 0;
  let lastScroll = 0;
  let touching = false;
  // Rest is the scrollend event, or (older Safari, or a touch the browser did not snap) a moment without scrolling.
  const restSoon = (ms: number) => {
    clearTimeout(COL.timer);
    COL.timer = window.setTimeout(() => {
      if (touching) return;
      if (performance.now() - lastScroll < ms - 20) restSoon(ms);
      else settle(g);
    }, ms);
  };
  g.addEventListener('scroll', () => {
    lastScroll = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => noteView(g));
    if (!HAS_SCROLLEND) restSoon(180);
  }, { passive: true });
  g.addEventListener('scrollend', () => settle(g));
  // The user's own gesture takes over from the column's scroll.
  for (const ev of ['wheel', 'pointerdown', 'keydown']) g.addEventListener(ev, () => (COL.moving = null), { passive: true });
  g.addEventListener('touchstart', () => {
    touching = true;
    COL.moving = null;
  }, { passive: true });
  const lift = () => {
    touching = false;
    restSoon(350);
  };
  g.addEventListener('touchend', lift, { passive: true });
  g.addEventListener('touchcancel', lift, { passive: true });
  COL.guide = g;
  return g;
}

const slotsOf = (g: HTMLElement) => [...g.children] as HTMLElement[];

/**
 * Remembers which slot the view is in, lights the slot in the middle of the box, and lets the 3D
 * view show the card the scroll is heading for (not while the column scrolls by itself).
 */
function noteView(g: HTMLElement): void {
  if (!g.isConnected) return;
  const top = g.scrollTop;
  const mid = top + g.clientHeight / 2;
  for (const s of slotsOf(g)) {
    if (top >= s.offsetTop - 1 && top < s.offsetTop + s.offsetHeight) COL.anchor = { key: s.dataset.key!, offset: Math.max(0, top - s.offsetTop) };
    s.classList.toggle('lit', mid >= s.offsetTop && mid < s.offsetTop + s.offsetHeight);
  }
  if (!COL.moving) showAhead(g);
}

type Role = 'prev' | 'cur' | 'next';

/**
 * Where the scroll would come to rest if let go now: on the current card, or on a neighbour once
 * the view is nearer that one's resting place (the browser's snapping decides the same way). A
 * locked next card is never a resting place. `end`: the current card's last resting place (a card
 * taller than the box rests anywhere from its top to there).
 */
function ahead(g: HTMLElement): { role: Role; cur: HTMLElement; end: number } | null {
  const cur = g.querySelector<HTMLElement>(':scope > .cur');
  if (!cur) return null;
  const top = g.scrollTop;
  const room = g.clientHeight;
  const end = cur.offsetTop + Math.max(0, cur.offsetHeight - room);
  const prev = cur.previousElementSibling as HTMLElement | null;
  const next = cur.nextElementSibling as HTMLElement | null;
  if (top > end + 4) {
    const go = next && !next.classList.contains('locked') && top - end > next.offsetTop - top;
    return { role: go ? 'next' : 'cur', cur, end };
  }
  if (top < cur.offsetTop - 4) {
    const prevEnd = prev ? prev.offsetTop + Math.max(0, prev.offsetHeight - room) : 0;
    return { role: prev && top - prevEnd < cur.offsetTop - top ? 'prev' : 'cur', cur, end };
  }
  return { role: 'cur', cur, end };
}

/**
 * The 3D view follows the scroll: as soon as letting go would land on a neighbour card, it shows
 * that card (camera, focus, animation), before the scroll has come to rest; back on the current
 * card, it shows that one again. The move itself waits for the rest; it then shows the same view,
 * so nothing restarts. A neighbour that is not a card leaves the view as it is.
 */
function showAhead(g: HTMLElement): void {
  const a = ahead(g);
  if (!a || a.role === COL.shown || !COL.stage) return;
  const v = COL.views[a.role];
  if (!v) return;
  COL.shown = a.role;
  COL.stage.show(v);
}

/**
 * The scroll came to rest. On a neighbour (the browser's snapping normally leaves it right on
 * one): the journey moves there. Between resting places: back onto the current card.
 */
function settle(g: HTMLElement): void {
  if (!g.isConnected) return;
  const top = g.scrollTop;
  if (COL.moving) {
    if (Math.abs(top - COL.moving.to) > 4 && performance.now() < COL.moving.until) return;
    COL.moving = null;
  }
  noteView(g);
  const a = ahead(g);
  if (!a) return;
  if (a.role === 'next') COL.next?.();
  else if (a.role === 'prev') COL.back?.();
  else if (top > a.end + 4 || top < a.cur.offsetTop - 4) {
    g.scrollTo({ top: top > a.end ? a.end : a.cur.offsetTop, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
}

/** Puts the slots in the box: the view stays where it was, then moves on to the current card (at once when `instant`). */
function fillColumn(g: HTMLElement, list: HTMLElement[], curKey: string, instant: boolean): void {
  const was = COL.anchor;
  g.replaceChildren(...list);
  const place = () => {
    const cur = list.find((s) => s.dataset.key === curKey)!;
    const from = was ? list.find((s) => s.dataset.key === was.key) : undefined;
    if (from && from !== cur && !instant && !from.classList.contains('locked')) {
      COL.moving = { to: cur.offsetTop, until: performance.now() + 1500 };
      g.scrollTop = from.offsetTop + was!.offset;
      g.scrollTo({ top: cur.offsetTop, behavior: reduceMotion() ? 'auto' : 'smooth' });
    } else {
      g.scrollTop = cur.offsetTop + (from === cur ? was!.offset : 0);
    }
    noteView(g);
  };
  // A new screen puts the box into the page only after this; place it then.
  if (g.isConnected) place();
  else queueMicrotask(place);
}

function slot(key: string, role: 'prev' | 'cur' | 'next', content: HTMLElement[], locked = false): HTMLElement {
  return h(`div.slot.${role}${role === 'cur' ? '.lit' : ''}${locked ? '.locked' : ''}`, {
    'data-key': key, inert: role !== 'cur', 'aria-hidden': role !== 'cur' ? 'true' : undefined,
  }, content);
}

const cardKey = (c: Card) => `card:${c.flow}:${c.id}`;

/** A neighbour as it will look: a card, or the heading of the screen after it. No test ids, no actions. */
function peekSlot(app: App, p: Peek, role: 'prev' | 'next', locked = false): HTMLElement {
  const s = p.screen;
  let body: HTMLElement;
  let key: string;
  if (s.kind === 'card') {
    body = cardBody(app, s.card, null);
    key = cardKey(s.card);
  } else {
    const title = s.kind === 'exit' ? EXIT_TITLE[s.exitKind] : p.title ?? '';
    body = h('div.step', h('h2', title), s.kind === 'exit' ? h('p', s.message) : null);
    key = `screen:${s.kind}:${title}`;
  }
  for (const x of [body, ...body.querySelectorAll('[data-test]')]) x.removeAttribute('data-test');
  return slot(key, role, locked ? [h('div.lockhint', 'Answer above to go on'), body] : [body], locked);
}

/**
 * A card's text: kicker, title, text, details, answers and the answer given. `live`: the actions
 * of the current card; null draws a neighbour (a div, so `article.step` is the current card only).
 */
function cardBody(app: App, card: Card, live: { tap: (id: string) => void; textOnly: boolean } | null): HTMLElement {
  const chosenBtn = card.buttons.find((b) => b.id === card.chosen);
  const textOnly = live?.textOnly ?? app.store.data.textOnly;
  const verdict = card.chosen !== undefined
    ? h(`div.verdict.${card.chosenTone === 'bad' ? 'bad' : card.chosenTone === 'good' ? 'good' : 'info'}`, { 'data-test': 'verdict' },
      h('b', card.chosenTone === 'bad' ? (card.nextEnabled && !card.nextAnswers ? 'Take note' : 'Fix this first') : 'Your answer'),
      h('strong', chosenBtn?.label ?? ''),
      card.chosenText ? h('p', card.chosenText) : null,
      card.nextAnswers && chosenBtn ? h('p.s', { 'data-test': 'fixed-hint' }, 'Once it is fixed, tap Next.') : null,
      h('div.actions',
        card.solution?.length ? h('button.btn.primary', { 'data-test': 'solution', onclick: live ? () => app.stage.playSolution(card.solution!) : undefined }, card.nextAnswers && !textOnly ? 'Play again' : 'Show solution') : null,
        h('button.link', { 'data-test': 'again', onclick: live ? () => app.act((x) => x.untap()) : undefined }, 'Choose again'),
      ),
      card.solution?.length && textOnly ? h('div.solution', card.solution.map((a: any) => h('span', `▶ ${a.caption ?? ''}`))) : null,
    )
    : null;
  return h(live ? 'article.step' : 'div.step', { 'data-test': `card-${card.id}`, 'data-flow': card.flowKind },
    h('div.kicker',
      h('span', `${card.kindLabel}${card.position ? ` · ${card.position.n} of ${card.position.of}` : ''}`),
      h('span.sp'),
      h('button.notebtn', { 'data-test': 'note', onclick: live ? () => app.openOverlay({ k: 'feedback' }) : undefined }, 'Note'),
    ),
    card.jumped ? h('p.jumpnote', 'You jumped ahead in this guide to put the bike back.') : null,
    card.warnings.map((w) => h('div.standing', w)),
    h('h2', card.title, card.safety ? h('span.tag', { 'data-test': 'safety-tag' }, 'Safety') : null),
    card.needs.length ? h('div.needs', `Needs: ${card.needs.join(', ')}`) : null,
    h('p', card.text),
    card.details.map((d) => h('p.detail', d)),
    card.buttons.length && card.chosen === undefined
      ? h('div.q', h('div.kicker', card.question ?? 'What do you see?'), card.buttons.map((b) => h('button.opt', { 'data-test': `btn-${b.id}`, onclick: live ? () => live.tap(b.id) : undefined }, b.label)))
      : null,
    verdict,
  );
}

/** Shows the card on the stage, fills the column, and builds the parts around it that change per card. */
/** What the 3D view shows for a card, with the bike's facts at that card. */
function stageView(app: App, card: Card, facts: Record<string, unknown>): StageView {
  return {
    id: `${card.flow}:${card.id}`, chosen: card.chosen, bike: app.bikeName,
    focus: card.stage.focus, show: card.stage.show, view: card.stage.view, animation: card.stage.animation, labels: card.stage.labels, labelsBefore: card.stage.labelsBefore, facts: facts as StageView['facts'],
  };
}

function cardParts(app: App, j: Journey, card: Card): { gtop: HTMLElement; progress: HTMLElement; pager: HTMLElement } {
  const textOnly = app.store.data.textOnly;
  const prev = j.peekBack();
  const next = j.peekNext();
  const viewOf = (p: Peek | null) => (p?.screen.kind === 'card' ? stageView(app, p.screen.card, p.facts) : undefined);
  COL.views = textOnly ? {} : { prev: viewOf(prev), cur: stageView(app, card, j.bikeFacts), next: next?.open ? viewOf(next) : undefined };
  COL.shown = 'cur';
  COL.stage = textOnly ? null : app.stage;
  if (COL.views.cur) app.stage.show(COL.views.cur);
  // On a card where Next answers, a problem's solution plays at once; the button replays it.
  const tap = (id: string) => {
    app.act((x) => x.tap(id));
    const s = app.journey?.screen();
    if (!textOnly && s?.kind === 'card' && s.card.nextAnswers && s.card.solution?.length) app.stage.playSolution(s.card.solution);
  };

  const list = [
    prev ? peekSlot(app, prev, 'prev') : null,
    slot(cardKey(card), 'cur', [cardBody(app, card, { tap, textOnly })]),
    next ? peekSlot(app, next, 'next', !next.open) : null,
  ].filter((x): x is HTMLElement => !!x);
  COL.next = () => app.act((x) => x.next(), 'next');
  COL.back = () => app.act((x) => x.backCard(), 'back');
  fillColumn(guideEl(), list, cardKey(card), app.instant);

  const flowTitle = card.flowKind === 'tutorial' ? app.c.jobTitle(app.c.ix.tutorials.get(card.flow)?.job ?? card.flow) : card.flowKind === 'diagnosis' ? app.c.ix.diagnoses.get(card.flow)?.symptom ?? card.flow : app.c.ix.checks.get(card.flow)?.title ?? card.flow;
  return {
    gtop: h('div.gtop',
      h('button.ib', { 'aria-label': 'Close', 'data-test': 'close', onclick: () => app.closeJourney() }, icon(ICON.close)),
      h('div.t', `${app.bikeName} · ${flowTitle}`),
      h('button.toggle', { 'aria-pressed': String(textOnly), 'data-test': 'text-only', onclick: () => app.setTextOnly(!textOnly) }, textOnly ? '3D view' : 'Text only'),
    ),
    progress: h('div.progress', { role: 'progressbar', 'aria-orientation': 'vertical', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(card.progress * 100) }, h('i', { style: `height:${Math.round(card.progress * 100)}%` })),
    pager: h('div.pager',
      h('button.btn', { 'data-test': 'back', onclick: () => app.back() }, 'Back'),
      h('button.btn.primary', { 'data-test': 'next', disabled: !card.nextEnabled, onclick: () => app.advance((x) => x.next(), 'next') }, card.nextLabel),
    ),
  };
}

function renderCard(app: App, j: Journey, card: Card): HTMLElement {
  const textOnly = app.store.data.textOnly;
  const p = cardParts(app, j, card);
  return h('section.screen.cardscreen', { 'data-textonly': String(textOnly) },
    p.gtop,
    h(`main.app${textOnly ? '.textonly' : ''}`,
      textOnly ? null : app.stage.el,
      h('section.side.cardside', p.progress, h('div.sidemain', guideEl(), p.pager)),
    ),
  );
}

/**
 * From one card to another (or the same card after a tap), the screen is updated in place instead
 * of being built anew, so the text box stays in the page. False when the screen is not a card, or
 * the last screen was not one in the same layout; then the app renders as usual.
 */
export function patchCard(app: App): boolean {
  const s = app.journey?.screen();
  if (!app.journey || s?.kind !== 'card') return false;
  const old = app.root.querySelector<HTMLElement>(':scope > section.cardscreen');
  if (!old || app.root.querySelector(':scope > .modal') || old.dataset.textonly !== String(app.store.data.textOnly) || !COL.guide?.isConnected) return false;
  const p = cardParts(app, app.journey, s.card);
  old.querySelector('.gtop')?.replaceWith(p.gtop);
  old.querySelector('.cardside > .progress')?.replaceWith(p.progress);
  old.querySelector('.sidemain > .pager')?.replaceWith(p.pager);
  return true;
}

// ---------------------------------------------------------------- exits, job, shop

function renderExit(app: App, s: Extract<Screen, { kind: 'exit' }>): HTMLElement {
  const buttons: (HTMLElement | null)[] = [];
  if (s.canJump) buttons.push(h('button.btn.primary.wide', { 'data-test': 'show-how', onclick: () => app.act((x) => x.exitShowHow(), 'next') }, 'Show me how to put it back'));
  if (s.exitKind === 'not_needed') {
    buttons.push(h(`button.btn${s.canJump ? '' : '.primary'}.wide`, { 'data-test': 'done', onclick: () => app.closeJourney() }, 'Done'));
  } else {
    buttons.push(h(`button.btn${s.canJump ? '' : '.primary'}.wide`, { 'data-test': 'find-shop', onclick: () => app.act((x) => x.exitFindShop()) }, 'Find a shop'));
  }
  if (s.exitKind === 'not_covered') buttons.push(h('button.btn.wide', { 'data-test': 'ask', onclick: () => app.openOverlay({ k: 'assistant' }) }, 'Ask the assistant'));
  const head = top(app, app.bikeName, s.exitKind === 'unsafe' ? 'Stop' : 'End of this guide');
  const body = [
    h('h1.h2q', EXIT_TITLE[s.exitKind]),
    h(`p${s.exitKind === 'unsafe' ? '.note.bad' : ''}`, s.message),
    s.putBack.length ? h('div.section', h('span.eyebrow', 'Still to put back'), h('ul.bul', s.putBack.map((p) => h('li', p)))) : null,
    s.canBack ? h('button.link', { 'data-test': 'back-to-step', onclick: () => app.back() }, 'Back to the step') : null,
  ];
  // With something still apart, the stage shows the bike as it is held now (in the stand, hung,
  // upside down), so the user sees what to undo. Optional: the text reads the same without it.
  if (!s.labels.length || app.store.data.textOnly) return screenWith(app, head, body, buttons);
  app.stage.show({ id: `exit:${s.labels.join(',')}`, bike: app.bikeName, focus: [], labels: s.labels, labelsBefore: s.labels, facts: (app.journey?.bikeFacts ?? {}) });
  return h('section.screen', head,
    h('main.app.exitapp', app.stage.el, h('section.side', h('div.scroll', body), h('div.cta', buttons))),
  );
}

function renderJob(app: App, s: Extract<Screen, { kind: 'job' }>): HTMLElement {
  return screenWith(app, top(app, app.bikeName, 'What now?'), [
    h('h1.h2q', s.job.title),
    s.urgency === 'do_not_ride' ? h('div.note.bad', 'Do not ride the bike until this is fixed.') : null,
    s.findings.length ? h('div.section', h('span.eyebrow', 'What was found'), h('ul.bul', s.findings.map((f) => h('li', f)))) : null,
    s.diy
      ? h('button.card', { 'data-test': 'diy', onclick: () => app.act((x) => x.jobDiy(), 'next') },
        h('div.top', h('b.t', 'Do it myself'), h('span.badge.ready', 'Guide')),
        h('span.s', `${s.diy.minutes ? `About ${s.diy.minutes} for this bike` : 'Time depends on your bike'}${s.diy.difficulty ? ` · difficulty ${s.diy.difficulty} of 3` : ''}`),
      )
      : h('div.note', 'There is no guide for this yet. A shop can do it.'),
    h('button.card', { 'data-test': 'shop', onclick: () => app.act((x) => x.jobShop(), 'next') },
      h('div.top', h('b.t', 'Take it to a shop'), h('span.badge', s.price === 'no estimate yet' ? 'Price: no estimate yet' : s.price)),
      h('span.s', 'Tell the mechanic:'),
      h('span', `"${s.tell}"`),
    ),
  ]);
}

export function summaryText(s: ShopSummary): string {
  return [
    `Bike: ${s.bike}`,
    ...s.facts.map((f) => `  ${f}`),
    `Job: ${s.title}`,
    s.tell ? `Tell the mechanic: ${s.tell}` : '',
    ...s.findings.map((f) => `Found: ${f}`),
    ...s.extra,
    ...s.stillSet.map((x) => `Still to do before riding: ${x}`),
    s.price ? `Price: ${s.price}` : '',
  ].filter(Boolean).join('\n');
}

function renderShop(app: App, s: ShopSummary): HTMLElement {
  const text = summaryText(s);
  return screenWith(app, top(app, app.bikeName, 'For the shop'), [
    h('h1.h2q', 'Show this to the mechanic'),
    h('div.card.summary', { 'data-test': 'shop-summary' },
      h('dl',
        h('dt', 'Bike'), h('dd', s.bike),
        h('dt', 'Job'), h('dd', s.title),
        s.tell ? [h('dt', 'Tell them'), h('dd', s.tell)] : null,
        s.price ? [h('dt', 'Price'), h('dd', s.price)] : null,
      ),
      s.findings.length ? h('ul.bul', s.findings.map((f) => h('li', `Found: ${f}`))) : null,
      s.extra.length ? h('ul.bul', s.extra.map((f) => h('li', f))) : null,
      s.facts.length ? h('details', h('summary.s', 'What we know about the bike'), h('ul.bul', s.facts.map((f) => h('li', f)))) : null,
    ),
    s.stillSet.length ? h('div.note.bad', `Before you ride: ${s.stillSet.join(' ')}`) : null,
    h('div.note', 'Finding a shop near you is not built yet in this test build.'),
  ], [
    h('button.btn.wide', { onclick: async () => {
      try {
        await navigator.clipboard.writeText(text);
        app.toast('Copied');
      } catch {
        app.toast('Copy is not available here');
      }
    } }, 'Copy summary'),
    h('button.btn.primary.wide', { 'data-test': 'done', onclick: () => app.closeJourney() }, 'Done'),
  ]);
}
