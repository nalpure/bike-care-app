// Writes build/3d-manifest.json from the player's 3D registry (player/src/stage/registry.ts):
// every node, view, clip and motion the player can show. npm run check reads this manifest,
// so content is checked against what the player really has.
// player/test/stage.test.ts fails when the committed manifest and the registry differ.
//
//   npm run manifest

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { manifest } from '../player/src/stage/registry.js';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'build/3d-manifest.json');
mkdirSync(join(root, 'build'), { recursive: true });
const m = manifest();
writeFileSync(out, `${JSON.stringify(m, null, 2)}\n`);
console.log(`Wrote build/3d-manifest.json: ${m.nodes.length} nodes, ${m.views.length} views, ${m.clips.length} clips, ${m.motions.length} motions.`);
