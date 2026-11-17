// Walks every profile journey through the player's engine and checks that it ends where
// npm run check says it ends (build/report.md, Profiles), with the same time.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../../tools/lib/run.js';
import { REPO } from '../../tools/test/helpers.js';
import { Content } from '../src/engine/content.js';
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
});
