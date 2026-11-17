// The whole check as one function, so tests can run it on a copy of the content.
//
// Stages: 1 schema, 2 references and static rules, 3 expansion, simulation, coverage and
// profile journeys, 4 output. A stage runs only when the stages before it found no errors.

import { loadContent, type Content } from './content.js';
import { buildFlows, type Flows } from './flows.js';
import { Issues } from './issues.js';
import { runProfile, type JourneyResult } from './journeys.js';
import { buildBundle, buildOutputs, pathCount, renderReport, writeOutputs, type Outputs } from './output.js';
import { checkStatic } from './refs.js';

export interface RunOptions {
  /** write build/ (bundle only when there are no errors) */
  write: boolean;
}

export interface RunResult {
  issues: Issues;
  content: Content | null;
  flows: Flows | null;
  profiles: Map<string, { markdown: string; results: JourneyResult[] }>;
  outputs: Outputs | null;
  report: string | null;
  bundle: string | null;
  summary: string[];
}

export function runCheck(root: string, opts: RunOptions): RunResult {
  const issues = new Issues();
  const result: RunResult = { issues, content: null, flows: null, profiles: new Map(), outputs: null, report: null, bundle: null, summary: [] };
  const content = loadContent(root, issues);
  result.content = content;
  if (!content) {
    result.summary.push('Stopped after schema validation. Fix the errors above first.');
    return result;
  }
  checkStatic(content, issues);
  if (issues.errors.length) {
    result.summary.push('Stopped after reference checks. Fix the errors above first.');
    return result;
  }
  const flows = buildFlows(content, issues);
  result.flows = flows;
  for (const p of content.profiles.values()) result.profiles.set(p.def.id, runProfile(content, p, issues));

  result.outputs = buildOutputs(content, flows, result.profiles);
  result.report = renderReport(content, flows, result.profiles, issues);
  result.bundle = issues.errors.length ? null : buildBundle(content);
  if (opts.write) writeOutputs(root, result.outputs, result.report, result.bundle);

  result.summary.push(`Validated ${content.files.length} files; expanded ${pathCount(flows)} paths.`);
  for (const t of flows.tutorials) result.summary.push(`  tutorial ${t.id}: ${t.paths.length} paths, ${t.exits.length} exits before the first step`);
  for (const d of flows.diagnoses) result.summary.push(`  diagnosis ${d.id}: ${d.paths.length} paths, ${d.exits.length} not-covered exits`);
  for (const [id, p] of result.profiles) for (const r of p.results) result.summary.push(`  profile ${id} / ${r.journey}: ${r.ending}, ${r.minutes} min`);
  if (opts.write) result.summary.push(`Wrote build/walkthroughs/ (${result.outputs.files.size} files), build/report.md${result.bundle ? ', build/bundle.json' : ''}.`);
  return result;
}
