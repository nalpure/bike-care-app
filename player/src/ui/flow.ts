// Every screen of a journey: questions, run choices, tools, cards, exits, job, shop summary, done.
// One card component serves inspections, steps and checks.

import { UNKNOWN } from '../../../tools/lib/conditions.js';
import type { Card, Journey, Screen, ShopSummary } from '../engine/journey.js';
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

// ---------------------------------------------------------------- card

function renderCard(app: App, j: Journey, card: Card): HTMLElement {
  const textOnly = app.store.data.textOnly;
  if (!textOnly) {
    app.stage.show({
      id: `${card.flow}:${card.id}`, chosen: card.chosen, bike: app.bikeName,
      focus: card.stage.focus, view: card.stage.view, animation: card.stage.animation, labels: card.stage.labels, labelsBefore: card.stage.labelsBefore, facts: (app.journey?.bikeFacts ?? {}),
    });
  }

  const chosenBtn = card.buttons.find((b) => b.id === card.chosen);
  const verdict = card.chosen !== undefined
    ? h(`div.verdict.${card.chosenTone === 'bad' ? 'bad' : card.chosenTone === 'good' ? 'good' : 'info'}`, { 'data-test': 'verdict' },
      h('b', card.chosenTone === 'bad' ? (card.nextEnabled ? 'Take note' : 'Fix this first') : 'Your answer'),
      h('strong', chosenBtn?.label ?? ''),
      card.chosenText ? h('p', card.chosenText) : null,
      h('div.actions',
        card.solution?.length ? h('button.btn.primary', { 'data-test': 'solution', onclick: () => app.stage.playSolution(card.solution!) }, 'Show solution') : null,
        h('button.link', { 'data-test': 'again', onclick: () => app.act((x) => x.untap()) }, 'Choose again'),
      ),
      card.solution?.length && textOnly ? h('div.solution', card.solution.map((a: any) => h('span', `▶ ${a.caption ?? ''}`))) : null,
    )
    : null;

  const step = h(`article.step${app.moved === 'next' ? '.in-next' : app.moved === 'back' ? '.in-back' : ''}`, { 'data-test': `card-${card.id}`, 'data-flow': card.flowKind },
    h('div.kicker',
      h('span', `${card.kindLabel}${card.position ? ` · ${card.position.n} of ${card.position.of}` : ''}`),
      h('span.sp'),
      h('button.notebtn', { 'data-test': 'note', onclick: () => app.openOverlay({ k: 'feedback' }) }, 'Note'),
    ),
    card.jumped ? h('p.jumpnote', 'You jumped ahead in this guide to put the bike back.') : null,
    card.warnings.map((w) => h('div.standing', w)),
    h('h2', card.title),
    card.needs.length ? h('div.needs', `Needs: ${card.needs.join(', ')}`) : null,
    h('p', card.text),
    card.details.map((d) => h('p.detail', d)),
    card.buttons.length && card.chosen === undefined
      ? h('div.q', h('div.kicker', card.question ?? 'What do you see?'), card.buttons.map((b) => h('button.opt', { 'data-test': `btn-${b.id}`, onclick: () => app.act((x) => x.tap(b.id)) }, b.label)))
      : null,
    verdict,
  );

  const guide = h('div.guide', step);
  attachSwipeUp(guide, () => card.nextEnabled && app.advance((x) => x.next(), 'next'));

  const appEl = h(`main.app${textOnly ? '.textonly' : ''}`,
    textOnly ? null : app.stage.el,
    h('section.side.cardside',
      h('div.progress', { role: 'progressbar', 'aria-orientation': 'vertical', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(card.progress * 100) }, h('i', { style: `height:${Math.round(card.progress * 100)}%` })),
      h('div.sidemain',
        guide,
        h('div.pager',
          h('button.btn', { 'data-test': 'back', onclick: () => app.back() }, 'Back'),
          h('button.btn.primary', { 'data-test': 'next', disabled: !card.nextEnabled, onclick: () => app.advance((x) => x.next(), 'next') }, card.nextLabel),
        ),
      ),
    ),
  );
  const flowTitle = card.flowKind === 'tutorial' ? app.c.jobTitle(app.c.ix.tutorials.get(card.flow)?.job ?? card.flow) : card.flowKind === 'diagnosis' ? app.c.ix.diagnoses.get(card.flow)?.symptom ?? card.flow : app.c.ix.checks.get(card.flow)?.title ?? card.flow;
  return h('section.screen',
    h('div.gtop',
      h('button.ib', { 'aria-label': 'Close', 'data-test': 'close', onclick: () => app.closeJourney() }, icon(ICON.close)),
      h('div.t', `${app.bikeName} · ${flowTitle}`),
      h('button.toggle', { 'aria-pressed': String(textOnly), 'data-test': 'text-only', onclick: () => app.setTextOnly(!textOnly) }, textOnly ? '3D view' : 'Text only'),
    ),
    appEl,
  );
}

/**
 * Swipe up on the text for the next step. Only a swipe that starts when the text is already
 * scrolled to its end counts, and only if the text did not scroll during it, so reading a long step
 * never moves on by itself. The 3D view is outside `el`, so dragging it never counts. Touch events,
 * because the browser takes over a vertical drag as a scroll and then sends no pointer events.
 */
function attachSwipeUp(el: HTMLElement, onNext: () => void): void {
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let top0 = 0;
  let armed = false;
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    armed = e.touches.length === 1 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = performance.now();
    top0 = el.scrollTop;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!armed) return;
    armed = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (dy < -60 && Math.abs(dy) > Math.abs(dx) * 1.5 && performance.now() - t0 < 900 && Math.abs(el.scrollTop - top0) < 2) onNext();
  });
  el.addEventListener('touchcancel', () => (armed = false));
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
