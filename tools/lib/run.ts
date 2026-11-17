// The whole check as one function, so tests can run it on a copy of the content.

import { loadContent, type Content } from './content.js';
import { Issues } from './issues.js';
import { checkStatic } from './refs.js';

export interface RunOptions {
  write: boolean;
}

export interface RunResult {
  issues: Issues;
  content: Content | null;
  summary: string[];
}

export function runCheck(root: string, opts: RunOptions): RunResult {
  const issues = new Issues();
  const summary: string[] = [];
  const content = loadContent(root, issues);
  if (!content) {
    summary.push('Stopped after schema validation. Fix the errors above first.');
    return { issues, content, summary };
  }
  checkStatic(content, issues);
  if (issues.errors.length) {
    summary.push('Stopped after reference checks. Fix the errors above first.');
    return { issues, content, summary };
  }
  summary.push(`Validated ${content.files.length} files.`);
  void opts;
  return { issues, content, summary };
}
