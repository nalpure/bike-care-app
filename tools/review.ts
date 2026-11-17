// npm run review: see what needs review, and sign review units.
//
//   npm run review -- status [--role mechanic|beginner] [--all]
//       units that are not approved for the role (or every unit with --all)
//   npm run review -- sign <unit-or-pattern>... --role <role> --by "<name>" [--verdict approved|changes_requested] [--note "..."]
//       appends one entry per unit to reviews/ledger.yaml, with the unit's current hash.
//       Patterns may use *, for example card:step:* or tree:*.

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { formatIssue } from './lib/issues.js';
import { ROLES, type Role } from './lib/review.js';
import { runCheck } from './lib/run.js';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, v !== undefined && !v.startsWith('--') ? 2 : 1);
  return v !== undefined && !v.startsWith('--') ? v : '';
};
const role = flag('--role') as Role | undefined;
const by = flag('--by');
const verdict = flag('--verdict') ?? 'approved';
const note = flag('--note');
const showAll = flag('--all') !== undefined;
const root = resolve(flag('--root') || '.');
const [command, ...rest] = args;

if (!command || command === 'help' || command === '--help') {
  console.log(`npm run review -- status [--role mechanic|beginner] [--all]
npm run review -- sign <unit-or-pattern>... --role mechanic|beginner --by "<name>" [--verdict approved|changes_requested] [--note "..."]

Units: card:<kind>:<id>, tree:<kind>:<id>, journey:<profile>/<journey>. See build/review/index.md.`);
  process.exit(0);
}

const r = runCheck(root, { write: false });
if (!r.flows) {
  for (const i of r.issues.errors) console.error(formatIssue(i));
  console.error('The content does not pass npm run check. Fix it before reviewing.');
  process.exit(1);
}

if (command === 'status') {
  let shown = 0;
  for (const s of r.review) {
    const roles = Object.entries(s.byRole).filter(([rl, x]) => (!role || rl === role) && (showAll || x.status !== 'approved'));
    if (!roles.length) continue;
    shown++;
    console.log(`${s.unit.id}  [${s.unit.hash}]  ${roles.map(([rl, x]) => `${rl}: ${x.status}`).join(', ')}  ${s.unit.file}`);
  }
  const total = r.review.length;
  console.log(`\n${shown} of ${total} units listed${showAll ? '' : ' (not yet approved)'}${role ? ` for ${role}` : ''}.`);
  process.exit(0);
}

if (command === 'sign') {
  if (!role || !ROLES.includes(role)) fail(`--role must be one of ${ROLES.join(', ')}.`);
  if (!by) fail('--by "<name or agent run id>" is required.');
  if (!['approved', 'changes_requested'].includes(verdict)) fail('--verdict must be approved or changes_requested.');
  if (!rest.length) fail('Name at least one unit or pattern.');
  const toRegex = (p: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  const picked = r.review.filter((s) => rest.some((p) => toRegex(p).test(s.unit.id)));
  if (!picked.length) fail(`No unit matches ${rest.join(', ')}. See npm run review -- status --all.`);
  const skipped = picked.filter((s) => !s.unit.roles.includes(role!));
  const signing = picked.filter((s) => s.unit.roles.includes(role!));
  const file = join(root, 'reviews/ledger.yaml');
  const date = new Date().toISOString().slice(0, 10);
  const q = (s: string) => JSON.stringify(s);
  const lines = signing.map((s) =>
    [`  - unit: ${q(s.unit.id)}`, `    hash: "${s.unit.hash}"`, `    role: ${role}`, `    by: ${q(by!)}`, `    date: "${date}"`, `    verdict: ${verdict}`, ...(note ? [`    note: ${q(note)}`] : [])].join('\n'),
  );
  if (lines.length && !existsSync(file)) {
    mkdirSync(join(root, 'reviews'), { recursive: true });
    writeFileSync(file, '# Sign-offs of review units. Append only: write entries with npm run review -- sign.\n# A sign-off counts while the unit keeps the same hash. See build/review/index.md.\n\nreviews:\n');
  }
  if (lines.length) appendFileSync(file, `${lines.join('\n')}\n`);
  console.log(`Signed ${signing.length} unit(s) as ${verdict} for ${role}.`);
  if (skipped.length) console.log(`Skipped ${skipped.length} unit(s) that do not need ${role}: ${skipped.map((s) => s.unit.id).join(', ')}`);
  process.exit(0);
}

fail(`Unknown command "${command}". See npm run review -- help.`);

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}
