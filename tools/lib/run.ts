// The whole check as one function, so tests can run it on a copy of the content.

import { loadContent, type Content } from './content.js';
import { buildFlows, type Flows } from './flows.js';
import { Issues } from './issues.js';
import { checkStatic } from './refs.js';

export interface RunOptions {
  /** write build/ (bundle only when there are no errors) */
  write: boolean;
}

export interface RunResult {
  issues: Issues;
  content: Content | null;
  flows: Flows | null;
  summary: string[];
}

export function runCheck(root: string, opts: RunOptions): RunResult {
  const issues = new Issues();
  const summary: string[] = [];
  const content = loadContent(root, issues);
  if (!content) {
    summary.push('Stopped after schema validation. Fix the errors above first.');
    return { issues, content, flows: null, summary };
  }
  checkStatic(content, issues);
  if (issues.errors.length) {
    summary.push('Stopped after reference checks. Fix the errors above first.');
    return { issues, content, flows: null, summary };
  }
  const flows = buildFlows(content, issues);
  summary.push(`Validated ${content.files.length} files.`);
  for (const t of flows.tutorials) {
    summary.push(`Tutorial ${t.id}: ${t.paths.length} paths, ${t.exits.length} exits.`);
  }
  for (const d of flows.diagnoses) {
    summary.push(`Diagnosis ${d.id}: ${d.paths.length} paths, ${d.exits.length} exits.`);
  }
  void opts;
  return { issues, content, flows, summary };
}
