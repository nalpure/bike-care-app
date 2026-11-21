// JSON Schema validation with readable, one-line errors.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020, type ErrorObject } from 'ajv/dist/2020.js';
import type { Issues } from './issues.js';
import { lineAt, type YamlFile, type YPath } from './yamlfile.js';

const BASE = 'https://bike-app.invalid/schema/';

export type SchemaName =
  | 'facts' | 'choices' | 'states' | 'tools' | 'inspections' | 'jobs' | 'steps' | 'procedures'
  | 'tutorial' | 'case' | 'diagnosis' | 'check' | 'profile' | 'ledger';

export class SchemaValidator {
  private ajv: Ajv2020;

  constructor(root: string) {
    this.ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
    const dir = join(root, 'schema');
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.schema.json')).sort()) {
      this.ajv.addSchema(JSON.parse(readFileSync(join(dir, name), 'utf8')));
    }
  }

  /** Validates one file; returns true when valid. */
  validate(name: SchemaName, file: YamlFile, issues: Issues): boolean {
    const validate = this.ajv.getSchema(`${BASE}${name}.schema.json`);
    if (!validate) throw new Error(`schema ${name} not found`);
    if (validate(file.data)) return true;
    for (const e of filterNoise(validate.errors ?? [])) {
      const path = pointerToPath(e.instancePath);
      issues.error(file.rel, nearestId(file.data, path), ruleFor(e, path), messageFor(e, path, file.data), lineAt(file, path));
    }
    return false;
  }
}

function pointerToPath(p: string): YPath {
  if (!p) return [];
  return p
    .split('/')
    .slice(1)
    .map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

function getAt(data: any, path: YPath): any {
  let cur = data;
  for (const k of path) cur = cur?.[k as any];
  return cur;
}

/** The id (or key) of the nearest enclosing object, with its collection name. */
export function nearestId(data: any, path: YPath): string {
  let best = '-';
  let cur = data;
  let collection = '';
  for (let i = 0; i <= path.length; i++) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      const id = cur.id ?? cur.key;
      if (typeof id === 'string') best = collection ? `${singular(collection)} ${id}` : id;
    }
    if (i < path.length) {
      if (typeof path[i] === 'string') collection = path[i] as string;
      cur = cur?.[path[i] as any];
    }
  }
  return best;
}

function singular(c: string): string {
  const map: Record<string, string> = {
    steps: 'step', inspections: 'inspection', facts: 'fact', fact_groups: 'fact group', tools: 'tool', parts: 'part',
    jobs: 'job', procedures: 'procedure', states: 'state', choices: 'choice', options: 'option',
    tutorial: 'tutorial', diagnosis: 'diagnosis', check: 'check', profile: 'profile', journeys: 'journey',
  };
  return map[c] ?? c;
}

function ruleFor(e: ErrorObject, path: YPath): string {
  const last = path[path.length - 1];
  if (e.keyword === 'maxItems' && last === 'buttons') return 'max-buttons';
  if (e.keyword === 'maxItems' && last === 'states') return 'max-states';
  if (e.keyword === 'additionalProperties') return 'unknown-key';
  if (e.keyword === 'required') return 'missing-key';
  return `schema-${e.keyword}`;
}

function messageFor(e: ErrorObject, path: YPath, data: any): string {
  const where = path.length ? path.join('.') : 'top level';
  const p = e.params as any;
  switch (e.keyword) {
    case 'additionalProperties':
      return `${where}: unknown key "${p.additionalProperty}". Unknown keys are errors; request schema changes in docs/schema-requests.md.`;
    case 'required':
      return `${where}: missing required key "${p.missingProperty}".`;
    case 'enum':
      return `${where}: must be one of: ${(p.allowedValues as unknown[]).join(', ')}.`;
    case 'maxItems': {
      const n = (getAt(data, path) as unknown[] | undefined)?.length;
      return `${where}: has ${n} items; at most ${p.limit} allowed.`;
    }
    case 'minItems':
      return `${where}: needs at least ${p.limit} items.`;
    case 'pattern':
      return `${where}: "${getAt(data, path)}" does not match the allowed form ${p.pattern}.`;
    case 'propertyNames':
      return `${where}: key "${p.propertyName}" is not an allowed name.`;
    case 'dependentRequired':
      return `${where}: "${p.property}" also needs "${p.missingProperty}".`;
    case 'anyOf':
      return `${where}: does not match any allowed form.`;
    default:
      return `${where}: ${e.message}.`;
  }
}

/** Drop the follow-on errors that anyOf and if/then produce next to the real one. */
function filterNoise(errors: ErrorObject[]): ErrorObject[] {
  const noisy = (e: ErrorObject) =>
    e.keyword === 'if' ||
    (e.schemaPath.includes('/anyOf/') && ['const', 'type', 'enum'].includes(e.keyword)) ||
    e.keyword === 'anyOf';
  const real = errors.filter((e) => !noisy(e));
  const out = [...real];
  for (const e of errors) {
    if (!noisy(e) || e.keyword === 'if') continue;
    const covered = real.some((r) => r.instancePath.startsWith(e.instancePath));
    if (!covered && e.keyword === 'anyOf') out.push(e);
  }
  // A string where an object was allowed reports only through anyOf; keep at least one error.
  if (!out.length && errors.length) out.push(errors[0]);
  return out;
}
