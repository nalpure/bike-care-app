// The player resolves flows from build/bundle.json with the shared resolver (tools/lib/resolve.ts).
// These tests make sure that gives exactly what the build tool expanded from the YAML files.

import { describe, expect, it } from 'vitest';
import { decide, UNKNOWN, type Value } from '../lib/conditions.js';
import { enumerate, resolveDiagnosis, resolveTutorial } from '../lib/expand.js';
import * as R from '../lib/resolve.js';
import { runCheck } from '../lib/run.js';
import { REPO } from './helpers.js';

const fixedReader = (assign: Record<string, Value>): R.Reader => {
  const get = (k: string) => (k in assign ? assign[k] : UNKNOWN);
  return { ask: get, branch: get, peek: get };
};

const shape = (run: R.TutorialRun<unknown>) => ({
  exit: run.exit && { kind: run.exit.kind, message: run.exit.message },
  caseLabel: run.caseLabel,
  items: R.combined(run).map((it) => ({ kind: it.kind, id: it.id, list: it.list, via: it.via, generic: it.generic, buttons: it.buttons.map((b) => b.id), tools: it.tools })),
  stops: R.stopPoints(run),
});

describe('shared resolver on the written bundle', () => {
  const result = runCheck(REPO, { write: false });
  const c = result.content!;
  const bundle = JSON.parse(result.bundle!);
  const ix = R.indexBundle(bundle);

  it('carries the test bikes: names and facts of each profile that knows a fact, no journeys', () => {
    // bike_name wins over the profile name
    expect(bundle.demo_bikes.find((b: any) => b.id === 'road-bike-stand').name).toBe('Corvana Strada SL 3');
    expect(bundle.demo_bikes.map((b: any) => b.id)).toEqual(['city-derailleur-no-stand', 'e-trekking-hub-gear', 'road-bike-stand']);
    for (const b of bundle.demo_bikes) {
      expect(Object.keys(b).sort()).toEqual(['facts', 'id', 'name']);
      expect(b.facts['bike.brand'], b.id).toBeTruthy();
      for (const k of Object.keys(b.facts)) expect(ix.facts.has(k), k).toBe(true);
    }
  });

  it('resolves every tutorial combination like the build tool', () => {
    let n = 0;
    for (const t of c.tutorials.values()) {
      for (const e of enumerate(c, (r) => resolveTutorial(c, t, r))) {
        const fromBundle = R.resolveTutorial(ix, ix.tutorials.get(t.def.id), fixedReader(e.assign));
        expect(shape(fromBundle)).toEqual(shape(e.result));
        n++;
      }
    }
    expect(n).toBeGreaterThan(5);
  });

  it('shows only the tool the bike data names, and every option otherwise', () => {
    const t = ix.tutorials.get('adjust-rear-shifting');
    const base = { 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'choice.hold_bike': 'stand' };
    const sets = (extra: Record<string, Value>) => R.mergeTools(R.combined(R.resolveTutorial(ix, t, fixedReader({ ...base, ...extra }))).map((it) => it.tools)).one_of;
    expect(sets({ 'drive.rear_derailleur_screws': 'hex' })).toEqual([{ set: 'derailleur-screw-tool', options: ['small-hex-keys'], decided: true }]);
    expect(sets({})).toEqual([{ set: 'derailleur-screw-tool', options: ['small-cross-screwdriver', 'small-hex-keys'], decided: false }]);
  });

  it('resolves every diagnosis combination like the build tool', () => {
    for (const d of c.diagnoses.values()) {
      for (const e of enumerate(c, (r) => resolveDiagnosis(c, d, r))) {
        const fromBundle = R.resolveDiagnosis(ix, ix.diagnoses.get(d.def.id), fixedReader(e.assign));
        expect(fromBundle.exit?.message).toEqual(e.result.exit?.message);
        expect(fromBundle.checks.map((x) => [x.id, x.skipped, x.hits])).toEqual(e.result.checks.map((x) => [x.id, x.skipped, x.hits]));
      }
    }
  });
});

describe('decide: a condition from the known values alone', () => {
  const k = (m: Record<string, Value>) => (key: string) => m[key];
  it('is false as soon as one known key fails, whatever is not known yet', () => {
    expect(decide({ a: [1], b: [2] }, k({ b: 3 }))).toBe(false);
    expect(decide({ a: [1], b: [2] }, k({ b: 2 }))).toBeUndefined();
    expect(decide({ a: [1], b: [2] }, k({ a: 1, b: 2 }))).toBe(true);
  });
  it('reads any_of as one of them', () => {
    expect(decide({ any_of: [{ a: [1] }, { b: [2] }] }, k({ b: 2 }))).toBe(true);
    expect(decide({ any_of: [{ a: [1] }, { b: [2] }] }, k({ b: 3 }))).toBeUndefined();
    expect(decide({ any_of: [{ a: [1] }, { b: [2] }] }, k({ a: 0, b: 3 }))).toBe(false);
  });
});
