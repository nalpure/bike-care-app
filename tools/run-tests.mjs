// Starts Vitest with an upper-case drive letter in the working directory.
// On Windows, a working directory like c:\... (as VS Code may open it) makes Vitest
// load its own module twice and fail with "failed to find the current suite".
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { constants, setPriority } from 'node:os';

// Below-normal priority (the Vitest workers inherit it), so other work on the machine comes first.
try {
  setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
} catch { /* not allowed here: run at normal priority */ }

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)).replace(/^[a-z]:/, (d) => d.toUpperCase());
const r = spawnSync(process.execPath, [vitest, 'run', ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(r.status ?? 1);
