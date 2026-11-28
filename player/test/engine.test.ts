// Engine behaviour that no profile journey reaches with today's content: button skips and
// standing warnings. Tested on a copy of the bundle with those fields added.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../../tools/test/helpers.js';
import { Content } from '../src/engine/content.js';
import { Journey, Session, type Screen } from '../src/engine/journey.js';
import { memoryKV, Store } from '../src/engine/store.js';

const raw = readFileSync(join(REPO, 'build/bundle.json'), 'utf8');

function setup(change: (b: any) => void): Journey {
  const b = JSON.parse(raw);
  change(b);
  const c = new Content(b);
  const store = new Store(memoryKV());
  const bike = store.addBike('Test bike', KNOWN);
  const j = new Journey(c, store, bike, new Session(), { tutorial: 'adjust-rear-shifting' });
  j.choose('hold_bike', 'stand');
  j.startTutorial();
  return j;
}

/** A bike the shifting tutorial covers, with nothing left to ask. */
const KNOWN = { 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.barrel_adjuster': 'derailleur' };

/** Walks the cards, tapping the first button that lets the user go on, until `stopAt` or the end. */
function walk(j: Journey, stopAt?: string, pick: Record<string, string> = {}): { ids: string[]; at?: Screen } {
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) {
    const s = j.screen();
    // Facts asked before the first card are offered once; the walk does not keep them.
    if (s.kind === 'keep') {
      j.keepSkip();
      continue;
    }
    if (s.kind !== 'card') return { ids, at: s };
    ids.push(s.card.id);
    if (s.card.id === stopAt) return { ids, at: s };
    // A tap that goes on moves to the next card by itself (an inspection without a default).
    const moved = () => {
      const t = j.screen();
      return t.kind !== 'card' || t.card.position.n !== s.card.position.n;
    };
    let gone = false;
    if (pick[s.card.id]) {
      j.tap(pick[s.card.id]);
      gone = moved();
    } else if (!s.card.nextEnabled) {
      for (const b of s.card.buttons) {
        j.tap(b.id);
        if ((gone = moved())) break;
        const t = j.screen();
        if (t.kind === 'card' && t.card.nextEnabled) break;
        j.back();
      }
    }
    if (!gone) j.next();
  }
  return { ids };
}

describe('engine', () => {
  it('a button with skips leaves out the named later steps', () => {
    const plain = walk(setup(() => {}), undefined, { 'check-b-gap': 'touching' });
    expect(plain.ids).toContain('check-cable-tension');
    const j = setup((b) => {
      const step = b.steps.find((s: any) => s.id === 'check-b-gap');
      step.buttons.find((x: any) => x.id === 'touching').skips = ['check-cable-tension'];
    });
    const skipped = walk(j, undefined, { 'check-b-gap': 'touching' });
    expect(skipped.ids).not.toContain('check-cable-tension');
    expect(skipped.ids.length).toBe(plain.ids.length - 1);
  });

  it('hands a step\'s and an inspection\'s show list to the card\'s stage', () => {
    const j = setup((b) => {
      b.steps.find((s: any) => s.id === 'check-high-limit').show = ['frame', 'chain'];
      for (const i of b.inspections) i.show = ['frame'];
    });
    const plain = walk(setup((b) => delete b.steps.find((s: any) => s.id === 'check-low-limit').show), 'check-low-limit').at;
    expect(plain?.kind === 'card' && plain.card.stage.show).toBeUndefined();
    const r = walk(j, 'check-high-limit').at;
    expect(r?.kind === 'card' && r.card.stage.show).toEqual(['frame', 'chain']);
    expect(r?.kind === 'card' && r.card.stage.focus).toEqual(['upper_pulley', 'smallest_sprocket', 'h_screw']);
  });

  it('shows a standing warning on every card while its label is set', () => {
    const j = setup((b) => {
      b.states.find((s: any) => s.id === 'bike_in_stand').warning = 'The bike is clamped. Do not lean on it.';
    });
    const r = walk(j, 'check-b-gap');
    expect(r.at?.kind === 'card' && r.at.card.warnings).toEqual(['The bike is clamped. Do not lean on it.']);
    // once the bike is out of the stand, the warning is gone
    const end = walk(j, 'test-ride-gears');
    expect(end.at?.kind === 'card' && end.at.card.warnings).toEqual([]);
  });

  it('keeps Next disabled on a block until a good state is tapped (step without a question)', () => {
    const j = setup((b) => {
      const s = b.steps.find((x: any) => x.id === 'check-low-limit-by-hand');
      delete s.question;
      s.buttons.unshift({ id: 'in-line', label: 'In line with the largest sprocket', text: 'The inner limit is safe.' });
    });
    walk(j, 'check-low-limit-by-hand');
    j.tap('too-far-in');
    const blocked = j.screen();
    expect(blocked.kind === 'card' && blocked.card.nextEnabled).toBe(false);
    j.next();
    const still = j.screen();
    expect(still.kind === 'card' && still.card.id).toBe('check-low-limit-by-hand');
    j.tap('in-line');
    const ok = j.screen();
    expect(ok.kind === 'card' && ok.card.nextEnabled).toBe(true);
  });

  it('on a step with a question, Next is never locked and means the goal is met', () => {
    const j = setup(() => {});
    const at = walk(j, 'check-low-limit-by-hand').at;
    expect(at?.kind === 'card' && at.card.question).toBe('Does it go further in?');
    expect(at?.kind === 'card' && at.card.nextAnswers && at.card.nextEnabled).toBe(true);
    // a block: the solution comes with it, Next stays pressable and means "fixed now"
    j.tap('too-far-in');
    const blocked = j.screen();
    expect(blocked.kind === 'card' && blocked.card.chosenTone).toBe('bad');
    expect(blocked.kind === 'card' && blocked.card.nextEnabled).toBe(true);
    expect(blocked.kind === 'card' && blocked.card.solution?.length).toBe(1);
    j.next();
    const after = j.screen();
    expect(after.kind === 'card' && after.card.id).toBe('check-b-gap');
  });

  it('an inspection with a default: in a tutorial its state has no button and Next takes it', () => {
    const s = new Session();
    const b = JSON.parse(raw);
    const insp = b.inspections.find((x: any) => x.id === 'derailleur-alignment');
    insp.default = 'straight';
    insp.question = 'Looks bent?';
    // No tutorial calls an inspection since 2026-11-27, so the test puts one first in the work of every way.
    for (const cs of b.tutorials.find((t: any) => t.id === 'adjust-rear-shifting').cases) {
      cs.case.sequence.unshift({ inspect: 'derailleur-alignment', outcomes: { straight: 'continue', crooked: { exit: { kind: 'unsafe', text: 'Do not ride.' } } } });
    }
    const store = new Store(memoryKV());
    const bike = store.addBike('Test bike', KNOWN);
    const j = new Journey(new Content(b), store, bike, s, { tutorial: 'adjust-rear-shifting' });
    j.choose('hold_bike', 'stand');
    j.startTutorial();
    const card = j.screen();
    expect(card.kind === 'card' && card.card.id).toBe('derailleur-alignment');
    expect(card.kind === 'card' && card.card.buttons.map((x) => x.id)).toEqual(['crooked']);
    expect(card.kind === 'card' && card.card.question).toBe('Looks bent?');
    expect(card.kind === 'card' && card.card.nextEnabled).toBe(true);
    j.next();
    expect(s.answers['derailleur-alignment']).toBe('straight');
    const nx = j.screen();
    expect(nx.kind === 'card' && nx.card.id).not.toBe('derailleur-alignment');
  });

  it('only moves the progress bar forward, also when going back by hand', () => {
    const j = setup(() => {});
    const r = walk(j, 'check-b-gap');
    const at = r.at?.kind === 'card' ? r.at.card.progress : 0;
    j.back();
    const before = j.screen();
    expect(before.kind === 'card' && before.card.progress).toBeGreaterThanOrEqual(at);
  });
});

describe('the barrel adjuster: a fact with 3D, asked last in the facts phase (owner, 2026-11-27)', () => {
  const BARREL = 'drive.barrel_adjuster';
  function start(facts: Record<string, string> | null, change: (b: any) => void = () => {}, flow: { tutorial: string } | { diagnosis: string } = { tutorial: 'adjust-rear-shifting' }) {
    const b = JSON.parse(raw);
    change(b);
    const store = new Store(memoryKV());
    const bike = facts ? store.addBike('Test bike', facts) : null;
    return { j: new Journey(new Content(b), store, bike, new Session(), flow), store, bike };
  }
  /** Answers each question from `answers` until another screen comes; returns the keys asked, in order. */
  function answer(j: Journey, answers: Record<string, any>): string[] {
    const asked: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s = j.screen();
      if (s.kind === 'keep') {
        j.keepSkip();
        continue;
      }
      if (s.kind !== 'question') break;
      asked.push(s.key);
      j.answerFact(s.key, answers[s.key]);
    }
    return asked;
  }
  const PLAIN = { 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical' };

  it('asks the plain questions first, then the barrel with its 3D', () => {
    const { j } = start(null);
    const seen: any[] = [];
    for (let i = 0; i < 4; i++) {
      const s = j.screen();
      if (s.kind !== 'question') break;
      seen.push(s);
      j.answerFact(s.key, { ...PLAIN, [BARREL]: 'shifter' }[s.key]);
    }
    expect(seen.map((s) => s.key)).toEqual(['drive.gear_type', 'drive.shifting', BARREL]);
    expect(seen[0].stage).toBeUndefined();
    const q = seen[2];
    expect(q.stage.animation.clip).toBe('barrel-tour');
    expect(q.stage.focus).toEqual(expect.arrayContaining(['rear_barrel', 'front_barrel']));
    // the answer is a fact of this flow, offered on the keep screen like any other
    expect(j.screen().kind).toBe('keep');
    expect(j.learned()).toContainEqual([BARREL, 'shifter']);
  });

  it('asks in the order the author wrote, each fact only while a path ahead reads it (owner, 2026-11-27)', () => {
    const tut = (b: any) => b.tutorials.find((x: any) => x.id === 'adjust-rear-shifting');
    // the author's order wins over the order the flow reads the facts
    const { j } = start(null, (b) => (tut(b).questions = ['drive.shifting', 'drive.gear_type', BARREL]));
    expect(answer(j, { ...PLAIN, [BARREL]: 'derailleur' })).toEqual(['drive.shifting', 'drive.gear_type', BARREL]);
    // a fact no path ahead reads is not asked: hub gears end before the shifting and the barrel are read
    const { j: k } = start(null);
    expect(answer(k, { 'drive.gear_type': 'hub_gear' })).toEqual(['drive.gear_type']);
    expect(k.screen().kind).toBe('not-covered');
    // a plain fact the flow reads after the barrel (here: by the finish) is asked before it, as listed
    const { j: m } = start(PLAIN, (b) => {
      Object.assign(b.steps.find((x: any) => x.id === 'test-ride-gears'), { when: { 'bike.ebike': [true, false] }, if_unknown: 'ask' });
      tut(b).questions = ['drive.gear_type', 'drive.shifting', 'bike.ebike', BARREL];
    });
    expect(answer(m, { 'bike.ebike': false, [BARREL]: 'derailleur' })).toEqual(['bike.ebike', BARREL]);
  });

  it('offers only the places, no unknown answer, and the diagnosis never asks it (owner, 2026-11-27)', () => {
    const { j } = start(PLAIN);
    const s = j.screen();
    expect(s.kind === 'question' && s.key).toBe(BARREL);
    expect(s.kind === 'question' && s.fact.allow_unknown).toBe(false);
    expect(s.kind === 'question' && s.fact.answers.unknown).toBeUndefined();
    const { j: d } = start(null, () => {}, { diagnosis: 'gears-shift-badly' });
    expect(answer(d, PLAIN)).toEqual(['drive.gear_type', 'drive.shifting']);
    expect(d.screen().kind).toBe('card');
  });

  it('is not asked when the bike knows it, and the cards get it for the 3D view', () => {
    for (const v of ['derailleur', 'shifter', 'inline']) {
      const { j } = start({ ...PLAIN, [BARREL]: v });
      expect(j.screen().kind).toBe('choice');
      j.choose('hold_bike', 'stand');
      j.startTutorial();
      expect(j.bikeFacts[BARREL]).toBe(v);
    }
  });

  it('a tutorial runs no checks: the work starts at once', () => {
    const { j } = start(KNOWN);
    j.choose('hold_bike', 'stand');
    j.startTutorial();
    const s = j.screen();
    expect(s.kind === 'card' && s.card.itemKind).toBe('step');
  });

  it('the diagnosis does not ask it', () => {
    const { j } = start(PLAIN, () => {}, { diagnosis: 'gears-shift-badly' });
    const s = j.screen();
    expect(s.kind === 'card' && s.card.id).toBe('derailleur-alignment');
  });
});

describe('a tutorial started on a bike it does not fit', () => {
  const demo = (id: string) => JSON.parse(raw).demo_bikes.find((d: any) => d.id === id).facts;
  const start = (facts: Record<string, any> | null, change: (b: any) => void = () => {}) => {
    const b = JSON.parse(raw);
    change(b);
    const c = new Content(b);
    const store = new Store(memoryKV());
    const bike = facts ? store.addBike('Test bike', facts) : null;
    return { j: new Journey(c, store, bike, new Session(), { tutorial: 'adjust-rear-shifting' }), c };
  };
  const hubText = (c: Content) => c.job('adjust-rear-shifting').covers.not_covered.find((n: any) => n.when['drive.gear_type']?.[0] === 'hub_gear').text;

  it('says why at once when the known facts rule it out', () => {
    const { j, c } = start(demo('e-trekking-hub-gear'));
    const s = j.screen();
    expect(s.kind).toBe('not-covered');
    expect(s.kind === 'not-covered' && s.wrongBike).toBe(true);
    expect(s.kind === 'not-covered' && s.message).toBe(hubText(c));
  });

  it('asks no question first when a later known fact already rules it out', () => {
    // drive.gear_type is read first in covers.when, but it is not known; the shifting is.
    const { j, c } = start({ 'drive.shifting': 'electronic' });
    const s = j.screen();
    expect(s.kind).toBe('not-covered');
    const text = c.job('adjust-rear-shifting').covers.not_covered.find((n: any) => n.when['drive.shifting']?.[0] === 'electronic').text;
    expect(s.kind === 'not-covered' && s.message).toBe(text);
    expect(s.kind === 'not-covered' && s.wrongBike).toBe(true);
  });

  it('asks a needed fact first, then says why once the answer rules it out', () => {
    const { j, c } = start(null);
    const q = j.screen();
    expect(q.kind === 'question' && q.key).toBe('drive.gear_type');
    j.answerFact('drive.gear_type', 'hub_gear');
    if (j.screen().kind === 'keep') j.keepSkip();
    const s = j.screen();
    expect(s.kind === 'not-covered' && s.wrongBike).toBe(true);
    expect(s.kind === 'not-covered' && s.message).toBe(hubText(c));
  });

  it('gives no message when no not_covered text matches (the UI shows a general line)', () => {
    const { j } = start(demo('e-trekking-hub-gear'), (b) => {
      const job = (Array.isArray(b.jobs) ? b.jobs : Object.values(b.jobs)).find((x: any) => x.id === 'adjust-rear-shifting');
      job.covers.not_covered = job.covers.not_covered.filter((n: any) => !n.when['drive.gear_type']);
    });
    const s = j.screen();
    expect(s.kind === 'not-covered' && s.wrongBike).toBe(true);
    expect(s.kind === 'not-covered' && s.message).toBe('');
  });

  it('starts as before on a bike it fits', () => {
    const { j } = start(demo('road-bike-stand'));
    expect(j.screen().kind).not.toBe('not-covered');
  });
});
