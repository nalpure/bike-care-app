// The drivetrain: chainring, cranks and sprockets (meshes with real teeth), the chain (links, path and
// layout), and rAt (sprocket radius between sprockets). Tooth counts, sprocket and chain sizes are
// drawing data, not facts about any part (hard rule 3).
// Session area: C (drivetrain).

import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildPath } from './chain.js';
import { chainringGeo, sprocketGeo, tubeGeo } from './geo.js';
import { chordLength, layPins, newPins, pitchAngle } from './pins.js';
import { GAP_BIG, GAP_OK, GAP_SMALL, HP, PITCH, RP, TAU, type BikeSpec } from './spec.js';
import type { BikeModel } from './bike.js';

/** Sprocket radius at a z between the sprockets. */
export function rAt(B: BikeSpec, z: number): number {
  const { zs, rs, n } = B;
  if (z >= zs[0]) return rs[0];
  if (z <= zs[n - 1]) return rs[n - 1];
  for (let i = 0; i < n - 1; i++) {
    if (z <= zs[i] && z >= zs[i + 1]) return rs[i] + (rs[i + 1] - rs[i]) * ((zs[i] - z) / (zs[i] - zs[i + 1]));
  }
  return rs[0];
}

/** The sprocket the chain is on while the derailleur is at z: the nearest one. */
export function nearestSprocket(B: BikeSpec, z: number): number {
  let best = 0;
  for (let i = 1; i < B.n; i++) if (Math.abs(B.zs[i] - z) < Math.abs(B.zs[best] - z)) best = i;
  return best;
}

/** mm to scene units (1 unit = 0.5 m). */
const mm = (v: number) => v / 500;
/** Chainring thickness, and the direction of its first bolt tab (the crank arm's, so the spider lines up). */
const RING_T = mm(1.8);
const TAB0 = Math.atan2(-0.3, 0.14);
/** Links beyond the longest taut length that the chain may have: room for the sag (layChain rounds to the taut length). */
const SLACK_LINKS = 1;

/** Crankset (chainring, cranks) and the sprockets, which turn with the chain, not with the wheel. */
export function buildCrankset(m: BikeModel): void {
  const B = m.spec;
  const { bby, rx, huby, chainline: zc } = B;
  // Crankset: chainring, cranks and pedals turn together around the bottom bracket.
  m.crankset.position.set(0, bby, 0);
  m.bike.add(m.crankset);
  m.part('chainring', m.crankset);
  const bolts = B.chainring <= 34 ? 4 : 5;
  m.add('chainring', chainringGeo(B.chainring, RING_T, bolts, bolts === 4 ? 0.104 : 0.11, TAB0), [0, 0, zc], null, { flat: true });
  m.anchor('chainring', m.bike, [0, bby + B.rc + 0.01, zc]);
  m.part('crank', m.crankset);
  const zr = zc + 0.035;
  m.add('crank', tubeGeo([0, 0, zr], [0.14, -0.3, zr + 0.02], 0.02));
  m.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [0.14, -0.3, zr + 0.07], null, { k: 0.5 });
  m.add('crank', tubeGeo([0, 0, -zr], [-0.14, 0.3, -zr - 0.02], 0.02));
  m.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [-0.14, 0.3, -zr - 0.07], null, { k: 0.5 });
  m.add('crank', new T.CylinderGeometry(0.02, 0.02, 2 * zr, 10), null, [HP, 0, 0]);
  m.anchor('crank', m.crankset, [0.14, -0.3, zr + 0.07]);

  // Sprockets: one block on the freehub. The block turns with the chain (layChain sets its angle so
  // the tooth gaps sit under the pins), not with the wheel: a wheel spun by hand freewheels.
  m.cassetteG.position.set(rx, huby, 0);
  m.bike.add(m.cassetteG);
  const sprocketPart = (i: number) => (B.n === 1 ? 'cassette' : i === 0 ? 'smallest_sprocket' : i === B.n - 1 ? 'largest_sprocket' : 'cassette');
  for (const id of new Set(B.cassette.map((_, i) => sprocketPart(i)))) m.part(id, m.cassetteG);
  B.cassette.forEach((t, i) => m.add(sprocketPart(i), sprocketGeo(t, B.sprT), [0, 0, B.zs[i]], null, { k: 0.9, flat: true }));
  // the freehub body the sprockets sit on: part of the wheel, it turns with it
  const zEnd = B.zs[0] + B.sprT / 2;
  const zIn = B.zs[B.n - 1] - 0.012;
  m.add('rear_wheel', new T.CylinderGeometry(0.0165, 0.0165, zEnd - zIn, 14), [0, 0, (zEnd + zIn) / 2], [HP, 0, 0], { k: 0.8 });
  const mid = Math.floor(B.n / 2);
  if (B.n > 1) {
    m.anchor('smallest_sprocket', m.bike, [rx, huby + B.rs[0] + 0.015, B.zs[0]]);
    m.anchor('largest_sprocket', m.bike, [rx, huby + B.rs[B.n - 1] + 0.015, B.zs[B.n - 1]]);
  }
  m.anchor('cassette', m.bike, [rx, huby + B.rs[mid] + 0.015, B.zs[mid]]);
}

/** A figure-eight link plate in the xy plane, one pitch long, as a flat shape. */
function plateShape(): T.Shape {
  const c = PITCH / 2;
  const rE = mm(3.95);
  const waist = mm(3.3);
  const pts: Array<[number, number]> = [];
  for (const d of [-100, -33, 33, 100]) pts.push([c + rE * Math.cos((d * Math.PI) / 180), rE * Math.sin((d * Math.PI) / 180)]);
  pts.push([0, waist]);
  for (const d of [80, 147, 213, 280]) pts.push([-c + rE * Math.cos((d * Math.PI) / 180), rE * Math.sin((d * Math.PI) / 180)]);
  pts.push([0, -waist]);
  return new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
}

/** The two kinds of link, centred on the middle of the link, x along the chain, z across the bike. */
function linkGeometries(B: BikeSpec): { inner: T.BufferGeometry; outer: T.BufferGeometry } {
  const W = B.chainW;
  const head = mm(0.25);
  const gap = mm(0.1);
  const gi = B.sprT + mm(0.25); // between the inner plates: the sprocket's tooth runs here
  const t = Math.min(mm(0.9), (W / 2 - head - gi / 2 - gap) / 2);
  const plate = (z0: number, z1: number) => {
    const g = new T.ExtrudeGeometry(plateShape(), { depth: z1 - z0, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, z0);
    return g;
  };
  const cyl = (r: number, len: number, sides: number, x: number, z: number) => {
    const g = new T.CylinderGeometry(r, r, len, sides).toNonIndexed();
    g.rotateX(HP);
    g.translate(x, 0, z);
    return g;
  };
  const xs = [-PITCH / 2, PITCH / 2];
  const zi = gi / 2;
  const zo = zi + t + gap;
  const inner = [plate(zi, zi + t), plate(-zi - t, -zi), ...xs.map((x) => cyl(mm(3.875), gi, 8, x, 0))];
  const hl = W / 2 - (zo + t);
  const outer = [plate(zo, zo + t), plate(-zo - t, -zo), ...xs.flatMap((x) => [1, -1].map((s) => cyl(mm(1.9), hl, 5, x, s * (zo + t + hl / 2))))];
  const merge = (list: T.BufferGeometry[]) => {
    const parts = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      return n;
    });
    return mergeGeometries(parts)!;
  };
  return { inner: merge(inner), outer: merge(outer) };
}

/** The chain: the circles it runs around, the number of links, and the two instanced kinds of link. */
export function buildChain(m: BikeModel): void {
  const B = m.spec;
  const { bby, rx, huby, chainline: zc } = B;
  const mid = Math.floor(B.n / 2);
  const z0 = B.zs[B.n - 1];
  m.circ = B.gears === 'derailleur'
    ? [
      { x: 0, y: bby, z: zc, r: B.rc, s: 1 },
      { x: rx, y: huby, z: z0, r: B.rs[0], s: 1 },
      { x: rx, y: huby - 0.2, z: z0, r: RP, s: -1 },
      { x: rx, y: huby - 0.3, z: z0, r: RP, s: 1 },
    ]
    : [
      { x: 0, y: bby, z: zc, r: B.rc, s: 1 },
      { x: rx, y: huby, z: B.zs[0], r: B.rs[0], s: 1 },
    ];
  m.part('chain');
  // The most links the chain can have: the longest taut length over every gear, halfway position and
  // gap, plus a little sag. layChain uses as many as the taut chain needs in the current pose.
  let longest = 0;
  if (B.gears === 'derailleur') {
    const zsAll = B.zs.flatMap((z, i) => (i ? [(B.zs[i - 1] + z) / 2, z] : [z]));
    for (const z of zsAll) {
      for (const gap of [GAP_SMALL, GAP_OK, GAP_BIG]) {
        layoutCirc(m, z, gap);
        buildPath(m.circ, m.path);
        longest = Math.max(longest, chordLength(m.path, PITCH));
      }
    }
  } else {
    buildPath(m.circ, m.path);
    longest = chordLength(m.path, PITCH);
  }
  m.N = Math.ceil(longest / PITCH + SLACK_LINKS);
  m.pins = newPins(m.N);
  const { inner, outer } = linkGeometries(B);
  const chain = m.parts.get('chain')!;
  const mk = (geo: T.BufferGeometry, k: number) => {
    const mat = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.15, transparent: true, flatShading: true });
    mat.userData.k = k;
    const mesh = new T.InstancedMesh(geo, mat, Math.ceil(m.N / 2));
    mesh.frustumCulled = false;
    mesh.userData.partId = 'chain';
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    chain.group.add(mesh);
    chain.mats.push(mat);
    return mesh;
  };
  m.chainInner = mk(inner, 0.55);
  m.chainOuter = mk(outer, 0.8);
  m.anchor('chain', m.bike, [-0.45, (bby + B.rc + huby + B.rs[mid]) / 2 + 0.03, zc]);
}

/** Puts the cage pulleys and the sprocket circle of the chain where the derailleur is. */
export function layoutCirc(m: BikeModel, z: number, gap: number) {
  const L = m.layout(z, gap);
  const c = m.circ;
  c[1].r = L.r;
  c[1].z = z;
  c[2].x = L.gx;
  c[2].y = L.gy;
  c[2].z = z;
  c[3].x = L.lx;
  c[3].y = L.ly;
  c[3].z = z;
  return L;
}

const tD = new T.Vector3();
const tN = new T.Vector3();
const tX = new T.Vector3();
const tM = new T.Matrix4();
const tS = new T.Vector3();
const tQ = new T.Quaternion();

/**
 * Lays the chain's pins along the path (which setDer has just built), turns the chainring with
 * the chain, and turns the sprocket block so the tooth gaps of the sprocket the chain is on sit
 * under the pins. Each link lies along the chord between its two pins and keeps its width across
 * the bike (no twist where the chain bends sideways).
 */
export function layChain(m: BikeModel): void {
  const B = m.spec;
  buildPath(m.circ, m.path);
  const theta = m.chainShift / B.rc;
  m.crankset.rotation.z = theta;
  const pins = m.pins;
  // as many links as the taut chain needs here (the allowance for sag is in the rounding)
  const N = Math.min(m.N, Math.max(2, Math.round(chordLength(m.path, PITCH) / PITCH)));
  m.links = N;
  layPins(m.path, N, PITCH, theta, pitchAngle(B.rc, PITCH), pins);
  // sprockets: the nearest sprocket's gaps are at the block's angle plus whole teeth
  let k0 = -1;
  for (let k = 0; k < N && k0 < 0; k++) if (pins.wheel[k] === 1) k0 = k;
  if (k0 >= 0) {
    const a = TAU / B.cassette[nearestSprocket(B, m.derZ)];
    const phi = Math.atan2(pins.y[k0] - B.huby, pins.x[k0] - B.rx);
    m.cassetteG.rotation.z = ((phi % a) + a) % a;
  }
  let nIn = 0;
  let nOut = 0;
  for (let k = 0; k < N; k++) {
    const j = k + 1 === N ? 0 : k + 1;
    tX.set(pins.x[j] - pins.x[k], pins.y[j] - pins.y[k], pins.z[j] - pins.z[k]);
    const len = tX.length() || 1e-9;
    tX.divideScalar(len);
    tN.set(0, 0, 1).addScaledVector(tX, -tX.z).normalize();
    tD.crossVectors(tN, tX);
    tQ.setFromRotationMatrix(tM.makeBasis(tX, tD, tN));
    tS.set(len / PITCH, 1, 1);
    tM.compose(tD.set((pins.x[k] + pins.x[j]) / 2, (pins.y[k] + pins.y[j]) / 2, (pins.z[k] + pins.z[j]) / 2), tQ, tS);
    if ((k + pins.parity) & 1) m.chainOuter.setMatrixAt(nOut++, tM);
    else m.chainInner.setMatrixAt(nIn++, tM);
  }
  m.chainInner.count = nIn;
  m.chainOuter.count = nOut;
  m.chainInner.instanceMatrix.needsUpdate = true;
  m.chainOuter.instanceMatrix.needsUpdate = true;
}
