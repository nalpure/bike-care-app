// YAML loading. Parses as YAML 1.2 (core schema), so on/off/yes/no stay strings.
// Keeps the parsed document so issues can point at a line.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import YAML, { LineCounter, isNode } from 'yaml';
import type { Issues } from './issues.js';

export type YPath = (string | number)[];

export interface YamlFile {
  rel: string; // repo-relative, forward slashes
  data: any;
  doc: YAML.Document;
  lc: LineCounter;
}

export function parseYamlFile(root: string, rel: string, issues: Issues): YamlFile | null {
  const text = readFileSync(join(root, rel), 'utf8');
  const lc = new LineCounter();
  const doc = YAML.parseDocument(text, {
    version: '1.2',
    schema: 'core',
    uniqueKeys: true,
    lineCounter: lc,
    prettyErrors: false,
  });
  for (const e of doc.errors) {
    issues.error(rel, '-', 'yaml-parse', e.message.split('\n')[0], e.linePos?.[0]?.line);
  }
  for (const w of doc.warnings) {
    issues.warn(rel, '-', 'yaml-warning', w.message.split('\n')[0], w.linePos?.[0]?.line);
  }
  if (doc.errors.length) return null;
  return { rel, data: doc.toJS({ maxAliasCount: 50 }), doc, lc };
}

/** Line of the deepest existing node along path. */
export function lineAt(f: YamlFile, path: YPath): number | undefined {
  for (let n = path.length; n >= 0; n--) {
    const node = n === 0 ? f.doc.contents : f.doc.getIn(path.slice(0, n), true);
    if (node && isNode(node) && node.range) return f.lc.linePos(node.range[0]).line;
  }
  return undefined;
}

/** Sorted .yaml files directly inside dir (repo-relative paths). */
export function listYaml(root: string, dir: string): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return [];
  return readdirSync(abs)
    .filter((n) => n.endsWith('.yaml') || n.endsWith('.yml'))
    .sort()
    .map((n) => `${dir}/${n}`);
}

/** Sorted sub-directories of dir. */
export function listDirs(root: string, dir: string): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((n) => statSync(join(abs, n)).isDirectory())
    .sort();
}
