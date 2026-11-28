// The garage: test bikes from the bundle, the complete-bike lookup stub, number ranges, and the
// offer to keep what a flow learned (on a garage bike or as a new one).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UNKNOWN } from '../../tools/lib/conditions.js';
import { REPO } from '../../tools/test/helpers.js';
import { fitProblem, lookupBike, numberProblem } from '../src/engine/bikes.js';
import { kmSince, serviceItems } from '../src/engine/service.js';
import { Content } from '../src/engine/content.js';
import { Journey, Session } from '../src/engine/journey.js';
import { memoryKV, Store } from '../src/engine/store.js';

const c = new Content(JSON.parse(readFileSync(join(REPO, 'build/bundle.json'), 'utf8')));
const demos = c.bundle.demo_bikes;
const shifting = { tutorial: 'adjust-rear-shifting' };

/** Answers the three questions the shifting guide asks a bike nothing is known about (the barrel's last, with 3D). */
function answerShifting(j: Journey, gear: string = 'derailleur'): void {
  let s = j.screen();
  expect(s.kind === 'question' && s.key).toBe('drive.gear_type');
  j.answerFact('drive.gear_type', gear);
  s = j.screen();
  expect(s.kind === 'question' && s.key).toBe('drive.shifting');
  j.answerFact('drive.shifting', 'mechanical');
  s = j.screen();
  expect(s.kind === 'question' && s.key).toBe('drive.barrel_adjuster');
  j.answerFact('drive.barrel_adjuster', 'derailleur');
}

const LEARNED = { 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.barrel_adjuster': 'derailleur' };

describe('store', () => {
  it('fills the garage with the test bikes, and a reset brings them back', () => {
    const kv = memoryKV();
    const store = new Store(kv, demos);
    expect(store.garage().map((b) => b.name)).toEqual(demos.map((d) => d.name));
    store.removeBike(demos[0].id);
    store.addBike('Mine');
    expect(new Store(kv, demos).garage().map((b) => b.name)).toEqual([...demos.slice(1).map((d) => d.name), 'Mine']);
    store.reset();
    expect(new Store(kv, demos).garage().map((b) => b.id)).toEqual(demos.map((d) => d.id));
  });

  it('starts fresh over data of the old version', () => {
    const kv = memoryKV();
    kv.set('bike-app/v1', JSON.stringify({ version: 1, bikes: [{ id: 'unknown', name: 'Unknown bike', facts: {}, findings: [] }], current: 'unknown' }));
    expect(new Store(kv, demos).garage()).toHaveLength(demos.length);
  });

  it('records the day a job was done', () => {
    const store = new Store(memoryKV(), demos);
    const b = store.garage()[0];
    store.clearJob(b, 'chain-care', '2026-11-21');
    expect(b.done['chain-care']).toBe('2026-11-21');
  });
});

describe('complete-bike lookup (stub)', () => {
  it('finds a test bike by brand and model, ignoring case and spaces', () => {
    expect(lookupBike(demos, { brand: 'corvana', model: 'sl3' })?.id).toBe('road-bike-stand');
    expect(lookupBike(demos, { brand: 'Corvana', model: 'SL 3', line: 'Strada', year: 2020 })?.id).toBe('road-bike-stand');
  });

  it('finds nothing for another year, another series, or without a model', () => {
    expect(lookupBike(demos, { brand: 'Corvana', model: 'SL 3', year: 2019 })).toBeUndefined();
    expect(lookupBike(demos, { brand: 'Corvana', model: 'SL 3', line: 'Gravel' })).toBeUndefined();
    expect(lookupBike(demos, { brand: 'Corvana' })).toBeUndefined();
  });
});

describe('number facts', () => {
  it('refuses values outside the fact range, with the reason', () => {
    expect(numberProblem(c.fact('geometry.stack_mm'), 400)).toBe('Must be between 450 and 720 mm.');
    expect(numberProblem(c.fact('geometry.head_angle_deg'), 80)).toBe('Must be between 62 and 76°.');
    expect(numberProblem(c.fact('geometry.stack_mm'), 560)).toBeNull();
    expect(numberProblem(c.fact('geometry.wheel_bsd_mm'), 600)).toMatch(/^Choose one of 559, 584, 622/);
  });
});

describe('geometry fit', () => {
  const road = demos.find((d) => d.id === 'road-bike-stand')!.facts;
  const lab = (k: string) => k;
  it('accepts the test bike as it is', () => {
    for (const [k, v] of Object.entries(road)) if (k.startsWith('geometry.')) expect(fitProblem(road, k, Number(v), lab)).toBeNull();
  });
  it('refuses a reach about as long as the top tube, and a wheelbase barely longer than the chainstay', () => {
    expect(fitProblem(road, 'geometry.reach_mm', 520, lab)).toMatch(/top_tube_mm must be clearly longer than geometry.reach_mm/);
    expect(fitProblem({ 'geometry.chainstay_mm': 520 }, 'geometry.wheelbase_mm', 900, lab)).toMatch(/wheelbase_mm must be clearly longer/);
    expect(fitProblem({}, 'geometry.reach_mm', 520, lab)).toBeNull();
  });
});

describe('service lights', () => {
  const jobs = [...c.ix.jobs.values()];
  const bike = (extra: object = {}) => ({ id: 'x', name: 'X', facts: {}, findings: [], added: '2026-01-01', done: {}, ...extra }) as any;
  const light = (b: any, job = 'chain-care', day = '2026-01-29') => serviceItems(b, jobs, day).find((i) => i.job === job)!.light;
  it('is not known until the weekly distance is given', () => {
    expect(light(bike())).toBe('unknown');
  });
  it('is green below 75 %, yellow from 75 %, red from 100 % of the interval (chain-care: 300 km)', () => {
    // 4 weeks at 50, 55 and 75 km: 200, 220 and 300 km
    expect(light(bike({ kmPerWeek: 50 }))).toBe('green');
    expect(light(bike({ kmPerWeek: 57 }))).toBe('yellow');
    expect(light(bike({ kmPerWeek: 75 }))).toBe('red');
  });
  it('counts from the day the job was done', () => {
    expect(kmSince(bike({ kmPerWeek: 70, done: { 'chain-care': '2026-01-22' } }), 'chain-care', '2026-01-29')).toBe(70);
  });
  it('findings raise the light: soon is yellow, do_not_ride is red', () => {
    const f = (urgency: string) => ({ inspection: 'i', state: 's', job: 'chain-care', urgency, source: 't', date: '2026-01-02' });
    expect(light(bike({ kmPerWeek: 1, findings: [f('soon')] }))).toBe('yellow');
    expect(light(bike({ kmPerWeek: 1, findings: [f('do_not_ride')] }))).toBe('red');
    expect(light(bike({ kmPerWeek: 1, findings: [{ ...f('soon'), cleared: '2026-01-03' }] }))).toBe('green');
  });
});

describe('keeping what a flow learned', () => {
  it('a garage bike gets the answers only when the user saves them', () => {
    const store = new Store(memoryKV());
    const b = store.addBike('Blue');
    const j = new Journey(c, store, b, new Session(), shifting);
    answerShifting(j);
    expect(b.facts).toEqual({});
    const s = j.screen();
    expect(s.kind).toBe('keep');
    if (s.kind !== 'keep') return;
    expect(s.bike).toBe('Blue');
    expect(s.learned.map(([k]) => k)).toEqual(Object.keys(LEARNED));
    j.keepSave();
    expect(b.facts).toEqual(LEARNED);
    expect(j.screen().kind).toBe('choice');
  });

  it('skipping keeps the garage bike as it was, and the offer comes once', () => {
    const store = new Store(memoryKV());
    const b = store.addBike('Blue');
    const j = new Journey(c, store, b, new Session(), shifting);
    answerShifting(j);
    j.keepSkip();
    expect(j.screen().kind).toBe('choice');
    j.choose('hold_bike', 'stand');
    expect(j.screen().kind).not.toBe('keep');
    expect(b.facts).toEqual({});
  });

  it('an unknown bike becomes a garage bike with a name, keeping facts and findings', () => {
    const store = new Store(memoryKV());
    const j = new Journey(c, store, null, new Session(), shifting);
    answerShifting(j);
    const s = j.screen();
    expect(s.kind === 'keep' && s.bike).toBeNull();
    j.keepSave('   ');
    expect(store.garage()).toHaveLength(0);
    j.keepSave('Red one');
    expect(store.garage().map((b) => [b.name, b.facts])).toEqual([['Red one', LEARNED]]);
    expect(j.garageBike?.name).toBe('Red one');
  });

  it('"I\'ll check later" is never stored', () => {
    const store = new Store(memoryKV());
    const b = store.addBike('Blue');
    const j = new Journey(c, store, b, new Session(), shifting);
    j.answerFact('drive.gear_type', 'derailleur');
    j.answerFact('drive.shifting', UNKNOWN);
    const s = j.screen();
    if (s.kind === 'keep') {
      expect(s.learned.map(([k]) => k)).toEqual(['drive.gear_type']);
      j.keepSave();
    }
    expect('drive.shifting' in b.facts).toBe(false);
  });

  it('facts from the complete-bike form count as learned', () => {
    const store = new Store(memoryKV());
    const road = demos.find((d) => d.id === 'road-bike-stand')!;
    const j = new Journey(c, store, null, new Session(), shifting, road.facts);
    // the road bike's data does not say where its barrel adjuster is: that is asked first
    expect(j.screen().kind === 'question').toBe(true);
    j.answerFact('drive.barrel_adjuster', 'derailleur');
    const s = j.screen();
    expect(s.kind).toBe('keep');
    if (s.kind === 'keep') expect(s.learned.length).toBe(Object.keys(road.facts).length + 1);
  });

  it('findings of a garage bike reach it without the offer', () => {
    const p = { facts: { 'bike.category': 'trekking_city', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical' } };
    const store = new Store(memoryKV());
    const b = store.addBike('Blue', p.facts);
    const j = new Journey(c, store, b, new Session(), { check: c.routineCheck().id });
    for (let i = 0; i < 30; i++) {
      const s = j.screen();
      if (s.kind !== 'card') break;
      // the last button is the "something is off" state on these checks often enough; any finding will do
      j.tap(s.card.buttons[s.card.buttons.length - 1].id);
      if (j.screen().kind === 'card') j.next();
    }
    expect(b.findings.length).toBeGreaterThan(0);
  });
});
