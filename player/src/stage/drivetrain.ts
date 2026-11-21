// The drivetrain: chainring, cranks and sprockets (meshes), the chain (build, path and layout),
// and rAt (sprocket radius between sprockets). Sprocket and chainring tooth counts are drawing data.
// Session area: C (drivetrain).

import * as T from 'three';
import { buildPath, pointAt } from './chain.js';
import { gearGeo, tubeGeo } from './geo.js';
import { GAP_OK, HP, PITCH, RP, type BikeSpec } from './spec.js';
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


/** Crankset (chainring, cranks) and the sprockets on the rear hub. */
export function buildCrankset(m: BikeModel): void {
  const B = m.spec;
  const { bby, rx, huby, chainline: zc } = B;
  // Crankset: chainring, cranks and pedals turn together around the bottom bracket.
  m.crankset.position.set(0, bby, 0);
  m.bike.add(m.crankset);
  m.part('chainring', m.crankset);
  m.add('chainring', gearGeo(B.rc, B.chainring, 0.012, 0.007), [0, 0, zc], null, { flat: true });
  m.add('chainring', new T.CylinderGeometry(B.rc * 0.55, B.rc * 0.55, 0.016, 5), [0, 0, zc + 0.012], [HP, 0, 0], { k: 0.7, flat: true });
  m.anchor('chainring', m.bike, [0, bby + B.rc + 0.01, zc]);
  m.part('crank', m.crankset);
  const zr = zc + 0.035;
  m.add('crank', tubeGeo([0, 0, zr], [0.14, -0.3, zr + 0.02], 0.02));
  m.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [0.14, -0.3, zr + 0.07], null, { k: 0.5 });
  m.add('crank', tubeGeo([0, 0, -zr], [-0.14, 0.3, -zr - 0.02], 0.02));
  m.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [-0.14, 0.3, -zr - 0.07], null, { k: 0.5 });
  m.add('crank', new T.CylinderGeometry(0.02, 0.02, 2 * zr, 10), null, [HP, 0, 0]);
  m.anchor('crank', m.crankset, [0.14, -0.3, zr + 0.07]);

  // Sprockets turn with the rear wheel: smooth discs reaching the tooth tips, as in the
  // prototype (teeth on a stack of sprockets read as noise on a phone).
  const sprocketPart = (i: number) => (B.n === 1 ? 'cassette' : i === 0 ? 'smallest_sprocket' : i === B.n - 1 ? 'largest_sprocket' : 'cassette');
  for (const id of new Set(B.cassette.map((_, i) => sprocketPart(i)))) m.part(id, m.rearHub);
  B.cassette.forEach((t, i) => m.add(sprocketPart(i), new T.CylinderGeometry(B.rs[i] + 0.0025, B.rs[i] + 0.0025, B.sp * 0.5, Math.min(t, 48)), [0, 0, B.zs[i]], [HP, 0, 0], { k: 0.9, flat: true }));
  const mid = Math.floor(B.n / 2);
  if (B.n > 1) {
    m.anchor('smallest_sprocket', m.bike, [rx, huby + B.rs[0] + 0.015, B.zs[0]]);
    m.anchor('largest_sprocket', m.bike, [rx, huby + B.rs[B.n - 1] + 0.015, B.zs[B.n - 1]]);
  }
  m.anchor('cassette', m.bike, [rx, huby + B.rs[mid] + 0.015, B.zs[mid]]);
}

/** The chain: the circles it runs around, and the instanced links. */
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
  if (B.gears === 'derailleur') layoutCirc(m, z0, GAP_OK);
  const Lref = buildPath(m.circ, m.path);
  m.N = Math.max(40, Math.round(Lref / PITCH / 2) * 2);
  const cm = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.15, transparent: true });
  cm.userData.k = 0.6;
  m.chainMesh = new T.InstancedMesh(new T.BoxGeometry(PITCH * 0.8, 0.014, B.chainW), cm, m.N);
  m.chainMesh.frustumCulled = false;
  m.chainMesh.userData.partId = 'chain';
  m.chainMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const chain = m.parts.get('chain')!;
  chain.group.add(m.chainMesh);
  chain.mats.push(cm);
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

/** Lays the chain's links along its path (which setDer has just built). */
export function layChain(m: BikeModel): void {
  const total = buildPath(m.circ, m.path);
  const step = total / m.N;
  const Q = m.Q;
  const pt = m.pt;
  let hint = 0;
  const shift = ((m.chainShift % total) + total) % total;
  for (let k = 0; k < m.N; k++) {
    hint = pointAt(m.path, k * step + shift, pt, hint);
    Q.position.set(pt.x, pt.y, pt.z);
    // the link runs along the chain, its width stays across the bike: no twist where the chain bends sideways
    tX.set(pt.dx, pt.dy, pt.dz).normalize();
    tN.set(0, 0, 1).addScaledVector(tX, -tX.z).normalize();
    tD.crossVectors(tN, tX);
    Q.quaternion.setFromRotationMatrix(tM.makeBasis(tX, tD, tN));
    Q.scale.set(1, k % 2 ? 0.7 : 1, 1);
    Q.updateMatrix();
    m.chainMesh.setMatrixAt(k, Q.matrix);
  }
  m.chainMesh.instanceMatrix.needsUpdate = true;
}
