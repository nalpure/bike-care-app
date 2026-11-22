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
  const bike = store.addBike('Test bike', { 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical' });
  const j = new Journey(c, store, bike, new Session(), { tutorial: 'adjust-rear-shifting' });
  j.choose('hold_bike', 'stand');
  j.startTutorial();
  return j;
}

/** Walks the cards, tapping the first button that lets the user go on, until `stopAt` or the end. */
function walk(j: Journey, stopAt?: string, pick: Record<string, string> = {}): { ids: string[]; at?: Screen } {
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) {
    const s = j.screen();
    if (s.kind !== 'card') return { ids, at: s };
    ids.push(s.card.id);
    if (s.card.id === stopAt) return { ids, at: s };
    if (pick[s.card.id]) j.tap(pick[s.card.id]);
    else if (!s.card.nextEnabled) {
      for (const b of s.card.buttons) {
        j.tap(b.id);
        const t = j.screen();
        if (t.kind === 'card' && t.card.nextEnabled) break;
        j.back();
      }
    }
    j.next();
  }
  return { ids };
}

describe('engine', () => {
  it('a button with skips leaves out the named later steps', () => {
    const plain = walk(setup(() => {}), undefined, { 'check-high-limit': 'in-line' });
    expect(plain.ids).toContain('check-b-gap');
    const j = setup((b) => {
      const step = b.steps.find((s: any) => s.id === 'check-high-limit');
      step.buttons.find((x: any) => x.id === 'in-line').skips = ['check-b-gap'];
    });
    const skipped = walk(j, undefined, { 'check-high-limit': 'in-line' });
    expect(skipped.ids).not.toContain('check-b-gap');
    expect(skipped.ids.length).toBe(plain.ids.length - 1);
  });

  it('hands a step\'s and an inspection\'s show list to the card\'s stage', () => {
    const j = setup((b) => {
      b.steps.find((s: any) => s.id === 'check-high-limit').show = ['frame', 'chain'];
      for (const i of b.inspections) i.show = ['frame'];
    });
    const plain = walk(setup(() => {}), 'check-high-limit').at;
    expect(plain?.kind === 'card' && plain.card.stage.show).toBeUndefined();
    const r = walk(j, 'check-high-limit').at;
    expect(r?.kind === 'card' && r.card.stage.show).toEqual(['frame', 'chain']);
    expect(r?.kind === 'card' && r.card.stage.focus).toEqual(['upper_pulley', 'smallest_sprocket', 'h_screw']);
  });

  it('shows a standing warning on every card while its label is set', () => {
    const j = setup((b) => {
      b.states.find((s: any) => s.id === 'bike_in_stand').warning = 'The bike is clamped. Do not lean on it.';
    });
    const first = j.screen();
    expect(first.kind === 'card' && first.card.warnings).toEqual([]);
    const r = walk(j, 'check-b-gap');
    expect(r.at?.kind === 'card' && r.at.card.warnings).toEqual(['The bike is clamped. Do not lean on it.']);
  });

  it('keeps Next disabled on a block until a good state is tapped', () => {
    const j = setup(() => {});
    walk(j, 'check-high-limit');
    j.tap('too-far-out');
    const blocked = j.screen();
    expect(blocked.kind === 'card' && blocked.card.nextEnabled).toBe(false);
    j.next();
    const still = j.screen();
    expect(still.kind === 'card' && still.card.id).toBe('check-high-limit');
    j.tap('in-line');
    const ok = j.screen();
    expect(ok.kind === 'card' && ok.card.nextEnabled).toBe(true);
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
