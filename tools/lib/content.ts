// Loads every content file, validates it against its schema and builds an index by id.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Issues } from './issues.js';
import { SchemaValidator, type SchemaName } from './schema.js';
import { expandJobFile } from './jobfile.js';
import { lineAt, listYaml, parseYamlFile, type YamlFile, type YPath } from './yamlfile.js';

export interface Entry<T = any> {
  def: T;
  file: YamlFile;
  path: YPath;
  /** a card: the job whose file defines it; unset for a shared card in content/steps/ */
  job?: string;
}

export interface TutorialEntry extends Entry {
  /** way name -> the way's case (a view of the job file with sequence and finish) */
  cases: Map<string, YamlFile>;
}

export interface Catalog3d {
  nodes: Set<string>;
  views: Set<string>;
  clips: Set<string>;
  motions: Set<string>;
  source: string;
}

export interface Content {
  root: string;
  files: YamlFile[];
  facts: Map<string, Entry>;
  /** fact groups: the part of a fact key before the first dot */
  factGroups: Map<string, Entry>;
  choices: Map<string, Entry>;
  states: Map<string, Entry>;
  tools: Map<string, Entry>;
  toolSets: Map<string, Entry>;
  parts: Map<string, Entry>;
  inspections: Map<string, Entry>;
  jobs: Map<string, Entry>;
  steps: Map<string, Entry>;
  procedures: Map<string, Entry>;
  tutorials: Map<string, TutorialEntry>;
  diagnoses: Map<string, Entry>;
  checks: Map<string, Entry>;
  profiles: Map<string, Entry>;
  catalog: Catalog3d;
  /** reviews/ledger.yaml, when it exists */
  ledger?: YamlFile;
}

export function where(e: Entry): { file: string; line?: number } {
  return { file: e.file.rel, line: lineAt(e.file, e.path) };
}

export function loadContent(root: string, issues: Issues): Content | null {
  const validator = new SchemaValidator(root);
  const c: Content = {
    root,
    files: [],
    facts: new Map(), factGroups: new Map(), choices: new Map(), states: new Map(), tools: new Map(), toolSets: new Map(), parts: new Map(),
    inspections: new Map(), jobs: new Map(), steps: new Map(), procedures: new Map(),
    tutorials: new Map(), diagnoses: new Map(), checks: new Map(), profiles: new Map(),
    catalog: { nodes: new Set(), views: new Set(), clips: new Set(), motions: new Set(), source: '' },
  };
  let ok = true;

  const load = (rel: string, schema: SchemaName, required = true): YamlFile | null => {
    if (!existsSync(join(root, rel))) {
      if (required) {
        issues.error(rel, '-', 'missing-file', `Required file ${rel} does not exist.`);
        ok = false;
      }
      return null;
    }
    const f = parseYamlFile(root, rel, issues);
    if (!f) {
      ok = false;
      return null;
    }
    c.files.push(f);
    if (!validator.validate(schema, f, issues)) ok = false;
    return f;
  };

  const register = (map: Map<string, Entry>, kind: string, f: YamlFile, list: string, idKey = 'id') => {
    const arr = f.data?.[list];
    if (!Array.isArray(arr)) return;
    arr.forEach((def: any, i: number) => {
      const id = def?.[idKey];
      if (typeof id !== 'string') return;
      const prev = map.get(id);
      if (prev) {
        issues.error(f.rel, `${kind} ${id}`, 'duplicate-id', `${kind} "${id}" is already defined in ${prev.file.rel}.`, lineAt(f, [list, i]));
        ok = false;
        return;
      }
      map.set(id, { def, file: f, path: [list, i] });
    });
  };

  const single = (map: Map<string, Entry>, kind: string, f: YamlFile, top: string) => {
    const def = f.data?.[top];
    if (!def || typeof def.id !== 'string') return;
    const prev = map.get(def.id);
    if (prev) {
      issues.error(f.rel, `${kind} ${def.id}`, 'duplicate-id', `${kind} "${def.id}" is already defined in ${prev.file.rel}.`, lineAt(f, [top]));
      ok = false;
      return;
    }
    map.set(def.id, { def, file: f, path: [top] });
  };

  // Catalog files
  const factsF = load('content/facts.yaml', 'facts');
  if (factsF) {
    register(c.factGroups, 'fact group', factsF, 'fact_groups');
    register(c.facts, 'fact', factsF, 'facts', 'key');
  }
  const choicesF = load('content/choices.yaml', 'choices');
  if (choicesF) register(c.choices, 'choice', choicesF, 'choices');
  const statesF = load('content/states.yaml', 'states');
  if (statesF) register(c.states, 'state', statesF, 'states');
  const toolsF = load('content/tools.yaml', 'tools');
  if (toolsF) {
    register(c.tools, 'tool', toolsF, 'tools');
    register(c.toolSets, 'tool set', toolsF, 'tool_sets');
    register(c.parts, 'part', toolsF, 'parts');
  }
  const inspF = load('content/inspections.yaml', 'inspections');
  if (inspF) register(c.inspections, 'inspection', inspF, 'inspections');
  const procF = load('content/procedures.yaml', 'procedures');
  if (procF) register(c.procedures, 'procedure', procF, 'procedures');

  for (const rel of listYaml(root, 'content/steps')) {
    const f = load(rel, 'steps');
    if (f) register(c.steps, 'step', f, 'steps');
  }

  // One file per job: the header, the flow (the tutorial) and the job's own cards, expanded into a job entry,
  // a tutorial with one case per way, and steps (jobfile.ts).
  for (const rel of listYaml(root, 'content/jobs')) {
    const f = load(rel, 'job');
    const header = f?.data?.job;
    if (!f || !header || typeof header.id !== 'string') continue;
    const name = posix.basename(rel).replace(/\.ya?ml$/, '');
    if (name !== header.id) {
      issues.error(rel, `job ${header.id}`, 'job-file-name', `The file is named "${name}", but the job's id is "${header.id}". Name the file after its job.`, lineAt(f, ['job', 'id']));
      ok = false;
      continue;
    }
    const x = expandJobFile(f, issues);
    if (!x) {
      ok = false;
      continue;
    }
    c.jobs.set(header.id, { def: x.job, file: f, path: ['job'] });
    if (x.tutorial) {
      x.job.tutorial = header.id;
      c.tutorials.set(header.id, { def: x.tutorial.def, file: x.tutorial.file, path: ['tutorial'], cases: x.tutorial.cases });
    }
    const before = c.steps.size;
    register(c.steps, 'step', f, 'cards');
    const own = (f.data.cards ?? []).map((s: any) => s?.id).filter((s: unknown) => typeof s === 'string');
    for (const e of c.steps.values()) if (e.file === f) e.job = header.id;
    if (c.steps.size - before === own.length) {
      // The cards in the order the flow first uses them, so the file reads top to bottom.
      const order = x.firstUse.filter((s) => own.includes(s));
      const rest = own.filter((s: string) => !order.includes(s));
      const want = [...order, ...rest];
      const i = own.findIndex((s: string, k: number) => s !== want[k]);
      if (i >= 0) {
        issues.warn(rel, `step ${want[i]}`, 'card-order', `Card ${want[i]} should come before card ${own[i]}: the flow uses it first. Keep the cards in the order the flow first uses them (${want.join(', ')}).`, lineAt(f, ['cards', own.indexOf(want[i])]));
      }
    }
  }

  for (const rel of listYaml(root, 'content/diagnoses')) {
    const f = load(rel, 'diagnosis');
    if (f) single(c.diagnoses, 'diagnosis', f, 'diagnosis');
  }
  for (const rel of listYaml(root, 'content/checks')) {
    const f = load(rel, 'check');
    if (f) single(c.checks, 'check', f, 'check');
  }
  for (const rel of listYaml(root, 'profiles')) {
    const f = load(rel, 'profile');
    if (f) single(c.profiles, 'profile', f, 'profile');
  }

  const ledger = load('reviews/ledger.yaml', 'ledger', false);
  if (ledger) c.ledger = ledger;

  // 3D names: the player's registry, exported by npm run manifest.
  const manifest = join(root, 'build/3d-manifest.json');
  if (!existsSync(manifest)) {
    issues.error('build/3d-manifest.json', '-', 'missing-file', 'The 3D names are missing. Run npm run manifest.');
    ok = false;
  } else {
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    c.catalog = {
      nodes: new Set(m.nodes ?? []), views: new Set(m.views ?? []), clips: new Set(m.clips ?? []),
      motions: new Set(m.motions ?? ['rotate', 'push', 'pull', 'slide', 'squeeze', 'remove', 'insert']),
      source: 'build/3d-manifest.json',
    };
  }

  // Files in content/ that no loader reads
  const known = new Set(c.files.map((f) => f.rel));
  const walk = (dir: string) => {
    const abs = join(root, dir);
    if (!existsSync(abs)) return;
    for (const d of readdirSync(abs, { withFileTypes: true })) {
      const rel = `${dir}/${d.name}`;
      if (d.isDirectory()) {
        if (rel !== 'content/review') walk(rel);
      } else if ((d.name.endsWith('.yaml') || d.name.endsWith('.yml')) && !known.has(rel)) {
        issues.warn(rel, '-', 'unread-file', 'No part of the build reads this file. Check its folder and name against CLAUDE.md.');
      }
    }
  };
  walk('content');

  return ok ? c : null;
}
