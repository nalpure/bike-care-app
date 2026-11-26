// Walks every profile journey through the player's engine and checks that it ends where
// npm run check says it ends (build/report.md, Profiles), with the same time.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../../tools/lib/run.js';
import { REPO, Sandbox, show, step } from '../../tools/test/helpers.js';
import { Content } from '../src/engine/content.js';
import { Journey, Session, type Screen } from '../src/engine/journey.js';
import { memoryKV, Store } from '../src/engine/store.js';
import { drive } from './drive.js';

const check = runCheck(REPO, { write: false });
const content = new Content(JSON.parse(readFileSync(join(REPO, 'build/bundle.json'), 'utf8')));

describe('profile journeys in the player', () => {
  it('the written bundle is the one the check builds', () => {
    expect(readFileSync(join(REPO, 'build/bundle.json'), 'utf8')).toBe(check.bundle);
  });

  const cases = [...check.content!.profiles.values()].flatMap((p) => (p.def.journeys as any[]).map((j) => ({ p: p.def, j })));
  it.each(cases.map((x) => [`${x.p.id}/${x.j.id}`, x] as const))('%s', (_name, { p, j }) => {
    const expected = check.profiles.get(p.id)!.results.find((r) => r.journey === j.id)!;
    const got = drive(content, p, j);
    expect(got.error).toBeUndefined();
    expect(got.ending).toBe(expected.ending);
    expect(got.minutes).toBe(expected.minutes);
  });

  it('peeking at the previous and next card changes nothing, and Next leads to the peeked card', () => {
    const id = (s: Screen) => (s.kind === 'card' ? `card ${s.card.id}` : s.kind);
    let peeks = 0;
    for (const { p, j } of cases) {
      let last: { from: string; next: ReturnType<Journey['peekNext']> } | null = null;
      const got = drive(content, p, j, (journey, store) => {
        const s = journey.screen();
        // What the last card's peek promised is where the owner arrived.
        if (last && id(s) !== last.from && last.next) {
          const want = id(last.next.screen);
          if (last.next.open) expect(`${p.id}/${j.id}: ${id(s)}`).toBe(`${p.id}/${j.id}: ${want}`);
          else if (s.kind === 'card' && last.next.screen.kind === 'card') expect(`${p.id}/${j.id}: ${id(s)}`).toBe(`${p.id}/${j.id}: ${want}`);
        }
        last = null;
        if (s.kind !== 'card') return;
        const before = JSON.stringify([s, journey.canBack, journey.context(), journey.minutes, store.data]);
        const next = journey.peekNext();
        journey.peekBack();
        expect(JSON.stringify([journey.screen(), journey.canBack, journey.context(), journey.minutes, store.data])).toBe(before);
        if (next) peeks++;
        // Next's promise holds when the owner just taps Next; a card the profile answers first may go elsewhere.
        const sees = s.card.flowKind === 'tutorial' ? j.tutorial_sees ?? {} : j.sees ?? {};
        const taps = s.card.chosen === undefined && sees[s.card.id] !== undefined;
        last = { from: id(s), next: next && (!next.open || !taps) ? next : null };
      });
      expect(got.error).toBeUndefined();
    }
    expect(peeks).toBeGreaterThan(20);
  });

  it('covers a block, an unsafe exit, and a check not repeated after the diagnosis', () => {
    const results = cases.map(({ p, j }) => ({ id: `${p.id}/${j.id}`, d: drive(content, p, j) }));
    expect(results.some((r) => r.d.blocks > 0)).toBe(true);
    const stop = results.find((r) => r.id === 'road-bike-stand/chain-falls-off-on-test-ride')!;
    expect(stop.d.ending).toBe('exit (unsafe) at test-ride-gears');
    // derailleur-alignment is answered in the diagnosis and not shown again in the tutorial
    expect(stop.d.screens.filter((s) => s === 'card derailleur-alignment')).toHaveLength(1);
  });

  it('an unsafe exit with the bike in the stand jumps ahead to putting it back', () => {
    // No content reaches a stop while the bike is held any more (2026-11-26), so the test adds one to a copy.
    const box = new Sandbox();
    try {
      const r = box
        .edit('content/steps/rear-shifting.yaml', (d) => step(d, 'check-low-limit-by-hand').buttons.push({
          id: 'caught', label: 'It catches in the spokes',
          exit: { kind: 'unsafe', text: 'Do not ride. Put the bike back on its wheels and take it to a shop.', show_how_from: 'release-bike' },
        }))
        .edit('profiles/road-bike-stand.yaml', (d) => {
          const j = d.profile.journeys.find((x: any) => x.id === 'chain-falls-off-on-test-ride');
          const sees = { ...j.tutorial_sees, 'check-low-limit-by-hand': 'caught' };
          delete sees['test-ride-gears'];
          d.profile.journeys.push({ ...j, id: 'caught-in-stand', tutorial_sees: sees, after_stop: 'show_how' });
        })
        .run();
      expect(show(r)).toBe('');
      const p = r.content!.profiles.get('road-bike-stand')!.def;
      const j = p.journeys.find((x: any) => x.id === 'caught-in-stand');
      const d = drive(new Content(JSON.parse(r.bundle!)), p, j);
      expect(d.error).toBeUndefined();
      expect(d.ending).toBe('stop, jump ahead, bike put back, shop');
    } finally {
      box.dispose();
    }
  });

  it('a routine check creates a to-do item that opens its tutorial', () => {
    const p = check.content!.profiles.get('city-derailleur-no-stand')!.def;
    const j = p.journeys.find((x: any) => x.id === 'routine-check-slow-shifting');
    const store = new Store(memoryKV());
    const bike = store.addBike(p.name, { ...p.facts, ...p.answers });
    const session = new Session();
    const routine = new Journey(content, store, bike, session, { check: j.start.check });
    for (let i = 0; i < 20 && routine.screen().kind === 'card'; i++) {
      const s = routine.screen();
      if (s.kind !== 'card') break;
      routine.tap(j.sees[s.card.id]);
      routine.next();
    }
    const end = routine.screen();
    expect(end.kind).toBe('todo');
    const item = store.todos(bike).find((f) => f.job === 'adjust-rear-shifting')!;
    expect(item).toBeDefined();
    // Opened later from the home screen: the job screen, then the tutorial's first pre-step.
    const todo = new Journey(content, store, bike, session, { job: item.job!, urgency: item.urgency });
    expect(todo.screen().kind).toBe('job');
    todo.jobDiy();
    const first = todo.screen();
    expect(first.kind).toBe('choice');
  });
});
