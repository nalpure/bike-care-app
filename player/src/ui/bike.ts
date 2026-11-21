// The bike page: a 3D preview on top, then four tabs: characteristics (one line per fact),
// components (the facts by group), geometry (a table and a 2D drawing) and service (a traffic
// light per job). Everything about the bike comes from the bundle: fact labels, groups, ranges,
// jobs and their service intervals.

import type { Value } from '../../../tools/lib/conditions.js';
import { fitProblem, numberProblem } from '../engine/bikes.js';
import { redItems, serviceItems, type Light, type ServiceItem } from '../engine/service.js';
import { today, type Bike } from '../engine/store.js';
import type { App } from './app.js';
import { GROUP_ICON, h, icon, ICON } from './dom.js';
import { renderSchematic } from './schematic.js';

export type BikeTab = 'characteristics' | 'components' | 'geometry' | 'service';

const TABS: Array<[BikeTab, string]> = [
  ['characteristics', 'Facts'],
  ['components', 'Components'],
  ['geometry', 'Geometry'],
  ['service', 'Service'],
];

/** What the page has open. Kept while the user stays on the same bike. */
const ui = { id: '', tab: 'characteristics' as BikeTab, group: null as string | null, edit: null as string | null, sel: null as string | null };

/** The facts the stage was last asked to preview, so a redraw of the page does not restart the 3D view. */
let previewSig = '';
export function endPreview(app: App): void {
  previewSig = '';
  app.stage.endPreview?.();
}

const groupOf = (key: string) => key.split('.')[0];
const isModel = (key: string) => key.endsWith('_model');
/** facts that are drawn or set elsewhere on the page */
const elsewhere = (key: string) => key === 'bike.colour';

function unitText(unit?: string): string {
  return unit === 'deg' ? '°' : unit ? ` ${unit}` : '';
}

function shown(app: App, f: any, v: Value | undefined): string {
  if (v === undefined || String(v) === 'unknown') return 'unknown';
  return `${app.c.valueText(f.key, v)}${f.type === 'number' && !app.c.factValues(f.key).length ? unitText(f.unit) : ''}`;
}

const label = (app: App, f: any) => app.c.t(f.label) || f.key;

// ---------------------------------------------------------------- red banner

/** One line when a job is overdue or a finding says not to ride; null when nothing is red. */
export function redText(app: App, b: Bike): string | null {
  const items = redItems(b, [...app.c.ix.jobs.values()], today());
  if (!items.length) return null;
  return items.map((i) => app.c.jobTitle(i.job)).join(', ');
}

export function redBanner(app: App, b: Bike): HTMLElement | null {
  const t = redText(app, b);
  return t ? h('div.note.bad', { role: 'status', 'data-test': 'red-banner' }, h('b', 'Needs attention: '), t) : null;
}

// ---------------------------------------------------------------- editing one fact

function editor(app: App, b: Bike, f: any): HTMLElement {
  const key: string = f.key;
  const cur = b.facts[key];
  const set = (v: Value | undefined) => {
    app.store.setFact(b, key, v);
    ui.edit = null;
    app.render();
  };
  const values = app.c.factValues(key);
  if (values.length) {
    return h('div.chips', { role: 'group', 'aria-label': label(app, f) },
      values.map((v) => h('button.cb', { 'aria-pressed': String(String(cur) === String(v)), onclick: () => set(v), 'data-test': `fact-${key}-${v}` }, app.c.valueText(key, v))),
      h('button.cb', { 'aria-pressed': String(cur === undefined), onclick: () => set(undefined), 'data-test': `fact-${key}-unset` }, 'Not known'),
    );
  }
  const isNum = f.type === 'number';
  const err = h('div.note.bad', { role: 'alert', 'data-test': 'fact-error', hidden: true });
  const inp = h('input.text', {
    value: cur === undefined || String(cur) === 'unknown' ? '' : String(cur), type: isNum ? 'number' : 'text',
    inputmode: isNum ? 'decimal' : undefined, step: isNum ? 'any' : undefined, maxlength: isNum ? undefined : 60,
    'aria-label': label(app, f), 'data-test': `fact-${key}`,
  }) as HTMLInputElement;
  const save = () => {
    const raw = inp.value.trim();
    if (raw === '') return set(undefined);
    if (!isNum) return set(raw);
    const n = Number(raw);
    const why = numberProblem(f, n) ?? (key.startsWith('geometry.') ? fitProblem(b.facts, key, n, (k) => app.c.t(app.c.fact(k)?.label) || k) : null);
    if (why) {
      err.textContent = `${label(app, f)}: ${why}`;
      err.hidden = false;
      return;
    }
    set(n);
  };
  inp.addEventListener('keydown', (e) => e.key === 'Enter' && save());
  inp.addEventListener('input', () => (err.hidden = true));
  return h('div.field', inp, err,
    h('div.row2',
      h('button.btn', { onclick: () => set(undefined), 'data-test': 'fact-clear' }, 'Not known'),
      h('button.btn.primary', { onclick: save, 'data-test': 'fact-save' }, 'Save'),
    ));
}

/** A line "Label ... value"; a tap opens the editor under it. */
function factRow(app: App, b: Bike, f: any, onOpen?: (key: string) => void): HTMLElement {
  const open = ui.edit === f.key;
  return h('div.frow', { 'data-test': `row-${f.key}` },
    h('button.fline', {
      'aria-expanded': String(open),
      onclick: () => {
        ui.edit = open ? null : f.key;
        onOpen?.(f.key);
        app.render();
      },
    }, h('span.fl', label(app, f)), h('span.fv', shown(app, f, b.facts[f.key]))),
    open ? h('div.fedit', f.help ? h('p.s', app.c.t(f.help)) : null, editor(app, b, f)) : null,
  );
}

const allFacts = (app: App): any[] => [...app.c.ix.facts.values()];

// ---------------------------------------------------------------- tabs

function characteristics(app: App, b: Bike): HTMLElement {
  const facts = allFacts(app).filter((f) => groupOf(f.key) !== 'geometry' && !isModel(f.key) && !elsewhere(f.key));
  return h('div.group', facts.map((f) => factRow(app, b, f)));
}

function components(app: App, b: Bike): HTMLElement {
  const groups: any[] = app.c.bundle.fact_groups ?? [];
  if (ui.group) {
    const g = groups.find((x) => x.id === ui.group);
    const facts = allFacts(app).filter((f) => groupOf(f.key) === ui.group && !elsewhere(f.key));
    return h('div',
      h('button.link.back', { 'data-test': 'group-back', onclick: () => { ui.group = null; ui.edit = null; app.render(); } }, icon(ICON.back), 'All components'),
      h('h2.h2g', icon(GROUP_ICON[g?.icon] ?? ICON.garage), app.c.t(g?.label) || ui.group),
      h('div.group', facts.map((f) => factRow(app, b, f))),
    );
  }
  return h('div.gcards', groups.map((g) => {
    const facts = allFacts(app).filter((f) => groupOf(f.key) === g.id && !elsewhere(f.key));
    const known = (f: any) => b.facts[f.key] !== undefined && String(b.facts[f.key]) !== 'unknown';
    const models = facts.filter((f) => isModel(f.key));
    const rest = facts.filter((f) => !isModel(f.key));
    const n = rest.filter(known).length;
    return h('button.gcard', { 'data-test': `group-${g.id}`, onclick: () => { ui.group = g.id; ui.edit = null; app.render(); } },
      h('span.gic', icon(GROUP_ICON[g.icon] ?? ICON.garage)),
      h('span.tx',
        h('b', app.c.t(g.label) || g.id),
        models.map((f) => h('span.comp', h('span.fl', label(app, f)), h('span.fv', shown(app, f, b.facts[f.key])))),
        rest.length ? h('span.s', n === 0 ? 'No facts known' : n === 1 ? '1 fact known' : `${n} facts known`) : null,
      ),
      h('span.chev', icon(ICON.back)),
    );
  }));
}

function geometry(app: App, b: Bike): HTMLElement {
  const facts = allFacts(app).filter((f) => groupOf(f.key) === 'geometry');
  const lab = (k: string) => app.c.t(app.c.fact(k)?.label) || k;
  const drawing = h('div.sc', renderSchematic(b.facts, ui.sel, lab));
  return h('div.geo',
    h('div.geoview', drawing, h('p.s', 'Tap a row to see what it measures. Values not known yet are drawn as typical ones.')),
    h('div.group', facts.map((f) => factRow(app, b, f, (key) => { ui.sel = key; }))),
  );
}

const LIGHT_TEXT: Record<Light, string> = { green: 'OK', yellow: 'Soon', red: 'Overdue', unknown: 'Not known' };

function serviceRow(app: App, b: Bike, i: ServiceItem): HTMLElement {
  const job = app.c.job(i.job);
  const go = () => {
    const t = job?.tutorial && app.c.ix.tutorials.has(job.tutorial) ? { tutorial: job.tutorial } : { job: i.job };
    app.start(i.todos[0] ? { job: i.job, urgency: i.todos[0].urgency, params: i.todos[0].pos ? { pos: i.todos[0].pos } : {} } : t, b);
  };
  const sub = i.light === 'unknown'
    ? 'Enter how far you ride to see this.'
    : i.why || (i.km !== undefined && i.interval ? `about ${i.km} km since last time (every ${i.interval} km)` : '');
  return h('li', h('button.li', { 'data-test': `service-${i.job}`, onclick: go },
    h('span.dot', { class: i.light, 'aria-hidden': 'true' }),
    h('span.tx', h('b', app.c.jobTitle(i.job)), sub ? h('span', sub) : null),
    h('span.badge', { class: i.light === 'red' ? 'warn' : '', 'data-light': i.light }, LIGHT_TEXT[i.light]),
  ));
}

function service(app: App, b: Bike): HTMLElement {
  const jobs = [...app.c.ix.jobs.values()];
  const items = serviceItems(b, jobs, today());
  const km = h('input.text', {
    type: 'number', inputmode: 'numeric', min: 0, max: 2000, placeholder: 'e.g. 40', value: b.kmPerWeek ?? '',
    'aria-label': 'Kilometres per week, roughly', 'data-test': 'km-week',
  }) as HTMLInputElement;
  const save = () => {
    const n = Number(km.value);
    if (km.value.trim() === '' || !Number.isFinite(n) || n < 0 || n > 2000) return app.toast('Enter a distance between 0 and 2000 km.');
    b.kmPerWeek = Math.round(n);
    app.store.save();
    app.render();
  };
  km.addEventListener('keydown', (e) => e.key === 'Enter' && save());
  const unverified = jobs.some((j) => j.service && /^<.*>$/.test(String(j.service.source ?? '')));
  return h('div',
    h('div.field',
      h('label', 'Kilometres per week, roughly'),
      h('div.inl', km, h('button.btn.primary', { onclick: save, 'data-test': 'km-save' }, 'Save')),
      h('p.s', `Used to estimate the distance since each job was last done (since ${b.added}, the day the bike was added, if never).`),
    ),
    items.length
      ? h('ul.list', { 'data-test': 'service-list' }, items.map((i) => serviceRow(app, b, i)))
      : h('div.note', 'No service items yet.'),
    unverified ? h('p.s', 'The service distances in this test build are placeholders and not checked. Follow the maker\'s advice for your bike.') : null,
  );
}

// ---------------------------------------------------------------- the page

const SWATCHES = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50', '#bdc3c7'];

function colourPicker(app: App, b: Bike): HTMLElement {
  const cur = String(b.facts['bike.colour'] ?? '');
  const set = (v: string | undefined) => {
    app.store.setFact(b, 'bike.colour', v);
    app.render();
  };
  const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#2980b9', 'aria-label': 'Pick any colour', 'data-test': 'colour-custom' }) as HTMLInputElement;
  custom.addEventListener('change', () => set(custom.value.toLowerCase()));
  return h('div.swatches', { role: 'group', 'aria-label': 'Frame colour' },
    h('button.sw.none', { 'aria-pressed': String(cur === ''), 'aria-label': 'Standard colour', 'data-test': 'colour-none', onclick: () => set(undefined) }, 'Std'),
    SWATCHES.map((c) => h('button.sw', { style: `background:${c}`, 'aria-pressed': String(cur.toLowerCase() === c), 'aria-label': `Colour ${c}`, 'data-test': `colour-${c.slice(1)}`, onclick: () => set(c) })),
    custom,
  );
}

export function renderBike(app: App, id: string, back: () => void): HTMLElement | null {
  const c = app.c;
  const b = app.store.bike(id);
  if (!b) return null;
  if (ui.id !== id) Object.assign(ui, { id, tab: 'characteristics', group: null, edit: null, sel: null });

  const nameInput = h('input.text', { value: b.name, maxlength: 32, placeholder: 'Name this bike', 'aria-label': 'Bike name', 'data-test': 'bike-name' }) as HTMLInputElement;
  nameInput.addEventListener('change', () => {
    b.name = nameInput.value.trim() || b.name;
    app.store.save();
    app.render();
  });

  const pv = h('div.pv', { 'data-test': 'preview' });
  const sig = JSON.stringify([b.id, b.facts]);
  if (app.stage.preview) {
    if (sig !== previewSig) {
      app.stage.preview(b.facts, pv, { name: b.name });
      previewSig = sig;
    } else {
      pv.append(app.stage.el);
    }
  }
  const todos = app.store.todos(b);

  const tabs = h('div.tabs2', { role: 'tablist' }, TABS.map(([k, text]) =>
    h('button', {
      role: 'tab', 'aria-selected': String(ui.tab === k), 'data-test': `tab-${k}`,
      onclick: () => { ui.tab = k; ui.edit = null; ui.group = null; app.render(); },
    }, text)));
  const body = ui.tab === 'characteristics' ? characteristics(app, b) : ui.tab === 'components' ? components(app, b) : ui.tab === 'geometry' ? geometry(app, b) : service(app, b);

  return h('section.screen',
    h('div.wh', h('button.ib', { 'aria-label': 'Back', onclick: back }, icon(ICON.back)), h('div.t', h('small', 'Garage'), h('b', b.name))),
    h('div.scroll',
      h('div.bikepage',
        h('div.bp-top',
          pv,
          h('div.field', h('label', 'Name'), nameInput),
          h('div.field', h('label', 'Frame colour'), colourPicker(app, b)),
        ),
        h('div.bp-main',
          redBanner(app, b),
          todos.length && ui.tab !== 'service' ? h('div.note', `${todos.length === 1 ? 'One to-do item' : `${todos.length} to-do items`}. See Service.`) : null,
          tabs,
          h('div.tabbody', { 'data-tab': ui.tab }, body),
          h('button.link', { 'data-test': 'remove-bike', onclick: () => app.confirmDelete(b, () => (app.view = { k: 'garage' })) }, 'Delete this bike'),
        ),
      ),
    ),
  );
}
