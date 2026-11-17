// The player resolves flows from build/bundle.json with the shared resolver (tools/lib/resolve.ts).
// These tests make sure that gives exactly what the build tool expanded from the YAML files.

import { describe, expect, it } from 'vitest';
import { UNKNOWN, type Value } from '../lib/conditions.js';
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
