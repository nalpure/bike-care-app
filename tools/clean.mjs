// `npm run clean`: delete everything an agent or a run produced and git ignores: scratch/ (throw-away
// scripts, screenshots, probe output), dist/ (static build). The parts library, build/ and node_modules/ stay.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const dir of ['scratch', 'dist']) {
  rmSync(root + dir, { recursive: true, force: true });
  console.log(`removed ${dir}/`);
}
