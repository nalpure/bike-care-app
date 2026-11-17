// Loads every content file, validates it against its schema and builds an index by id.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Issues } from './issues.js';
import { SchemaValidator, type SchemaName } from './schema.js';
import { lineAt, listDirs, listYaml, parseYamlFile, type YamlFile, type YPath } from './yamlfile.js';

export interface Entry<T = any> {
  def: T;
  file: YamlFile;
  path: YPath;
}

export interface TutorialEntry extends Entry {
  dir: string;
  /** include path (cases/x.yaml) -> parsed case file */
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
  choices: Map<string, Entry>;
  states: Map<string, Entry>;
  tools: Map<string, Entry>;
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
    facts: new Map(), choices: new Map(), states: new Map(), tools: new Map(), parts: new Map(),
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
  if (factsF) register(c.facts, 'fact', factsF, 'facts', 'key');
  const choicesF = load('content/choices.yaml', 'choices');
  if (choicesF) register(c.choices, 'choice', choicesF, 'choices');
  const statesF = load('content/states.yaml', 'states');
  if (statesF) register(c.states, 'state', statesF, 'states');
  const toolsF = load('content/tools.yaml', 'tools');
  if (toolsF) {
    register(c.tools, 'tool', toolsF, 'tools');
    register(c.parts, 'part', toolsF, 'parts');
  }
  const inspF = load('content/inspections.yaml', 'inspections');
  if (inspF) register(c.inspections, 'inspection', inspF, 'inspections');
  const jobsF = load('content/jobs.yaml', 'jobs');
  if (jobsF) register(c.jobs, 'job', jobsF, 'jobs');
  const procF = load('content/procedures.yaml', 'procedures');
  if (procF) register(c.procedures, 'procedure', procF, 'procedures');

  for (const rel of listYaml(root, 'content/steps')) {
    const f = load(rel, 'steps');
    if (f) register(c.steps, 'step', f, 'steps');
  }

  for (const dir of listDirs(root, 'content/tutorials')) {
    const tdir = `content/tutorials/${dir}`;
    const f = load(`${tdir}/tutorial.yaml`, 'tutorial');
    if (!f) continue;
    single(c.tutorials as Map<string, Entry>, 'tutorial', f, 'tutorial');
    const entry = c.tutorials.get(f.data?.tutorial?.id);
    if (!entry || entry.file !== f) continue;
    entry.dir = tdir;
    entry.cases = new Map();
    if (dir !== f.data.tutorial.id) {
      issues.warn(f.rel, `tutorial ${f.data.tutorial.id}`, 'tutorial-folder', `The folder is "${dir}" but the tutorial id is "${f.data.tutorial.id}". Name the folder after the tutorial.`);
    }
    const includes: string[] = [];
    for (const top of f.data.tutorial.cases ?? []) {
      if (top.include) includes.push(top.include);
      for (const leaf of top.cases ?? []) if (leaf.include) includes.push(leaf.include);
    }
    for (const inc of includes) {
      if (entry.cases.has(inc)) continue;
      const rel = posix.join(tdir, inc);
      if (!existsSync(join(root, rel))) {
        issues.error(f.rel, `tutorial ${f.data.tutorial.id}`, 'missing-include', `include ${inc} does not exist (${rel}).`);
        ok = false;
        continue;
      }
      const cf = load(rel, 'case');
      if (cf) entry.cases.set(inc, cf);
    }
    for (const rel of listYaml(root, `${tdir}/cases`)) {
      const inc = rel.slice(tdir.length + 1);
      if (!includes.includes(inc)) {
        issues.warn(rel, '-', 'unused-case', `This case file is not included by ${tdir}/tutorial.yaml.`);
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

  // 3D names: the player's manifest wins once it exists.
  const manifest = join(root, 'build/3d-manifest.json');
  if (existsSync(manifest)) {
    const m = JSON.parse(readFileSync(manifest, 'utf8'));
    c.catalog = {
      nodes: new Set(m.nodes ?? []), views: new Set(m.views ?? []), clips: new Set(m.clips ?? []),
      motions: new Set(m.motions ?? ['rotate', 'push', 'pull', 'slide', 'squeeze', 'remove', 'insert']),
      source: 'build/3d-manifest.json',
    };
  } else {
    const f = load('schema/3d-catalog.yaml', '3d-catalog');
    if (f) {
      c.catalog = {
        nodes: new Set(f.data.nodes ?? []), views: new Set(f.data.views ?? []), clips: new Set(f.data.clips ?? []),
        motions: new Set(f.data.motions ?? ['rotate', 'push', 'pull', 'slide', 'squeeze', 'remove', 'insert']),
        source: 'schema/3d-catalog.yaml',
      };
    }
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
