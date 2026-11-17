// npm run walk: render complete paths on demand. Nothing here is committed.
//
//   npm run walk -- --list [flow]        list every path id with where it ends and its time
//   npm run walk -- <path-id> [--flow f]  print one path as the user sees it
//   npm run walk -- --all                write every path to build/paths/ (ignored by git)

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { formatIssue } from './lib/issues.js';
import { renderDiagnosisIndex, renderDiagnosisPath, renderTutorialIndex, renderTutorialPath } from './lib/render.js';
import { runCheck } from './lib/run.js';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : '';
};
const help = flag('--help') !== undefined || flag('help') !== undefined;
const list = flag('--list');
const all = flag('--all') !== undefined;
const onlyFlow = flag('--flow');
const root = resolve(flag('--root') || '.');

if (help) {
  console.log('npm run walk -- --list [flow] | <path-id> [--flow <flow>] | --all');
  process.exit(0);
}

const r = runCheck(root, { write: false });
if (!r.flows || !r.content) {
  for (const i of r.issues.errors) console.error(formatIssue(i));
  console.error('The content does not pass npm run check, so paths cannot be rendered.');
  process.exit(1);
}
const c = r.content;
const flows = r.flows;

if (list !== undefined) {
  for (const t of flows.tutorials) if (!list || t.id === list) console.log(renderTutorialIndex(c, t));
  for (const d of flows.diagnoses) if (!list || d.id === list) console.log(renderDiagnosisIndex(c, d));
  process.exit(0);
}

if (all) {
  const out = join(root, 'build/paths');
  rmSync(out, { recursive: true, force: true });
  let n = 0;
  const write = (rel: string, text: string) => {
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), `${text}\n`);
    n++;
  };
  for (const t of flows.tutorials) for (const p of t.paths) write(`${t.id}/${p.id}.md`, renderTutorialPath(c, t, p));
  for (const d of flows.diagnoses) for (const p of d.paths) write(`${d.id}/${p.id}.md`, renderDiagnosisPath(c, d, p));
  console.log(`Wrote ${n} paths to build/paths/ (not committed).`);
  process.exit(0);
}

const id = args[0];
if (!id) {
  console.error('Name a path id, or use --list. See npm run walk -- --help.');
  process.exit(1);
}
const found: string[] = [];
for (const t of flows.tutorials) {
  if (onlyFlow && t.id !== onlyFlow) continue;
  const p = t.paths.find((x) => x.id === id);
  if (p) found.push(renderTutorialPath(c, t, p));
}
for (const d of flows.diagnoses) {
  if (onlyFlow && d.id !== onlyFlow) continue;
  const p = d.paths.find((x) => x.id === id);
  if (p) found.push(renderDiagnosisPath(c, d, p));
}
if (!found.length) {
  console.error(`No path "${id}". List them with npm run walk -- --list.`);
  process.exit(1);
}
if (found.length > 1) {
  console.error(`"${id}" exists in several flows. Add --flow <flow-id>.`);
  process.exit(1);
}
console.log(found[0]);
