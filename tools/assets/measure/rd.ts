// Measures the rear derailleur's rig (turning axes, pins, pulley axles, barrel, clamp, screw spots) from the
// SOURCE model (exact CAD meshes, not the simplified library pieces), in library space, and writes
// player/src/stage/rd-rig.ts. Run: npm run parts:rig   (-- --explore prints every cylinder found per piece)
//
// Method: CAD meshes keep smooth vertex normals on curved faces. On a cylinder every normal line passes
// through the axis and is perpendicular to it. RANSAC on pairs of nearby vertices gives axis candidates; the
// best ones are refined (axis = least-normal direction of the inliers' normals, centre = circle fit) and
// removed, until no cylinder with enough vertices is left. A joint is a pair of coaxial cylinders on two pieces.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { NodeIO } from '@gltf-transform/core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cfg = YAML.parse(fs.readFileSync(path.join(root, 'tools/assets/library/library.yaml'), 'utf8'));
const EXPLORE = process.argv.includes('--explore');
const MM = 500; // mm per scene unit

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sc = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => sc(a, 1 / (len(a) || 1));

// ---------------------------------------------------------------- read the source (same transform as library/build.ts)

const io = new NodeIO();
const doc = await io.read(path.join(root, cfg.source));
const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));

export interface Piece { name: string; P: V3[]; N: V3[]; tri: number[] }

/** Vertices (mm, library axes) with their normals, and triangles, of the source nodes of a library part. */
function piece(lib: string): Piece {
  const P: V3[] = [];
  const N: V3[] = [];
  const tri: number[] = [];
  for (const name of cfg.parts[lib].nodes as string[]) {
    const n = byName.get(name);
    if (!n?.getMesh()) throw new Error(`source node not found or empty: ${name}`);
    const m = n.getWorldMatrix();
    for (const prim of n.getMesh()!.listPrimitives()) {
      const a = prim.getAttribute('POSITION')!;
      const na = prim.getAttribute('NORMAL');
      const base = P.length;
      const v = [0, 0, 0];
      const w = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
        const y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
        const z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
        P.push([2 * z * MM, 2 * y * MM, -2 * x * MM]);
        if (na) {
          na.getElement(i, w);
          const nx = m[0] * w[0] + m[4] * w[1] + m[8] * w[2];
          const ny = m[1] * w[0] + m[5] * w[1] + m[9] * w[2];
          const nz = m[2] * w[0] + m[6] * w[1] + m[10] * w[2];
          N.push(norm([nz, ny, -nx]));
        } else N.push([0, 0, 0]);
      }
      const ia = prim.getIndices();
      const cnt = ia ? ia.getCount() : a.getCount();
      for (let i = 0; i < cnt; i++) tri.push(base + (ia ? ia.getScalar(i) : i));
    }
  }
  if (N.some((n) => n[0] === 0 && n[1] === 0 && n[2] === 0)) throw new Error(`${lib}: source has no normals`);
  return { name: lib, P, N, tri };
}

// ---------------------------------------------------------------- cylinder finder

export interface Cyl {
  piece: string;
  /** point on the axis at the middle of the cylinder's length (mm), axis direction, radius (mm) */
  c: V3;
  d: V3;
  r: number;
  /** length along the axis (mm), from t0 to t1 relative to c */
  t0: number;
  t1: number;
  /** covered angle (deg), number of vertices, hole (normals point at the axis) or boss */
  arc: number;
  n: number;
  hole: boolean;
  rms: number;
}

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/** smallest-eigenvalue eigenvector of a symmetric 3x3 (power iteration on (tr*I - M)) */
function leastDir(M: number[][]): V3 {
  const tr = M[0][0] + M[1][1] + M[2][2];
  let v: V3 = norm([0.3, 0.5, 0.8]);
  for (let k = 0; k < 200; k++) {
    const w: V3 = [0, 1, 2].map((i) => tr * v[i] - (M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2])) as V3;
    v = norm(w);
  }
  return v;
}

/** orthonormal basis (e1, e2) perpendicular to d */
function basis(d: V3): [V3, V3] {
  const t: V3 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = norm(cross(d, t));
  return [e1, cross(d, e1)];
}

/** Kasa circle fit of points projected onto the plane through o perpendicular to d. */
function circleFit(pts: V3[], o: V3, d: V3): { c: V3; r: number; rms: number } {
  const [e1, e2] = basis(d);
  const uv = pts.map((p) => { const q = sub(p, o); return [dot(q, e1), dot(q, e2)]; });
  // solve [u v 1] [A B C] = u^2 + v^2
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const b = [0, 0, 0];
  for (const [u, v] of uv) {
    const row = [u, v, 1];
    const rhs = u * u + v * v;
    for (let i = 0; i < 3; i++) { b[i] += row[i] * rhs; for (let j = 0; j < 3; j++) S[i][j] += row[i] * row[j]; }
  }
  const x = solve3(S, b);
  const cu = x[0] / 2;
  const cv = x[1] / 2;
  const r = Math.sqrt(Math.max(0, x[2] + cu * cu + cv * cv));
  const rms = Math.sqrt(uv.reduce((s, [u, v]) => s + (Math.hypot(u - cu, v - cv) - r) ** 2, 0) / uv.length);
  return { c: add(o, add(sc(e1, cu), sc(e2, cv))), r, rms };
}

function solve3(A: number[][], b: number[]): number[] {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = 0; k < 3; k++) {
      if (k === i) continue;
      const f = M[k][i] / M[i][i];
      for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

/** Every cylinder of a piece with at least minN vertices. */
export function cylinders(pc: Piece, minN = 16): Cyl[] {
  // unique (position, normal) vertices
  const seen = new Set<string>();
  const idx: number[] = [];
  pc.P.forEach((p, i) => {
    const k = [...p.map((v) => Math.round(v * 1000)), ...pc.N[i].map((v) => Math.round(v * 100))].join(',');
    if (!seen.has(k)) { seen.add(k); idx.push(i); }
  });
  let live = idx.slice();
  // grid of live vertices for neighbour sampling
  const out: Cyl[] = [];
  const angTol = 0.03; // |n . d|
  const radTol = 0.04; // mm
  for (let round = 0; round < 60 && live.length > minN; round++) {
    const cell = 6;
    const grid = new Map<string, number[]>();
    const gk = (p: V3) => p.map((v) => Math.floor(v / cell)).join(',');
    for (const i of live) { const k = gk(pc.P[i]); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
    let best: { d: V3; c: V3; r: number; inl: number[] } | null = null;
    let bestScore = -1;
    const tries = 4000;
    // candidates are scored on a sample of the live vertices; only the best one is counted on all of them
    const sample = live.length <= 800 ? live : Array.from({ length: 800 }, () => live[Math.floor(rnd() * live.length)]);
    for (let t = 0; t < tries; t++) {
      const i = live[Math.floor(rnd() * live.length)];
      const p = pc.P[i];
      const near: number[] = [];
      const [gx, gy, gz] = p.map((v) => Math.floor(v / cell));
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) near.push(...(grid.get(`${gx + a},${gy + b},${gz + c}`) ?? []));
      const j = near[Math.floor(rnd() * near.length)];
      if (j === i) continue;
      const ni = pc.N[i];
      const nj = pc.N[j];
      const cr = cross(ni, nj);
      if (len(cr) < 0.2) continue;
      const d = norm(cr);
      // intersection of the two normal lines in the plane perpendicular to d
      const q = sub(pc.P[j], p);
      const qp = sub(q, sc(d, dot(q, d)));
      // p + s ni = pj' + u nj  ->  in plane: s ni - u nj = qp
      const a11 = dot(ni, ni), a12 = -dot(ni, nj), a22 = dot(nj, nj);
      const b1 = dot(qp, ni), b2 = -dot(qp, nj);
      const det = a11 * a22 - a12 * a12;
      if (Math.abs(det) < 1e-6) continue;
      const s = (b1 * a22 - a12 * b2) / det;
      const c = add(p, sc(ni, s));
      const r = Math.abs(s);
      if (r < 0.6 || r > 40) continue;
      const score = inliers(pc, sample, c, d, r, angTol, radTol).length;
      if (score > bestScore) { bestScore = score; best = { d, c, r, inl: [] }; }
    }
    if (best) best.inl = inliers(pc, live, best.c, best.d, best.r, angTol, radTol);
    if (!best || best.inl.length < minN) break;
    // refine
    let { d, c, r, inl } = best;
    for (let k = 0; k < 4; k++) {
      const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const i of inl) { const n = pc.N[i]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) M[a][b] += n[a] * n[b]; }
      const nd = leastDir(M);
      d = dot(nd, d) < 0 ? sc(nd, -1) : nd;
      const f = circleFit(inl.map((i) => pc.P[i]), c, d);
      c = f.c;
      r = f.r;
      inl = inliers(pc, live, c, d, r, angTol, radTol * 1.5);
      if (inl.length < minN) break;
    }
    if (inl.length < minN) { live = live.filter((i) => !best!.inl.includes(i)); continue; }
    const f = circleFit(inl.map((i) => pc.P[i]), c, d);
    const ts = inl.map((i) => dot(sub(pc.P[i], c), d));
    const t0 = Math.min(...ts), t1 = Math.max(...ts);
    const mid = add(f.c, sc(d, (t0 + t1) / 2));
    // canonical direction: largest component positive
    const big = d.reduce((m, v, k) => (Math.abs(v) > Math.abs(d[m]) ? k : m), 0);
    const dd = d[big] < 0 ? sc(d, -1) : d;
    const [e1, e2] = basis(dd);
    const angs = inl.map((i) => { const q = sub(pc.P[i], mid); return Math.atan2(dot(q, e2), dot(q, e1)); }).sort((a, b) => a - b);
    let gapMax = angs[0] + 2 * Math.PI - angs[angs.length - 1];
    for (let k = 1; k < angs.length; k++) gapMax = Math.max(gapMax, angs[k] - angs[k - 1]);
    const holeVotes = inl.filter((i) => dot(sub(pc.P[i], f.c), pc.N[i]) - dot(sub(pc.P[i], f.c), dd) * dot(pc.N[i], dd) < 0).length;
    out.push({ piece: pc.name, c: mid, d: dd, r: f.r, t0: t0 - (t0 + t1) / 2, t1: t1 - (t0 + t1) / 2, arc: 360 - (gapMax * 180) / Math.PI, n: inl.length, hole: holeVotes > inl.length / 2, rms: f.rms });
    const rm = new Set(inl);
    live = live.filter((i) => !rm.has(i));
  }
  return out;
}

function inliers(pc: Piece, live: number[], c: V3, d: V3, r: number, angTol: number, radTol: number): number[] {
  const res: number[] = [];
  for (const i of live) {
    const n = pc.N[i];
    if (Math.abs(dot(n, d)) > angTol) continue;
    const q = sub(pc.P[i], c);
    const radial = sub(q, sc(d, dot(q, d)));
    const rr = len(radial);
    if (Math.abs(rr - r) > radTol) continue;
    if (Math.abs(dot(norm(radial), n)) < 0.995) continue;
    res.push(i);
  }
  return res;
}

const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
const fv = (v: V3, f = f1) => `(${v.map(f).join(', ')})`;
export const fmtCyl = (c: Cyl) => `${c.hole ? 'hole' : 'boss'} r ${f2(c.r)} len ${f1(c.t1 - c.t0)} arc ${c.arc.toFixed(0)} n ${c.n} rms ${c.rms.toFixed(3)} at ${fv(c.c)} dir ${fv(c.d, (v) => v.toFixed(3))}`;

/** distance between two axis lines (mm) and angle between them (deg) */
export function axisGap(a: Cyl, b: Cyl): { dist: number; ang: number } {
  const ang = (Math.acos(Math.min(1, Math.abs(dot(a.d, b.d)))) * 180) / Math.PI;
  const q = sub(b.c, a.c);
  const dist = len(sub(q, sc(a.d, dot(q, a.d))));
  return { dist, ang };
}

const RD = ['rd_upper_body', 'rd_barrel', 'rd_link_outer', 'rd_link_inner', 'rd_lower_body', 'rd_cage_outer', 'rd_cage_inner', 'rd_pulley_upper', 'rd_pulley_lower', 'rd_hanger'];
const pieces = new Map(RD.map((n) => [n, piece(n)]));
const cyls = new Map(RD.map((n) => [n, cylinders(pieces.get(n)!)]));

if (EXPLORE) {
  for (const [n, cs] of cyls) {
    console.log(`${n}: ${cs.length} cylinders`);
    for (const c of cs) console.log('  ' + fmtCyl(c));
  }
  console.log('coaxial pairs across pieces (axis distance < 0.5 mm, angle < 3 deg):');
  for (let i = 0; i < RD.length; i++) for (let j = i + 1; j < RD.length; j++) {
    for (const a of cyls.get(RD[i])!) for (const b of cyls.get(RD[j])!) {
      const g = axisGap(a, b);
      if (g.dist < 0.5 && g.ang < 3) console.log(`  ${RD[i]} ${a.hole ? 'hole' : 'boss'} r${f2(a.r)} <-> ${RD[j]} ${b.hole ? 'hole' : 'boss'} r${f2(b.r)}: ${f2(g.dist)} mm ${f2(g.ang)} deg at ${fv(a.c)}`);
    }
  }
  process.exit(0);
}

// ---------------------------------------------------------------- pick the rig's features

const notes: string[] = [];
const near = (v: number, want: number, tol: number) => Math.abs(v - want) <= tol;
/** the cylinder of a piece that matches, with the most vertices */
function pick(pieceName: string, what: string, ok: (c: Cyl) => boolean): Cyl {
  const c = cyls.get(pieceName)!.filter(ok).sort((a, b) => b.n - a.n)[0];
  if (!c) throw new Error(`${pieceName}: no cylinder for ${what}`);
  return c;
}
/** a cylinder on another piece coaxial with c (the joint's partner), and how well they agree */
function partner(c: Cyl, pieceName: string, what: string): Cyl {
  const list = cyls.get(pieceName)!.map((o) => ({ o, g: axisGap(c, o) })).filter((x) => x.g.dist < 0.3 && x.g.ang < 1).sort((a, b) => b.o.n - a.o.n);
  if (!list.length) throw new Error(`${what}: no coaxial cylinder on ${pieceName}`);
  const { o, g } = list[0];
  notes.push(`${what}: ${c.piece} ${c.hole ? 'hole' : 'boss'} r${f2(c.r)} (rms ${c.rms.toFixed(3)}) vs ${pieceName} ${o.hole ? 'hole' : 'boss'} r${f2(o.r)}: axes ${f2(g.dist)} mm and ${f2(g.ang)} deg apart`);
  return o;
}
const zish = (c: Cyl) => Math.abs(c.d[2]) > 0.99;
const along = (d: V3, tol = 0.02) => (c: Cyl) => Math.abs(Math.abs(dot(c.d, d)) - 1) < tol;
/** point on c's axis nearest to q */
const onAxis = (c: { c: V3; d: V3 }, q: V3): V3 => add(c.c, sc(c.d, dot(sub(q, c.c), c.d)));

// Hanger bolt (B-axis): the hanger's bolt hole, confirmed by the bolt shank / drum of the upper body.
const hangerHole = pick('rd_hanger', 'bolt hole', (c) => c.hole && zish(c) && near(c.r, 5, 0.1));
partner(hangerHole, 'rd_upper_body', 'B-axis (hanger hole / body bolt)');
const bAxis = { p: hangerHole.c, d: hangerHole.d };
const hangerZ: [number, number] = [hangerHole.c[2] + hangerHole.t0, hangerHole.c[2] + hangerHole.t1];

// Link pins: each link's pin holes, each confirmed by a coaxial cylinder on the body it hangs from.
const linkHoles = (link: string) => cyls.get(link)!.filter((c) => c.hole && near(c.r, 1.75, 0.1) && c.arc > 300).sort((a, b) => b.n - a.n).slice(0, 2);
const pins: Record<string, Cyl> = {};
for (const link of ['rd_link_outer', 'rd_link_inner']) {
  const hs = linkHoles(link);
  if (hs.length !== 2) throw new Error(`${link}: expected two pin holes`);
  // the upper pin is the one further back (smaller x), nearer the bolt
  hs.sort((a, b) => a.c[0] - b.c[0]);
  const side = link === 'rd_link_outer' ? 'Outer' : 'Inner';
  partner(hs[0], 'rd_upper_body', `pin upper${side}`);
  partner(hs[1], 'rd_lower_body', `pin lower${side}`);
  pins[`upper${side}`] = hs[0];
  pins[`lower${side}`] = hs[1];
}
// one common pin direction (the four agree to a few hundredths of a degree)
let pinDir: V3 = [0, 0, 0];
for (const c of Object.values(pins)) pinDir = add(pinDir, dot(c.d, pins.upperOuter.d) < 0 ? sc(c.d, -1) : c.d);
pinDir = norm(pinDir);
const pinSpread = Math.max(...Object.values(pins).map((c) => (Math.acos(Math.min(1, Math.abs(dot(c.d, pinDir)))) * 180) / Math.PI));
notes.push(`pin axes: largest angle from their mean ${pinSpread.toFixed(3)} deg`);
// the four pins as points in one plane perpendicular to the pin direction, through the upper outer pin's middle
const pinRef = pins.upperOuter.c;
const inPlane = (c: Cyl): V3 => { const p = c.c; return sub(p, sc(pinDir, dot(sub(p, pinRef), pinDir))); };
const pinPts = Object.fromEntries(Object.entries(pins).map(([k, c]) => [k, inPlane(c)])) as Record<'upperOuter' | 'upperInner' | 'lowerOuter' | 'lowerInner', V3>;
{
  const lo = len(sub(pinPts.lowerOuter, pinPts.upperOuter)), li = len(sub(pinPts.lowerInner, pinPts.upperInner));
  const up = len(sub(pinPts.upperInner, pinPts.upperOuter)), lw = len(sub(pinPts.lowerInner, pinPts.lowerOuter));
  notes.push(`four-bar (mm): outer link ${f2(lo)}, inner link ${f2(li)}, upper pins ${f2(up)}, lower pins ${f2(lw)}; ${Math.abs(lo - li) < 0.05 && Math.abs(up - lw) < 0.05 ? 'a parallelogram' : 'NOT an exact parallelogram: solved as a four-bar'}`);
}

// Cage pivot (P-axis): the lower body's round boss and the outer cage plate's boss around it. The cage turns in
// its own plane, so the axis direction is the cage plates' normal (the same as the pulley axles); the point is
// the lower body's boss (a full cylinder).
const pBoss = pick('rd_lower_body', 'cage pivot boss', (c) => !c.hole && zish(c) && c.r > 10 && c.r < 12 && c.arc > 300);
const pCage = partner(pBoss, 'rd_cage_outer', 'P-axis (lower body / outer cage plate)');
const pAxis = { p: pBoss.c, d: pCage.d };

// Pulleys: axle bore (r 2 boss through the pulley), outline (tip radius, teeth), width.
function pulley(name: string) {
  const ax = pick(name, 'axle', (c) => !c.hole && near(c.r, 2, 0.1) && c.arc > 300);
  partner(ax, 'rd_cage_inner', `${name} axle in the inner cage plate`);
  partner(ax, 'rd_cage_outer', `${name} axle in the outer cage plate`);
  const pc = pieces.get(name)!;
  const [e1, e2] = basis(ax.d);
  const rad = pc.P.map((p) => { const q = sub(p, ax.c); const t = dot(q, ax.d); const r = len(sub(q, sc(ax.d, t))); return { r, t, a: Math.atan2(dot(q, e2), dot(q, e1)) }; });
  const rTip = Math.max(...rad.map((x) => x.r));
  // teeth: the tips are arcs at the tip radius, separated by the roller seats; count the angular gaps
  // between tip vertices that are wider than 8 degrees
  const tipA = rad.filter((x) => x.r > rTip - 0.3).map((x) => x.a).sort((a, b) => a - b);
  let teeth = tipA[0] + 2 * Math.PI - tipA[tipA.length - 1] > (8 * Math.PI) / 180 ? 1 : 0;
  for (let i = 1; i < tipA.length; i++) if (tipA[i] - tipA[i - 1] > (8 * Math.PI) / 180) teeth++;
  const tooth = rad.filter((x) => x.r > rTip - 3);
  const width = Math.max(...tooth.map((x) => x.t)) - Math.min(...tooth.map((x) => x.t));
  const tMid = (Math.max(...tooth.map((x) => x.t)) + Math.min(...tooth.map((x) => x.t))) / 2;
  // roller seats (concave r 4.5 cuts between the teeth): where the chain's rollers sit
  const seats = cyls.get(name)!.filter((c) => c.hole && near(c.r, 4.5, 0.2)).map((c) => len(sub(sub(c.c, ax.c), sc(ax.d, dot(sub(c.c, ax.c), ax.d)))));
  const seatR = seats.reduce((s, v) => s + v, 0) / (seats.length || 1);
  // The model's pulley is a generic gear: its seats are not one chain pitch (12.7 mm) apart. The chain-true
  // tooth count at the model's seat circle is the one we draw; its pitch radius follows from it.
  const chainTeeth = Math.round(Math.PI / Math.asin(12.7 / (2 * seatR)));
  const rPitch = 12.7 / (2 * Math.sin(Math.PI / chainTeeth));
  notes.push(`${name}: model has ${teeth} teeth (seats ${f1(360 / teeth)} deg apart), tip radius ${f2(rTip)} mm, roller seat centres at ${f2(seatR)} mm (${seats.length} seats found), tooth width at the tip ${f2(width)} mm. Chain-true at that seat circle: ${chainTeeth} teeth, pitch radius ${f2(rPitch)} mm`);
  // centre: on the axle, in the teeth's middle plane
  return { c: add(ax.c, sc(ax.d, tMid)), d: ax.d, teethModel: teeth, teeth: chainTeeth, rPitch, rSeat: seatR, rTip, width };
}
const pulleyUpper = pulley('rd_pulley_upper');
const pulleyLower = pulley('rd_pulley_lower');
notes.push(`pulley centres ${f2(len(sub(pulleyUpper.c, pulleyLower.c)))} mm apart`);

// Barrel adjuster: its main cylinder; the head (knurl, housing socket) is the end away from the body.
const barrelCyl = pick('rd_barrel', 'barrel body', (c) => !c.hole && near(c.r, 4.5, 0.2) && c.arc > 300);
const socket = pick('rd_barrel', 'housing socket', (c) => c.hole && along(barrelCyl.d)(c) && c.r > 2.5 && c.r < 4);
const bP = pieces.get('rd_barrel')!.P;
const bts = bP.map((p) => dot(sub(p, barrelCyl.c), barrelCyl.d));
let bt0 = Math.min(...bts), bt1 = Math.max(...bts);
// d points from the head into the thread: away from the housing socket
let bD = barrelCyl.d;
if (dot(sub(socket.c, barrelCyl.c), bD) > 0) { bD = sc(bD, -1); [bt0, bt1] = [-bt1, -bt0]; }
const barrel = { p: barrelCyl.c, d: bD, head: add(barrelCyl.c, sc(bD, bt0)), seat: add(barrelCyl.c, sc(bD, bt1)), r: barrelCyl.r };
notes.push(`barrel: ${f1(bt1 - bt0)} mm long, r ${f2(barrel.r)} mm`);

// Cable clamp: the bolt boss on the lower body, square to the link plates (perpendicular to the pins) and
// pointing out to the drive side, where the bolt is reached.
const clampCyl = pick('rd_lower_body', 'cable clamp boss', (c) => !c.hole && near(c.r, 3, 0.2) && Math.abs(dot(c.d, pinDir)) < 0.05 && Math.abs(c.d[2]) > 0.7);
const clampD = clampCyl.d[2] < 0 ? sc(clampCyl.d, -1) : clampCyl.d; // out of the body, to the drive side
const clamp = { p: add(clampCyl.c, sc(clampD, clampCyl.t1)), d: clampD };

// Screws fused into the upper body. H and L: two parallel r 2.5 shanks on the back of the body, each with an
// r 3 counterbore at its rear end (the head). B: an r 1.5 shank in the B-knuckle behind the bolt, with an r 2
// collar at its rear end (the head); its line passes well clear of the bolt, so pushing it turns the body.
function screw(shank: Cyl, headCyl: Cyl) {
  let d = shank.d;
  if (dot(sub(headCyl.c, shank.c), d) > 0) d = sc(d, -1); // d: from the head into the thread
  return { p: onAxis(shank, headCyl.c), d };
}
const hl = cyls.get('rd_upper_body')!.filter((c) => !c.hole && near(c.r, 2.5, 0.05) && c.arc > 300);
const hlAxes: Cyl[] = [];
for (const c of hl) if (!hlAxes.some((o) => axisGap(o, c).dist < 0.3)) hlAxes.push(c);
if (hlAxes.length !== 2) throw new Error(`rd_upper_body: expected two limit screw shanks, found ${hlAxes.length}`);
const hlScrews = hlAxes.map((s) => screw(s, pick('rd_upper_body', 'limit screw head', (c) => c.hole && near(c.r, 3, 0.1) && axisGap(s, c).dist < 0.3)));
// H above L (cautious default: which one is H is not marked on the model)
hlScrews.sort((a, b) => b.p[1] - a.p[1]);
const bShank = pick('rd_upper_body', 'B screw shank', (c) => !c.hole && near(c.r, 1.5, 0.1) && c.arc > 300);
const bScrew = screw(bShank, pick('rd_upper_body', 'B screw head', (c) => !c.hole && near(c.r, 2, 0.1) && axisGap(bShank, c).dist < 0.3));
{
  const q = sub(bScrew.p, bAxis.p);
  const arm = Math.abs(dot(cross(q, bScrew.d), bAxis.d));
  notes.push(`B screw: lever arm about the bolt ${f2(arm)} mm; H/L screws ${f2(len(sub(hlScrews[0].p, hlScrews[1].p)))} mm apart`);
}
const bTs = cyls.get('rd_upper_body')!.filter((c) => axisGap(bShank, c).dist < 0.3).map((c) => [dot(sub(c.c, bScrew.p), bScrew.d) + c.t0, dot(sub(c.c, bScrew.p), bScrew.d) + c.t1]).flat();
const bLen = Math.max(...bTs);

// ---------------------------------------------------------------- write rd-rig.ts (scene units)

const U = 1 / MM;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const pt = (v: V3) => `[${v.map((x) => r6(x * U)).join(', ')}]`;
const dir = (v: V3) => `[${norm(v).map((x) => r6(x)).join(', ')}]`;
const num = (v: number) => `${r6(v * U)}`;
const ax = (a: { p: V3; d: V3 }) => `{ p: ${pt(a.p)}, d: ${dir(a.d)} }`;
const pul = (p: typeof pulleyUpper) => `{ c: ${pt(p.c)}, d: ${dir(p.d)}, teeth: ${p.teeth}, rPitch: ${num(p.rPitch)}, teethModel: ${p.teethModel}, rSeat: ${num(p.rSeat)}, rTip: ${num(p.rTip)}, width: ${num(p.width)} }`;

const src = `// GENERATED by tools/assets/measure/rd.ts. Do not edit: run \`npm run parts:rig\` to measure again.
// The rear derailleur's rig, measured on the source model (exact CAD meshes) in library space: scene units
// (1 = 0.5 m), x forward, y up, z to the drive side, origin at the source's bottom bracket. Points with a
// direction d are axes (p is a point on the axis). DRAWING DATA, not facts about any real part (hard rule 3).
//
// Measurement (mm):
${notes.map((n) => `//   ${n}`).join('\n')}

export type RigV3 = readonly [number, number, number];
export interface RigAxis { readonly p: RigV3; readonly d: RigV3 }

export const RD_RIG = {
  /** hanger bolt axis (B-axis); the upper body turns about it. hangerZ: the source hanger plate's faces */
  bAxis: ${ax(bAxis)},
  hangerZ: [${num(hangerZ[0])}, ${num(hangerZ[1])}],
  /** the parallelogram's pins, all along pinDir; points in one plane perpendicular to pinDir */
  pinDir: ${dir(pinDir)},
  pins: {
    upperOuter: ${pt(pinPts.upperOuter)},
    upperInner: ${pt(pinPts.upperInner)},
    lowerOuter: ${pt(pinPts.lowerOuter)},
    lowerInner: ${pt(pinPts.lowerInner)},
  },
  /** cage pivot (P-axis), on the lower body */
  pAxis: ${ax(pAxis)},
  /** pulley centres (in the teeth's middle plane) and axles. The model's pulleys are generic gears (teethModel
   * seats on the circle rSeat); teeth / rPitch are the chain-true count at that circle, the ones to draw */
  pulleys: {
    upper: ${pul(pulleyUpper)},
    lower: ${pul(pulleyLower)},
  },
  /** barrel adjuster: axis point p, d from the head (housing end) into the thread; head and seat are its two ends */
  barrel: { p: ${pt(barrel.p)}, d: ${dir(barrel.d)}, head: ${pt(barrel.head)}, seat: ${pt(barrel.seat)}, r: ${num(barrel.r)} },
  /** inner wire clamp: the clamp bolt's outer face on the lower body, bolt axis out to the drive side */
  clamp: ${ax(clamp)},
  /** screws fused into the upper body: p = head seat on the axis, d = from the head into the thread. bLen: B screw length */
  screws: { h: ${ax(hlScrews[0])}, l: ${ax(hlScrews[1])}, b: ${ax(bScrew)}, bLen: ${num(bLen)} },
} as const;
`;
fs.writeFileSync(path.join(root, 'player/src/stage/rd-rig.ts'), src);
for (const n of notes) console.log(n);
console.log('wrote player/src/stage/rd-rig.ts');

// --shots: the source derailleur, see-through, with a marker line on every measured axis, from 3 sides
// (scratch/rig-*.png). Colours: red B-axis, green pins, blue P-axis, cyan pulley axles, magenta barrel,
// yellow H (light) and L (dark) screws, orange B screw, black cable clamp.
if (process.argv.includes('--shots')) {
  const { execFileSync } = await import('node:child_process');
  const m = (p: V3, d: V3, c: string, l = 40) => ({ p, d, c, l });
  const marks = [
    m(bAxis.p, bAxis.d, '#e00000', 60),
    ...Object.values(pinPts).map((p) => m(p, pinDir, '#00a000')),
    m(pAxis.p, pAxis.d, '#0030ff', 60),
    m(pulleyUpper.c, pulleyUpper.d, '#00c0c0'), m(pulleyLower.c, pulleyLower.d, '#00c0c0'),
    m(barrel.p, barrel.d, '#e000e0', 50),
    m(hlScrews[0].p, hlScrews[0].d, '#f0e000', 25), m(hlScrews[1].p, hlScrews[1].d, '#a08000', 25),
    m(bScrew.p, bScrew.d, '#ff8000', 25),
    m(clamp.p, clamp.d, '#000000', 20),
  ];
  const only = '___B-|Deraileur_Gear-[34]|Deraileur_Mount-3';
  const q = (d: string) => `rig-view.html?only=${encodeURIComponent(only)}&dir=${d}&dist=1.5&marks=${encodeURIComponent(JSON.stringify(marks))}`;
  const outDir = path.join(root, 'scratch');
  fs.mkdirSync(outDir, { recursive: true });
  const jobs = [['rig-drive', '-1,0.15,0.05'], ['rig-behind', '-0.35,0.25,-1'], ['rig-above', '-0.5,1,-0.3']].map(([n, d]) => `${n}~${q(d)}`);
  execFileSync(process.execPath, [path.join(root, 'tools/assets/explore/shot.mjs'), root, path.join(root, 'tools/assets/explore'), outDir, ...jobs], { stdio: 'inherit' });
}
