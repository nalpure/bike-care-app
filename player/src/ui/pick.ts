// The first screen of every flow: which bike is it? A bike from the garage, or an unknown bike,
// described either by its complete name (looked up; a stub in the test build) or by answering
// the flow's questions as they come.

import { bikeTitle, formFacts, lookupBike, numberProblem, type BikeForm } from '../engine/bikes.js';
import type { Start } from '../engine/journey.js';
import type { App, View } from './app.js';
import { h, icon, ICON } from './dom.js';
import { bikeSummary } from './home.js';

export type PickStep =
  | { k: 'list' }
  | { k: 'unknown' }
  | { k: 'form'; form: BikeForm; error?: string }
  | { k: 'lookup'; form: BikeForm; match?: string };

type PickView = Extract<View, { k: 'pick' }>;

/** What the flow is, for the header: the symptom, the guide or the check. */
export function flowTitle(app: App, start: Start): string {
  const c = app.c;
  if ('diagnosis' in start) return c.ix.diagnoses.get(start.diagnosis)?.symptom ?? start.diagnosis;
  if ('tutorial' in start) {
    const t = c.ix.tutorials.get(start.tutorial);
    return t ? c.jobTitle(t.job) : start.tutorial;
  }
  if ('check' in start) return c.ix.checks.get(start.check)?.title ?? start.check;
  return c.jobTitle(start.job);
}

function head(app: App, v: PickView, title: string, back: () => void): HTMLElement {
  return h('div.wh',
    h('button.ib', { 'aria-label': 'Back', 'data-test': 'back', onclick: back }, icon(ICON.back)),
    h('div.t', h('small', flowTitle(app, v.start)), h('b', title)),
  );
}

export function renderPick(app: App, v: PickView): HTMLElement {
  const step = v.step;
  const to = (s: PickStep) => app.go({ ...v, step: s });
  const screen = (title: string, back: () => void, body: (HTMLElement | null)[], cta?: (HTMLElement | null)[]) =>
    h('section.screen', head(app, v, title, back), h('div.scroll', body), cta ? h('div.cta', cta) : null);

  if (step.k === 'list') {
    const bikes = app.store.garage();
    return screen('Which bike?', () => app.go({ k: 'home' }), [
      h('h1.h2q', 'Which bike is it?'),
      bikes.length
        ? h('ul.list', bikes.map((b) => h('li', h('button.li', { 'data-test': `pick-${b.id}`, onclick: () => app.run(v.start, b, {}, v) },
          h('span.tx', h('b', b.name), h('span', bikeSummary(app, b))),
        ))))
        : h('p.lead', 'Your garage is empty.'),
      h('button.opt', { 'data-test': 'pick-unknown', onclick: () => to({ k: 'unknown' }) },
        h('span.ol', h('span', 'An unknown bike'), h('small', 'Not in your garage yet')),
      ),
    ]);
  }

  if (step.k === 'unknown') {
    return screen('An unknown bike', () => to({ k: 'list' }), [
      h('h1.h2q', 'How do you want to describe it?'),
      h('div.qopts',
        h('button.opt', { 'data-test': 'unknown-complete', onclick: () => to({ k: 'form', form: {} }) },
          h('span.ol', h('span', 'Add the complete bike'), h('small', 'Best if you bought it complete and know its exact name')),
        ),
        h('button.opt', { 'data-test': 'unknown-questions', onclick: () => app.run(v.start, null, {}, v) },
          h('span.ol', h('span', 'Answer a few questions'), h('small', 'Only what this needs')),
        ),
      ),
    ]);
  }

  if (step.k === 'form') {
    const form = { ...step.form };
    const label = (key: string, fallback: string) => app.c.t(app.c.fact(key)?.label) || fallback;
    const field = (key: keyof BikeForm, fact: string, fallback: string, placeholder: string, type = 'text') => {
      const inp = h('input.text', {
        type, value: form[key] === undefined ? '' : String(form[key]), placeholder, maxlength: 40,
        inputmode: type === 'number' ? 'numeric' : undefined, 'aria-label': label(fact, fallback), 'data-test': `form-${key}`,
      }) as HTMLInputElement;
      inp.addEventListener('input', () => {
        const raw = inp.value.trim();
        (form as any)[key] = type === 'number' ? (raw === '' ? undefined : Number(raw)) : raw;
      });
      return h('div.field', h('label', label(fact, fallback)), inp);
    };
    const submit = () => {
      if (!form.brand?.trim() || !form.model?.trim()) return to({ k: 'form', form, error: 'Enter at least the brand and the model.' });
      if (form.year !== undefined) {
        const why = numberProblem(app.c.fact('bike.year'), form.year);
        if (why) return to({ k: 'form', form, error: `${label('bike.year', 'Year')}: ${why}` });
      }
      const match = lookupBike(app.c.bundle.demo_bikes ?? [], form);
      to({ k: 'lookup', form, match: match?.id });
    };
    return screen('The complete bike', () => to({ k: 'unknown' }), [
      h('h1.h2q', 'Which bike is it?'),
      h('p.lead', 'As written on the frame or the receipt.'),
      field('brand', 'bike.brand', 'Brand', 'e.g. Corvana'),
      field('model', 'bike.model', 'Model', 'e.g. SL 3'),
      field('line', 'bike.line', 'Series', 'If there is one'),
      field('year', 'bike.year', 'Model year', 'e.g. 2021', 'number'),
      step.error ? h('div.note.bad', { role: 'alert', 'data-test': 'form-error' }, step.error) : null,
    ], [h('button.btn.primary.wide', { 'data-test': 'lookup', onclick: submit }, 'Look it up')]);
  }

  // lookup result
  const demo = step.match ? (app.c.bundle.demo_bikes ?? []).find((d) => d.id === step.match) : undefined;
  const given = formFacts(step.form);
  if (demo) {
    const facts = { ...demo.facts, ...given };
    const n = Object.keys(demo.facts).length;
    return screen('The complete bike', () => to({ k: 'form', form: step.form }), [
      h('h1.h2q', 'Found it'),
      h('div.card', { 'data-test': 'lookup-found' },
        h('b.t', bikeTitle(facts) || demo.name),
        h('span.s', `${n} facts come with it. The app asks only what is still missing.`),
      ),
      h('p.s', 'In this test build the lookup knows only the test bikes.'),
    ], [h('button.btn.primary.wide', { 'data-test': 'lookup-use', onclick: () => app.run(v.start, null, facts, v) }, 'Continue with this bike')]);
  }
  return screen('The complete bike', () => to({ k: 'form', form: step.form }), [
    h('h1.h2q', 'Not found'),
    h('div.note', { 'data-test': 'lookup-none' }, 'The real app would now search online for this bike. This test build only knows its test bikes.'),
    h('p.lead', 'Answer a few questions instead. What you entered is kept.'),
  ], [h('button.btn.primary.wide', { 'data-test': 'lookup-questions', onclick: () => app.run(v.start, null, given, v) }, 'Answer a few questions')]);
}
