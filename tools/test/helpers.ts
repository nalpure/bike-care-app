// Test helpers: copy the real content to a temp folder, break it on purpose, run the check.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { formatIssue, type Issue } from '../lib/issues.js';
import { runCheck, type RunResult } from '../lib/run.js';

export const REPO = resolve(import.meta.dirname, '../..');

export class Sandbox {
  readonly root: string;

  constructor() {
    this.root = mkdtempSync(join(tmpdir(), 'bike-check-'));
    for (const dir of ['schema', 'content', 'profiles']) cpSync(join(REPO, dir), join(this.root, dir), { recursive: true });
    cpSync(join(REPO, 'build/3d-manifest.json'), join(this.root, 'build/3d-manifest.json'));
  }

  /** Parse a YAML file, change it, write it back. */
  edit(rel: string, change: (data: any) => void): this {
    const abs = join(this.root, rel);
    const data = YAML.parse(readFileSync(abs, 'utf8'), { version: '1.2' });
    change(data);
    writeFileSync(abs, YAML.stringify(data, { version: '1.2' }));
    return this;
  }

  /** Replace text in a file (for changes that must keep the YAML as written). */
  replace(rel: string, from: string, to: string): this {
    const abs = join(this.root, rel);
    const text = readFileSync(abs, 'utf8');
    if (!text.includes(from)) throw new Error(`"${from}" not found in ${rel}`);
    writeFileSync(abs, text.replace(from, to));
    return this;
  }

  run(write = false): RunResult {
    return runCheck(this.root, { write });
  }

  dispose(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}

export function errorsOf(r: RunResult, rule?: string): Issue[] {
  return r.issues.errors.filter((i) => !rule || i.rule === rule);
}

export function show(r: RunResult): string {
  return r.issues.errors.map(formatIssue).join('\n');
}

export function step(data: any, id: string): any {
  const s = data.steps.find((x: any) => x.id === id);
  if (!s) throw new Error(`step ${id} not found`);
  return s;
}
