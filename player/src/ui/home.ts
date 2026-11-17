// Home, garage, bike sheet, shop placeholder and feedback notes.

import { UNKNOWN, type Value } from '../../../tools/lib/conditions.js';
import { UNKNOWN_BIKE, type Bike } from '../engine/store.js';
import type { App } from './app.js';
import { h, icon, ICON } from './dom.js';

function header(app: App, title: string, small: string, onBack: () => void): HTMLElement {
  return h('div.wh', h('button.ib', { 'aria-label': 'Back', onclick: onBack }, icon(ICON.back)), h('div.t', h('small', small), h('b', title)));
}

function brand(app: App, title: string): HTMLElement {
  return h('div.brandrow', h('span.brand', title), h('button.demo', { onclick: () => app.openOverlay({ k: 'notice' }) }, 'Test build'));
}

/** One line about what is known: "Road or gravel bike · derailleur …". */
export function bikeSummary(app: App, b: Bike): string {
  const known = Object.entries(b.facts).filter(([, v]) => String(v) !== UNKNOWN);
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
  const b = app.bike;
  const todos = app.store.todos(b);
  const row = (title: string, sub: string, onclick: () => void, badge?: HTMLElement | null, test?: string) =>
    h('li', h('button.li', { onclick, 'data-test': test }, h('span.tx', h('b', title), sub ? h('span', sub) : null), badge ?? null));

  return h('section.screen',
    brand(app, 'Repair'),
    h('div.scroll',
      h('button.card', { onclick: () => app.go({ k: 'garage' }), 'data-test': 'bike-card' },
        h('div.top', h('span.eyebrow', 'Bike in use'), h('span.link', 'Change')),
        h('b.t', b.name),
        h('span.s', bikeSummary(app, b)),
      ),
      todos.length
        ? h('div.section',
          h('span.eyebrow', 'To do on this bike'),
          h('ul.list', todos.map((f) => {
            const st = c.inspection(f.inspection)?.states.find((x: any) => x.id === f.state);
            return row(c.jobTitle(f.job!), st?.label ?? '', () => app.openTodo(f), urgencyBadge(f.urgency), `todo-${f.job}`);
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

export function renderGarage(app: App): HTMLElement {
  const name = h('input.text', { placeholder: 'Name, e.g. Blue city bike', maxlength: 32, 'aria-label': 'Name of the new bike', 'data-test': 'new-bike-name' }) as HTMLInputElement;
  const add = () => {
    const b = app.store.addBike(name.value);
    app.toast(`Added "${b.name}" to your garage`);
    app.go({ k: 'bike', id: b.id });
  };
  name.addEventListener('keydown', (e) => e.key === 'Enter' && add());
  const unknown = app.store.bike(UNKNOWN_BIKE)!;
  const card = (b: Bike) =>
    h('button.card', { onclick: () => app.go({ k: 'bike', id: b.id }), 'data-test': `bike-${b.id}` },
      h('div.top', h('b.t', b.name), app.store.data.current === b.id ? h('span.badge.ready', 'In use') : null),
      h('span.s', bikeSummary(app, b)),
      app.store.todos(b).length ? h('span.s', `${app.store.todos(b).length} to do`) : null,
    );
  return h('section.screen',
    brand(app, 'Garage'),
    h('div.scroll',
      h('p.lead', 'Your bikes. A bike needs only a name; the app learns the rest as you use it.'),
      h('div.bikes', app.store.garage().map(card), Object.keys(unknown.facts).length || unknown.findings.length || app.store.data.current === UNKNOWN_BIKE ? card(unknown) : null),
      h('div.field',
        h('label', 'Add a bike'),
        name,
        h('button.btn.primary.wide', { onclick: add, 'data-test': 'add-bike' }, 'Add bike'),
      ),
    ),
  );
}

export function renderBike(app: App, id: string): HTMLElement {
  const c = app.c;
  const b = app.store.bike(id);
  if (!b) return renderGarage(app);
  const isUnknown = b.id === UNKNOWN_BIKE;
  const nameInput = h('input.text', { value: isUnknown ? '' : b.name, maxlength: 32, placeholder: 'Name this bike', 'aria-label': 'Bike name', 'data-test': 'bike-name' }) as HTMLInputElement;
  nameInput.addEventListener('change', () => {
    if (isUnknown) {
      if (!nameInput.value.trim()) return;
      const nb = app.store.nameUnknownBike(nameInput.value);
      app.go({ k: 'bike', id: nb.id });
      return;
    }
    b.name = nameInput.value.trim() || b.name;
    app.store.save();
  });

  const editor = (key: string, f: any) => {
    const cur = b.facts[key];
    const set = (v: Value | undefined) => {
      app.store.setFact(b, key, v);
      app.render();
    };
    const values = c.factValues(key);
    if (values.length) {
      return h('div.chips', { role: 'group' },
        values.map((v) => h('button.cb', { 'aria-pressed': String(String(cur) === String(v)), onclick: () => set(v), 'data-test': `fact-${key}-${v}` }, c.valueText(key, v))),
        h('button.cb', { 'aria-pressed': String(cur === undefined), onclick: () => set(undefined) }, 'Not known'),
      );
    }
    const inp = h('input.text', { value: cur === undefined ? '' : String(cur), type: f.type === 'number' ? 'number' : 'text', 'aria-label': key, 'data-test': `fact-${key}` }) as HTMLInputElement;
    inp.addEventListener('change', () => {
      const raw = inp.value.trim();
      set(raw === '' ? undefined : f.type === 'number' ? Number(raw) : raw);
    });
    return inp;
  };

  const facts = [...c.ix.facts.values()];
  // No short fact label in the bundle yet (SR-02): the question, or the key made readable.
  const label = (f: any) => {
    if (f.question) return c.t(f.question);
    const last = String(f.key).split('.').pop()!.replace(/_/g, ' ');
    return last.charAt(0).toUpperCase() + last.slice(1);
  };
  const todos = app.store.todos(b);
  return h('section.screen',
    header(app, isUnknown ? 'Unknown bike' : b.name, 'Garage', () => app.go({ k: 'garage' })),
    h('div.scroll',
      h('div.field', h('label', isUnknown ? 'Give this bike a name to keep it in your garage' : 'Name'), nameInput),
      app.store.data.current === b.id
        ? h('div.note', 'This is the bike in use. Guides and checks use what is known here.')
        : h('button.btn.primary.wide', { onclick: () => {
          app.store.use(b.id);
          app.go({ k: 'home' });
        }, 'data-test': 'use-bike' }, 'Use this bike'),
      todos.length ? h('div.section', h('span.eyebrow', 'To do'), h('ul.list', todos.map((f) => h('li', h('button.li', { onclick: () => {
        app.store.use(b.id);
        app.openTodo(f);
      } }, h('span.tx', h('b', c.jobTitle(f.job!)), h('span', `Found ${f.date}`)), urgencyBadge(f.urgency)))))) : null,
      h('div.section',
        h('span.eyebrow', 'What the app knows about this bike'),
        h('p.s', 'Facts fill in as guides ask. You can change them here.'),
        h('div.group', facts.map((f) =>
          h('div.field', { style: 'padding:12px 0' },
            h('span.lbl', label(f)),
            f.ask === 'never' ? h('span.s', 'Never asked. Set it only if you know it from the bike\'s papers.') : null,
            editor(f.key, f),
          ),
        )),
      ),
      !isUnknown ? h('button.link', { onclick: () => {
        if (confirm(`Remove ${b.name} from the garage?`)) {
          app.store.removeBike(b.id);
          app.go({ k: 'garage' });
        }
      } }, 'Remove this bike') : null,
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
