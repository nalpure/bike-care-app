// A fingerprint of the generated 3D bike, to prove a refactor of player/src/stage/ changes nothing.
// For many bikes and every derailleur position it records, per mesh in traversal order, the part id,
// the world matrix (every instance matrix for instanced meshes) and a hash of the position array.
//
//   npx tsx tools/stage-digest.ts tools/assets/out/digest-before.json
//   (change code)
//   npx tsx tools/stage-digest.ts tools/assets/out/digest-after.json
//   and compare the two files: the per-bike, per-step hashes must be identical.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as T from 'three';
import YAML from 'yaml';
import { BikeModel, bikeSpec, GAP_BIG, GAP_OK, GAP_SMALL, GEOMETRY_RANGES } from '../player/src/stage/bike.js';
import { loadLibrary } from '../player/src/stage/library.js';

const root = resolve(import.meta.dirname, '..');
// the parts library, as the app loads it at start (player/test/setup-library.ts does the same)
const lib = readFileSync(join(root, 'player/public/parts/library.glb'));
await loadLibrary(lib.buffer.slice(lib.byteOffset, lib.byteOffset + lib.byteLength) as ArrayBuffer);
const out = process.argv[2];
if (!out) {
  console.error('usage: npx tsx tools/stage-digest.ts <out.json>');
  process.exit(1);
}

type Facts = Record<string, unknown>;
const bikes: Array<{ name: string; facts: Facts }> = [];

for (const f of readdirSync(join(root, 'profiles')).filter((n) => n.endsWith('.yaml')).sort()) {
  const doc = YAML.parse(readFileSync(join(root, 'profiles', f), 'utf8'));
  bikes.push({ name: `profile:${doc.profile.id}`, facts: doc.profile.facts ?? {} });
}

const geoKeys = Object.keys(GEOMETRY_RANGES);
const extreme = (end: number): Facts => ({
  'bike.category': 'road_gravel', 'bike.ebike': true, 'drive.rear_speeds': 12, 'geometry.wheel_bsd_mm': 559,
  ...Object.fromEntries(geoKeys.map((k) => [`geometry.${k}`, GEOMETRY_RANGES[k][end]])),
});

bikes.push(
  { name: 'road-drop-11', facts: { 'bike.category': 'road_gravel', 'bike.handlebar': 'drop', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 11 } },
  { name: 'city-flat-8', facts: { 'bike.category': 'trekking_city', 'bike.handlebar': 'flat', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 8 } },
  { name: 'mtb-riser-12', facts: { 'bike.category': 'mtb', 'bike.handlebar': 'riser', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 12 } },
  { name: 'mtb-10', facts: { 'bike.category': 'mtb', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 10 } },
  { name: 'hub-gear', facts: { 'bike.category': 'trekking_city', 'drive.gear_type': 'hub_gear' } },
  { name: 'single-speed', facts: { 'bike.category': 'trekking_city', 'drive.gear_type': 'single_speed' } },
  { name: 'city-ebike', facts: { 'bike.category': 'trekking_city', 'bike.ebike': true, 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 9 } },
  { name: 'extreme-low', facts: extreme(0) },
  { name: 'extreme-high', facts: extreme(1) },
);

const hash = (s: string | Uint8Array) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const mat = new T.MeshStandardMaterial();

function snapshot(m: BikeModel): { text: string; meshes: number; tris: number } {
  m.bike.updateMatrixWorld(true);
  m.standG.updateMatrixWorld(true);
  m.hookG.updateMatrixWorld(true);
  const lines: string[] = [];
  let meshes = 0;
  let tris = 0;
  for (const root of [m.bike, m.standG, m.hookG]) {
    root.traverse((o: any) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry as T.BufferGeometry;
      const pos = g.attributes.position;
      const per = (g.index ? g.index.count : pos.count) / 3;
      let s = `${o.userData.partId ?? '-'}|${o.type}|`;
      if (o.isInstancedMesh) {
        tris += per * o.count;
        const a = new Float32Array(o.instanceMatrix.array.buffer, 0, o.count * 16);
        s += `n${o.count}|${hash(new Uint8Array(a.buffer, a.byteOffset, a.byteLength))}|`;
      } else {
        tris += per;
      }
      s += `${o.matrixWorld.elements.join(',')}|${hash(new Uint8Array((pos.array as Float32Array).buffer, (pos.array as Float32Array).byteOffset, (pos.array as Float32Array).byteLength))}|${pos.count}`;
      lines.push(s);
    });
  }
  return { text: lines.join('\n'), meshes, tris };
}

const result: Record<string, { steps: Record<string, string>; meshes: number; tris: number }> = {};
let count = 0;
for (const { name, facts } of bikes) {
  const B = bikeSpec(facts);
  const m = new BikeModel(B, mat);
  const steps: Record<string, string> = {};
  const first = snapshot(m);
  steps['initial'] = hash(first.text);
  for (let i = 0; i < B.n; i++) {
    m.setDer(m.zOf(i), GAP_OK);
    steps[`gear${i}`] = hash(snapshot(m).text);
  }
  const last = B.n - 1;
  for (const [label, gap] of [['big', GAP_BIG], ['small', GAP_SMALL]] as const) {
    m.setDer(m.zOf(last), gap);
    steps[`${label}-gap`] = hash(snapshot(m).text);
  }
  result[name] = { steps, meshes: first.meshes, tris: Math.round(first.tris) };
  count += Object.keys(steps).length;
  m.dispose();
}

mkdirSync(dirname(resolve(out)), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`${Object.keys(result).length} bikes, ${count} steps hashed -> ${out}`);
for (const [name, r] of Object.entries(result)) console.log(`${name.padEnd(36)} meshes ${String(r.meshes).padStart(4)}  triangles ${String(r.tris).padStart(7)}`);
