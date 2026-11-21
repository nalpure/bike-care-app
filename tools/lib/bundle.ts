// The bundle data (build/bundle.json without its header), built once per content load, and a
// locator that maps each bundle object back to its YAML file and path, for error messages.
// The shared resolver (resolve.ts) works on this data, in the build tool and in the player.

import type { Content, Entry } from './content.js';
import type { Src } from './expand.js';
import { indexBundle, type BundleData, type Index, type Locate } from './resolve.js';

export interface BundleView {
  data: BundleData;
  index: Index;
  locate: Locate<Src>;
}

const cache = new WeakMap<Content, BundleView>();

export function bundleOf(c: Content): BundleView {
  const hit = cache.get(c);
  if (hit) return hit;
  const where = new WeakMap<object, Src>();
  const defs = (m: Map<string, Entry>) =>
    [...m.values()].map((e) => {
      if (e.def && typeof e.def === 'object') where.set(e.def, { file: e.file, path: e.path });
      return e.def;
    });

  const tutorials = [...c.tutorials.values()].map((t) => {
    const resolve = (cs: any, path: (string | number)[]): any => {
      const out: any = { ...cs };
      where.set(out, { file: t.file, path });
      if (cs.include) {
        const cf = t.cases.get(cs.include);
        if (cf) {
          delete out.include;
          out.case = { name: cs.include.replace(/^cases\//, '').replace(/\.yaml$/, ''), sequence: cf.data.sequence ?? [], finish: cf.data.finish ?? [] };
          where.set(out.case, { file: cf, path: [] });
        }
      }
      if (cs.cases) out.cases = cs.cases.map((x: any, i: number) => resolve(x, [...path, 'cases', i]));
      return out;
    };
    const node = { ...t.def, cases: t.def.cases.map((cs: any, i: number) => resolve(cs, [...t.path, 'cases', i])) };
    where.set(node, { file: t.file, path: t.path });
    return node;
  });

  const data: BundleData = {
    fact_groups: defs(c.factGroups),
    facts: defs(c.facts),
    choices: defs(c.choices),
    states: defs(c.states),
    tools: defs(c.tools),
    tool_sets: defs(c.toolSets),
    parts: defs(c.parts),
    inspections: defs(c.inspections),
    jobs: defs(c.jobs),
    steps: defs(c.steps),
    procedures: defs(c.procedures),
    tutorials,
    diagnoses: defs(c.diagnoses),
    checks: defs(c.checks),
  };
  const locate: Locate<Src> = (node, ...sub) => {
    const base = where.get(node);
    if (!base) throw new Error('bundle object without a source location');
    return { file: base.file, path: [...base.path, ...sub] };
  };
  const view = { data, index: indexBundle(data), locate };
  cache.set(c, view);
  return view;
}
