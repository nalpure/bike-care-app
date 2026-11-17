// npm run check: validate, expand, simulate, write build/.
// Exit code 1 when any error is found. Errors print one per line:
//   ERROR <file>:<line> | <id> | <rule> | <message>

import { resolve } from 'node:path';
import { formatIssue } from './lib/issues.js';
import { runCheck } from './lib/run.js';

const root = resolve(process.argv[2] ?? '.');
const result = runCheck(root, { write: true });

const { issues } = result;
for (const i of issues.errors) console.log(formatIssue(i));
if (issues.warnings.length) {
  console.log('');
  for (const i of issues.warnings) console.log(formatIssue(i));
}
console.log('');
for (const line of result.summary) console.log(line);
console.log(
  issues.errors.length
    ? `check FAILED: ${issues.errors.length} error(s), ${issues.warnings.length} warning(s).`
    : `check passed: 0 errors, ${issues.warnings.length} warning(s).`,
);
process.exit(issues.errors.length ? 1 : 0);
