// Home, garage, bike sheet, shop placeholder and feedback notes.

import { UNKNOWN, type Value } from '../../../tools/lib/conditions.js';
import type { Bike } from '../engine/store.js';
import type { App } from './app.js';
import { h, icon, ICON } from './dom.js';
import { redBanner } from './bike.js';
import { swipeRow } from './swipe.js';

function header(app: App, title: string, small: string, onBack: () => void): HTMLElement {
  return h('div.wh', h('button.ib', { 'aria-label': 'Back', onclick: onBack }, icon(ICON.back)), h('div.t', h('small', small), h('b', title)));
}

function brand(app: App, title: string): HTMLElement {
  return h('div.brandrow', h('span.brand', title), h('button.demo', { onclick: () => app.openOverlay({ k: 'notice' }) }, 'Test build'));
}

/** One line about what is known: "Road or gravel bike · derailleur …". */
export function bikeSummary(app: App, b: Bike): string {
  // Name facts and the colour say nothing new next to the name; geometry is for the bike page.
  const skip = (k: string) => /^bike\.(brand|model|line|year|colour)$/.test(k) || k.startsWith('geometry.') || k.endsWith('_model');
  const known = Object.entries(b.facts).filter(([k, v]) => String(v) !== UNKNOWN && !skip(k));
  if (!known.length) return 'Nothing known yet. The app asks when it needs to.';
  return known.slice(0, 4).map(([k, v]) => app.c.valueText(k, v)).join(' · ');
}

function urgencyBadge(u?: string): HTMLElement | null {
  if (u === 'do_not_ride') return h('span.badge.warn', 'Do not ride');
  if (u === 'soon') return h('span.badge', 'Soon');
  return null;
}

// ---------------------------------------------------------------- home

export function renderHome(app: App): HTMLElement {
  const c = app.c;
  const todos = app.store.garage().flatMap((b) => app.store.todos(b).map((f) => ({ b, f })));
  const row = (title: string, sub: string, onclick: () => void, badge?: HTMLElement | null, test?: string) =>
    h('li', h('button.li', { onclick, 'data-test': test }, h('span.tx', h('b', title), sub ? h('span', sub) : null), badge ?? null));

  return h('section.screen',
    brand(app, 'Repair'),
    h('div.scroll',
      todos.length
        ? h('div.section',
          h('span.eyebrow', 'To do'),
          h('ul.list', todos.map(({ b, f }) => {
            const st = c.inspection(f.inspection)?.states.find((x: any) => x.id === f.state);
            return row(c.jobTitle(f.job!), [b.name, st?.label].filter(Boolean).join(' · '), () => app.openTodo(b, f), urgencyBadge(f.urgency), `todo-${f.job}`);
          })),
        )
        : null,
      h('h1.h1', 'What is wrong?'),
      h('ul.list', c.diagnoses().map((d) => row(d.symptom, 'A few checks to find the cause', () => app.start({ diagnosis: d.id }), null, `diagnosis-${d.id}`))),
      h('div.section',
        h('span.eyebrow', 'Guides'),
        h('ul.list', c.tutorialJobs().map((j) => {
          const t = c.ix.tutorials.get(j.tutorial);
          return row(j.title, t?.difficulty ? `Difficulty ${t.difficulty} of 3` : '', () => app.start({ tutorial: j.tutorial }), h('span.badge.ready', 'Guide'), `tutorial-${j.tutorial}`);
        })),
      ),
      c.routineCheck()
        ? h('div.section',
          h('span.eyebrow', 'Check the whole bike'),
          h('ul.list', row(c.routineCheck().title, 'Look over the bike. Anything that needs work lands on its to-do list.', () => app.start({ check: c.routineCheck().id }), null, 'routine')),
        )
        : null,
      h('p.lead', 'Not sure what is wrong? Ask the assistant with the button at the bottom right.'),
    ),
  );
}

// ---------------------------------------------------------------- garage

/** Pictures drawn once per bike and its facts; drawing is cheap but a list redraws often. */
const thumbs = new Map<string, string | null>();

function thumb(app: App, b: Bike): HTMLElement | null {
  if (!app.stage.snapshot) return null;
  const key = JSON.stringify([b.id, b.name, b.facts]);
  if (!thumbs.has(key)) {
    if (thumbs.size > 40) thumbs.clear();
    thumbs.set(key, app.stage.snapshot(b.facts, 240, 150, b.name));
  }
  const url = thumbs.get(key);
  return url ? h('img.thumb', { src: url, alt: '', width: 120, height: 75 }) : null;
}

export function renderGarage(app: App): HTMLElement {
  const name = h('input.text', { placeholder: 'Name, e.g. Blue city bike', maxlength: 32, 'aria-label': 'Name of the new bike', 'data-test': 'new-bike-name' }) as HTMLInputElement;
  const add = () => {
    if (!name.value.trim()) return;
    const b = app.store.addBike(name.value);
    app.toast(`Added "${b.name}" to your garage`);
    app.go({ k: 'bike', id: b.id });
  };
  name.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  const card = (b: Bike) => {
    const todos = app.store.todos(b).length;
    return swipeRow(
      h('button.card.bikecard', { onclick: () => app.go({ k: 'bike', id: b.id }), 'data-test': `bike-${b.id}` },
        thumb(app, b),
        h('span.tx',
          h('div.top', h('b.t', b.name), todos ? h('span.badge', `${todos} to do`) : null),
          h('span.s', bikeSummary(app, b)),
          redBanner(app, b),
        ),
      ),
      h('button.del', { 'aria-label': `Delete ${b.name}`, 'data-test': `delete-${b.id}`, onclick: () => app.confirmDelete(b) }, icon(ICON.trash), 'Delete'),
      `row-${b.id}`,
    );
  };
  const bikes = app.store.garage();
  return h('section.screen',
    brand(app, 'Garage'),
    h('div.scroll',
      h('p.lead', bikes.length ? 'Your bikes. Swipe a bike to the left to delete it.' : 'No bikes yet. A bike needs only a name; the app learns the rest as you use it.'),
      h('div.bikes', bikes.map(card)),
      h('div.field',
        h('label', 'Add a bike'),
        name,
        h('button.btn.primary.wide', { onclick: add, 'data-test': 'add-bike' }, 'Add bike'),
      ),
      h('button.link', { 'data-test': 'reset-garage', onclick: () => app.openOverlay({
        k: 'confirm',
        title: 'Reset the test garage?',
        text: 'All bikes go back to the test bikes as they come with this build. Your notes stay.',
        ok: 'Reset',
        run: () => {
          app.store.reset();
          app.toast('The garage is back to the test bikes');
        },
      }) }, 'Reset the test garage'),
    ),
  );
}

// ---------------------------------------------------------------- shop (placeholder)

export function renderShopTab(app: App): HTMLElement {
  return h('section.screen',
    brand(app, 'Shop'),
    h('div.scroll',
      h('p.lead', 'Parts that fit your bike and local repair shops will appear here.'),
      h('div.note', 'Not built yet in this test build.'),
    ),
  );
}

// ---------------------------------------------------------------- feedback notes

export function notesText(app: App): string {
  const notes = app.store.data.notes;
  const L = [`Feedback notes (${notes.length}) · content ${app.c.bundle.content_hash}`, ''];
  notes.forEach((n, i) => {
    L.push(`#${i + 1} · ${n.date.slice(0, 16).replace('T', ' ')}`);
    L.push(`Note: ${n.text}`);
    if (n.flow) L.push(`Flow: ${n.flow}`);
    if (n.item) L.push(`Step: ${n.item}`);
    if (n.unit) L.push(`Review unit: ${n.unit}`);
    if (n.path.length) L.push(`Path: ${n.path.join(' > ')}`);
    L.push(`Bike: ${n.bike}; ${Object.entries(n.facts).map(([k, v]) => `${k}=${v}`).join(', ') || 'no facts'}`);
    L.push('');
  });
  return L.join('\n');
}

export function renderNotes(app: App): HTMLElement {
  const notes = app.store.data.notes;
  const text = notesText(app);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      app.toast('Copied. Paste it into a message to the team.');
    } catch {
      const ta = document.querySelector<HTMLTextAreaElement>('[data-test="notes-export"]');
      ta?.select();
      app.toast('Select the text and copy it.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Feedback notes', text });
    } catch {
      /* the user closed the share sheet, or sharing is not available */
    }
  };
  return h('section.screen',
    brand(app, 'Notes'),
    h('div.scroll',
      h('p.lead', 'Your feedback on this test build. Tap "Note" on any step to add one. Send them to the team when you are done.'),
      notes.length
        ? h('ul.list', notes.map((n) => h('li', h('div.li', h('span.tx', h('b', n.text), h('span', [n.unit ?? n.flow ?? 'general', n.date.slice(0, 10)].join(' · ')))))))
        : h('div.note', 'No notes yet.'),
      notes.length ? h('div.field',
        h('span.lbl', 'Text to send'),
        h('textarea.text', { readonly: true, rows: 8, 'data-test': 'notes-export' }, text),
        h('div.row2',
          h('button.btn.primary', { onclick: copy, 'data-test': 'notes-copy' }, 'Copy all'),
          typeof navigator.share === 'function' ? h('button.btn', { onclick: share }, 'Share') : null,
        ),
        h('button.link', { onclick: () => {
          if (confirm('Delete all notes on this phone?')) {
            app.store.clearNotes();
            app.render();
          }
        } }, 'Delete all notes'),
      ) : null,
    ),
  );
}
