// Walks every profile journey through the player's engine and checks that it ends where
// npm run check says it ends (build/report.md, Profiles), with the same time.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../../tools/lib/run.js';
import { REPO } from '../../tools/test/helpers.js';
import { Content } from '../src/engine/content.js';
import { Journey, Session } from '../src/engine/journey.js';
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

  it('covers a block, an unsafe exit with jump ahead, and a check not repeated after the diagnosis', () => {
    const results = cases.map(({ p, j }) => ({ id: `${p.id}/${j.id}`, d: drive(content, p, j) }));
    expect(results.some((r) => r.d.blocks > 0)).toBe(true);
    const jump = results.find((r) => r.id === 'road-bike-stand/chain-touches-spokes')!;
    expect(jump.d.ending).toBe('stop, jump ahead, bike put back, shop');
    // derailleur-alignment is answered in the diagnosis and not shown again in the tutorial
    expect(jump.d.screens.filter((s) => s === 'card derailleur-alignment')).toHaveLength(1);
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
