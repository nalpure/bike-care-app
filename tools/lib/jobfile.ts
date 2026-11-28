// One job file (content/jobs/<job id>.yaml): the header, the flow and the job's own cards.
//
// The loader expands it into the structures the rest of the build reads, so references, resolving,
// simulation and the bundle work on the same shapes for every job:
//  - the job entry: the header without the tutorial fields;
//  - the tutorial (only when the file has a flow): the tutorial fields, the questions, and one case per way;
//  - each way's case: the work and the finish with every branch resolved for that way;
//  - the cards, as steps.
// The tutorial and the cases are views of the job file (YamlFile.toDoc): an issue found in them points at
// the line in the job file the item came from.

import type { Issues } from './issues.js';
import { lineAt, type YamlFile, type YPath } from './yamlfile.js';

/** Header keys that belong to the tutorial, not to the job entry. */
const TUTORIAL_KEYS = ['params', 'difficulty', 'choices', 'parts'];
/** The name of the only way of a flow without ways. */
export const ONE_WAY = 'main';

export interface ExpandedJob {
  job: any;
  tutorial?: {
    def: any;
    file: YamlFile;
    /** way name -> the way's case (a view with sequence and finish) */
    cases: Map<string, YamlFile>;
  };
  /** own card ids in the order the flow first uses them */
  firstUse: string[];
}

/** Expands a parsed, schema-valid job file. Returns null when the flow cannot be expanded. */
export function expandJobFile(f: YamlFile, issues: Issues): ExpandedJob | null {
  const header = f.data.job;
  const job: any = {};
  for (const [k, v] of Object.entries(header)) if (!TUTORIAL_KEYS.includes(k)) job[k] = v;
  const flow = f.data.flow;
  if (!flow) return { job, firstUse: [] };

  const id: string = header.id;
  const where = `tutorial ${id}`;
  let ok = true;
  const wayDefs: Record<string, any> = flow.ways ?? {};
  const ways = flow.ways ? Object.keys(wayDefs) : [ONE_WAY];

  // Each way's items, with the path in the job file each item came from.
  const lists: Record<string, Record<'sequence' | 'finish', { items: any[]; from: YPath[] }>> = {};
  for (const w of ways) lists[w] = { sequence: { items: [], from: [] }, finish: { items: [], from: [] } };
  const firstUse: string[] = [];
  const use = (it: any) => {
    if (typeof it === 'string' && !firstUse.includes(it)) firstUse.push(it);
  };
  const add = (w: string, list: 'sequence' | 'finish', it: any, from: YPath) => {
    lists[w][list].items.push(typeof it === 'string' ? { step: it } : it);
    lists[w][list].from.push(from);
  };
  for (const [list, key] of [['sequence', 'work'], ['finish', 'finish']] as const) {
    (flow[key] ?? []).forEach((it: any, i: number) => {
      const at: YPath = ['flow', key, i];
      if (it && typeof it === 'object' && it.branch) {
        const others = Object.keys(it).filter((k) => k !== 'branch');
        if (others.length) {
          issues.error(f.rel, where, 'item-kind', `A branch stands alone; this item also has ${others.join(', ')}.`, lineAt(f, at));
          ok = false;
        }
        const named = Object.keys(it.branch);
        if (!flow.ways) {
          issues.error(f.rel, where, 'branch-ways', 'A branch needs the ways it splits into, in flow.ways.', lineAt(f, at));
          ok = false;
          return;
        }
        const missing = ways.filter((w) => !named.includes(w));
        const unknown = named.filter((w) => !ways.includes(w));
        if (missing.length || unknown.length) {
          const parts = [unknown.length ? `names ${unknown.join(', ')}, which ${unknown.length > 1 ? 'are not ways' : 'is not a way'}` : '', missing.length ? `misses ${missing.join(', ')}` : ''].filter(Boolean);
          issues.error(f.rel, where, 'branch-ways', `This branch ${parts.join(' and ')}. A branch names every way in flow.ways (${ways.join(', ')}); give a way with nothing here an empty list.`, lineAt(f, [...at, 'branch']));
          ok = false;
          return;
        }
        for (const w of named) {
          it.branch[w].forEach((x: any, j: number) => {
            use(x);
            add(w, list, x, [...at, 'branch', w, j]);
          });
        }
        return;
      }
      use(it);
      for (const w of ways) add(w, list, it, at);
    });
  }
  if (!ok) return null;

  const view = (data: any, toDoc: (p: YPath) => YPath): YamlFile => ({ rel: f.rel, data, doc: f.doc, lc: f.lc, toDoc });
  const cases = new Map<string, YamlFile>();
  for (const w of ways) {
    const l = lists[w];
    const data: any = { sequence: l.sequence.items };
    if (l.finish.items.length) data.finish = l.finish.items;
    cases.set(w, view(data, (p) => {
      const list = p[0] as 'sequence' | 'finish';
      if (list !== 'sequence' && list !== 'finish') return ['flow'];
      if (typeof p[1] !== 'number') return ['flow', list === 'sequence' ? 'work' : 'finish'];
      return [...l[list].from[p[1]], ...p.slice(2)];
    }));
  }

  // The tutorial, in the shape the bundle has always had: tutorial fields, cases, id, job.
  const def: any = {};
  for (const [k, v] of Object.entries(header)) if (TUTORIAL_KEYS.includes(k)) def[k] = v;
  if (flow.questions) def.questions = flow.questions;
  def.cases = ways.map((w) => (flow.ways ? { when: wayDefs[w].when, way: w } : { way: w }));
  def.id = id;
  def.job = id;
  const file = view({ tutorial: def }, (p) => {
    const [, k, ...rest] = p;
    if (k === undefined || k === 'id' || k === 'job') return ['flow'];
    if (TUTORIAL_KEYS.includes(k as string)) return ['job', k, ...rest];
    if (k === 'questions') return ['flow', k, ...rest];
    if (k === 'cases') {
      const i = rest[0];
      if (!flow.ways || typeof i !== 'number') return ['flow', 'ways'];
      return ['flow', 'ways', ways[i], ...rest.slice(1)];
    }
    return ['flow'];
  });
  return { job, tutorial: { def, file, cases }, firstUse };
}
