// Builds the parts library from a source glTF: `npm run parts`.
// Reads tools/assets/library.yaml; writes player/public/parts/library.glb, library.json and CREDITS.txt.
// Library space: scene units (1 unit = 0.5 m), x forward, y up, z to the drive side, origin at the source's bottom bracket.
//   lib = 2 * (src.z, src.y, -src.x), src in metres. Front parts (stem, bar, grips) are turned straight about the steering axis.
// These are drawing data only; nothing here says anything about compatibility (hard rule 3).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { Document, NodeIO, type Node } from '@gltf-transform/core';
import { KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'player/public/parts');
const cfg = YAML.parse(fs.readFileSync(path.join(root, 'tools/assets/library.yaml'), 'utf8'));
const MM = 500; // one scene unit in mm

type V3 = [number, number, number];
interface PartCfg { nodes: string[]; drop?: string[]; front?: boolean; ratio: number; error?: number }
const parts: Record<string, PartCfg> = cfg.parts;

// ---- read the source ----
const io = new NodeIO();
const src = await io.read(path.join(root, cfg.source));
const nodeByName = new Map<string, Node>();
for (const n of src.getRoot().listNodes()) {
  if (nodeByName.has(n.getName())) throw new Error(`duplicate source node name: ${n.getName()}`);
  nodeByName.set(n.getName(), n);
}
const node = (name: string) => {
  const n = nodeByName.get(name);
  if (!n) throw new Error(`source node not found: "${name}"`);
  return n;
};

/** src (metres) -> library space */
const toLib = (x: number, y: number, z: number): V3 => [2 * z, 2 * y, -2 * x];

interface Raw { pos: Float32Array; idx: Uint32Array; trisBefore: number }

/** Merges the mesh primitives of the given nodes (world transform baked), in library space, before un-steering. */
function bake(names: string[], drop: string[] = []): Raw {
  const P: number[] = [];
  const I: number[] = [];
  for (const name of names) {
    const n = node(name);
    const mesh = n.getMesh();
    if (!mesh) throw new Error(`node has no mesh: "${name}"`);
    const m = n.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (drop.includes(prim.getMaterial()?.getName() ?? '')) continue;
      const a = prim.getAttribute('POSITION')!;
      const base = P.length / 3;
      const v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
        const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
        const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
        P.push(...toLib(x, y, z));
      }
      const ia = prim.getIndices();
      const cnt = ia ? ia.getCount() : a.getCount();
      for (let i = 0; i < cnt; i++) I.push(base + (ia ? ia.getScalar(i) : i));
    }
  }
  return { pos: Float32Array.from(P), idx: Uint32Array.from(I), trisBefore: I.length / 3 };
}

const mean = (pos: Float32Array): V3 => {
  const s = [0, 0, 0];
  const n = pos.length / 3;
  for (let i = 0; i < pos.length; i++) s[i % 3] += pos[i];
  return [s[0] / n, s[1] / n, s[2] / n];
};
const boxOf = (pos: Float32Array) => {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) { mn[i % 3] = Math.min(mn[i % 3], pos[i]); mx[i % 3] = Math.max(mx[i % 3], pos[i]); }
  return { min: mn as V3, max: mx as V3 };
};

const names = new Map<string, string[]>(Object.entries(parts).map(([k, v]) => [k, v.nodes]));

// ---- steering axis and angle ----
const centre = (n: string): V3 => mean(bake([n]).pos);
const [ca, cb] = (cfg.steering.cups as string[]).map(centre);
const axis = new Array(3) as V3;
{ const d = [cb[0] - ca[0], cb[1] - ca[1], cb[2] - ca[2]]; const l = Math.hypot(...d); for (let i = 0; i < 3; i++) axis[i] = d[i] / l; }

/** Rodrigues rotation of point p about the line through ca with direction axis by angle t (radians). */
function rot(p: V3, t: number): V3 {
  const c = Math.cos(t), s = Math.sin(t);
  const q = [p[0] - ca[0], p[1] - ca[1], p[2] - ca[2]];
  const k = axis;
  const dot = k[0] * q[0] + k[1] * q[1] + k[2] * q[2];
  const cr = [k[1] * q[2] - k[2] * q[1], k[2] * q[0] - k[0] * q[2], k[0] * q[1] - k[1] * q[0]];
  return [0, 1, 2].map((i) => q[i] * c + cr[i] * s + k[i] * dot * (1 - c) + ca[i]) as V3;
}
const [mA, mB] = (cfg.steering.mirror as string[]).map((n) => mean(bake(names.get(n)!, parts[n].drop).pos));
const cost = (t: number) => {
  const a = rot(mA, t), b = rot(mB, t);
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] + b[2]) ** 2;
};
let best = 0, bc = Infinity;
for (let d = -90; d < 90; d += 0.05) { const c = cost((d * Math.PI) / 180); if (c < bc) { bc = c; best = d; } }
let lo = best - 0.05, hi = best + 0.05; // refine
for (let i = 0; i < 60; i++) {
  const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
  if (cost((m1 * Math.PI) / 180) < cost((m2 * Math.PI) / 180)) hi = m2; else lo = m1;
}
const angleDeg = (lo + hi) / 2;
console.log(`steering axis ${ca.map((v) => (v * MM).toFixed(1))} -> ${cb.map((v) => (v * MM).toFixed(1))} mm, un-steer ${angleDeg.toFixed(3)} deg, mirror residual ${(Math.sqrt(cost((angleDeg * Math.PI) / 180)) * MM).toFixed(2)} mm`);

// ---- pairs: the drive part is the one on +z (after turning front parts straight) ----
const decided: Record<string, string> = {};
const zOf = (n: string) => {
  const r = bake(names.get(n)!, parts[n].drop).pos;
  if (parts[n].front) for (let i = 0; i < r.length; i += 3) r[i + 2] = rot([r[i], r[i + 1], r[i + 2]], (angleDeg * Math.PI) / 180)[2];
  return mean(r)[2];
};
for (const [d, nd] of cfg.pairs as [string, string][]) {
  const zd = zOf(d), zn = zOf(nd);
  if (Math.abs(zd - zn) < 0.02) throw new Error(`pair ${d}/${nd}: both on the same side (z ${zd}, ${zn})`);
  if (zd < zn) { const t = names.get(d)!; names.set(d, names.get(nd)!); names.set(nd, t); decided[d] = 'swapped'; } else decided[d] = 'as listed';
  console.log(`pair ${d}: source ${names.get(d)!.join(' + ').slice(0, 40)} (${decided[d]})`);
}

// ---- per part: bake, un-steer, weld, simplify ----
await MeshoptSimplifier.ready;
const out = new Document();
const buf = out.createBuffer();
const scene = out.createScene('library');
const info: Record<string, unknown> = {};
let totalTris = 0;

for (const [name, p] of Object.entries(parts)) {
  const srcNames = names.get(name)!;
  const raw = bake(srcNames, p.drop);
  if (p.front) {
    const t = (angleDeg * Math.PI) / 180;
    for (let i = 0; i < raw.pos.length; i += 3) {
      const r = rot([raw.pos[i], raw.pos[i + 1], raw.pos[i + 2]], t);
      raw.pos[i] = r[0]; raw.pos[i + 1] = r[1]; raw.pos[i + 2] = r[2];
    }
  }
  // weld by position (CAD exports split vertices for normals)
  const key = new Map<string, number>();
  const wp: number[] = [];
  const remap = new Uint32Array(raw.pos.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const k = `${Math.round(raw.pos[i * 3] * 1e6)},${Math.round(raw.pos[i * 3 + 1] * 1e6)},${Math.round(raw.pos[i * 3 + 2] * 1e6)}`;
    let j = key.get(k);
    if (j === undefined) { j = wp.length / 3; key.set(k, j); wp.push(raw.pos[i * 3], raw.pos[i * 3 + 1], raw.pos[i * 3 + 2]); }
    remap[i] = j;
  }
  const welded: number[] = [];
  for (let t = 0; t < raw.idx.length; t += 3) {
    const a = remap[raw.idx[t]], b = remap[raw.idx[t + 1]], c = remap[raw.idx[t + 2]];
    if (a !== b && b !== c && a !== c) welded.push(a, b, c);
  }
  let idx: Uint32Array<ArrayBufferLike> = Uint32Array.from(welded);
  const vpos = Float32Array.from(wp);
  if (p.ratio < 1) {
    const target = Math.max(12, Math.floor((idx.length * p.ratio) / 3) * 3);
    [idx] = MeshoptSimplifier.simplify(idx, vpos, 3, target, p.error ?? cfg.error);
  }
  // compact: drop unused vertices, number in order of first use
  const used = new Map<number, number>();
  const cidx = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    let n = used.get(idx[i]);
    if (n === undefined) { n = used.size; used.set(idx[i], n); }
    cidx[i] = n;
  }
  const nv = used.size;
  const finalPos = new Float32Array(nv * 3);
  for (const [o, n] of used) finalPos.set(vpos.subarray(o * 3, o * 3 + 3), n * 3);
  const tris = cidx.length / 3;
  totalTris += tris;
  const box = boxOf(finalPos);
  const size = box.max.map((v, i) => (v - box.min[i]) * MM) as V3;
  info[name] = {
    source: srcNames,
    drop: p.drop ?? [],
    front: !!p.front,
    ratio: p.ratio,
    trisBefore: raw.trisBefore,
    trisAfter: tris,
    box,
    sizeMm: size.map((v) => Math.round(v * 10) / 10),
  };
  const pos = out.createAccessor().setType('VEC3').setArray(finalPos).setBuffer(buf);
  const ind = out.createAccessor().setType('SCALAR').setArray(nv < 65535 ? Uint16Array.from(cidx) : cidx).setBuffer(buf);
  const prim = out.createPrimitive().setAttribute('POSITION', pos).setIndices(ind);
  const mesh = out.createMesh(name).addPrimitive(prim);
  scene.addChild(out.createNode(name).setMesh(mesh));
  console.log(`${name.padEnd(16)} ${String(raw.trisBefore).padStart(6)} -> ${String(tris).padStart(5)} tris  ${size.map((v) => v.toFixed(0)).join('x')} mm`);
}

out.createExtension(KHRMeshQuantization).setRequired(true);
await out.transform(quantize({ quantizePosition: 16 }));
fs.mkdirSync(outDir, { recursive: true });
const glb = await new NodeIO().registerExtensions([KHRMeshQuantization]).writeBinary(out);
fs.writeFileSync(path.join(outDir, 'library.glb'), glb);
fs.writeFileSync(
  path.join(outDir, 'library.json'),
  JSON.stringify(
    {
      note: 'Library space: scene units (1 unit = 0.5 m), x forward, y up, z to the drive side, origin at the source bottom bracket. Drawing data only.',
      source: cfg.source,
      units: { mmPerUnit: MM },
      steering: { a: ca, b: cb, angleDeg, axisDir: axis, about: 'right-handed rotation about a->b by angleDeg turns the steered source parts straight' },
      pairs: decided,
      totalTriangles: totalTris,
      bytes: glb.byteLength,
      parts: info,
    },
    null,
    1,
  ) + '\n',
);
fs.writeFileSync(
  path.join(outDir, 'CREDITS.txt'),
  fs.readFileSync(path.join(root, cfg.credit), 'utf8').trim() + ' Changed: split into parts, simplified, re-oriented.\n',
);
console.log(`library.glb ${(glb.byteLength / 1024).toFixed(0)} KB, ${totalTris} triangles`);
