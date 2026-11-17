// Starts Vitest with an upper-case drive letter in the working directory.
// On Windows, a working directory like c:\... (as VS Code may open it) makes Vitest
// load its own module twice and fail with "failed to find the current suite".
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)).replace(/^[a-z]:/, (d) => d.toUpperCase());
const r = spawnSync(process.execPath, [vitest, 'run', ...process.argv.slice(2)], { cwd, stdio: 'inherit' });
process.exit(r.status ?? 1);
