// Geometry helpers: tubes, curves, gears, slabs, hulls, and the small vector helper `v3`.
// Pure functions on three.js geometry; no bike knowledge.
// Session area: shared; any session may add a helper here.

import * as T from 'three';
import { TAU, type V2, type V3 } from './spec.js';

export const UP = new T.Vector3(0, 1, 0);

export const v3 = {
  add: (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sc: (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k],
  len: (a: V3) => Math.hypot(a[0], a[1], a[2]),
  cross: (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};


export function tubeGeo(a: V3, b: V3, r: number): T.BufferGeometry {
  const A = new T.Vector3(...a);
  const B = new T.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new T.CylinderGeometry(r, r, len, 10);
  g.translate(0, len / 2, 0);
  g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(UP, B.clone().sub(A).normalize())));
  g.translate(A.x, A.y, A.z);
  return g;
}

export function curveGeo(pts: V3[], r: number, seg = 48): T.BufferGeometry {
  return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), seg, r, 8, false);
}

/** A toothed wheel in the xy plane, centred on z = 0: chainring and pulleys. */
export function gearGeo(r: number, teeth: number, thick: number, depth = 0.006): T.BufferGeometry {
  const s = new T.Shape();
  const m = teeth * 2;
  for (let i = 0; i < m; i++) {
    const a = (i / m) * TAU;
    const rr = i % 2 ? r - depth : r + depth * 0.5;
    if (i) s.lineTo(rr * Math.cos(a), rr * Math.sin(a));
    else s.moveTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  const g = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** A flat shape between z0 and z1 with rounded (bevelled) edges. */
export function slabGeo(s: T.Shape, z0: number, z1: number, bevel = 0.003): T.BufferGeometry {
  const b = Math.min(bevel, (z1 - z0) / 2.2);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(1e-4, z1 - z0 - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, z0 + b);
  return g;
}

/** Outline around circles [x, y, r]: their convex hull, as a shape (cage plates, hanger). */
export function hullShape(circles: Array<[number, number, number]>): T.Shape {
  const pts: V2[] = [];
  for (const [x, y, r] of circles) for (let i = 0; i < 24; i++) pts.push([x + r * Math.cos((i / 24) * TAU), y + r * Math.sin((i / 24) * TAU)]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: V2[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return new T.Shape([...lower.slice(0, -1), ...upper.slice(0, -1)].map(([x, y]) => new T.Vector2(x, y)));
}

/** A tapered capsule along x, from x0 (half-width w0) to x1 (half-width w1). */
export function capsuleShape(x0: number, x1: number, w0: number, w1: number): T.Shape {
  return hullShape([[x0, 0, w0], [x1, 0, w1]]);
}

/** A flat plate from a polygon in the xy plane, centred on z. */
export function polyGeo(pts: V2[], z: number, thick: number): T.BufferGeometry {
  const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
  const g = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, z - thick / 2);
  return g;
}

const tA = new T.Vector3();
const tB = new T.Vector3();
const tD = new T.Vector3();
const tN = new T.Vector3();
const tX = new T.Vector3();
const tM = new T.Matrix4();
/** Places a unit-height mesh between two points. */
export function seg(mesh: T.Object3D, a: V3 | T.Vector3, b: V3 | T.Vector3): void {
  if (Array.isArray(a)) tA.set(a[0], a[1], a[2]); else tA.copy(a);
  if (Array.isArray(b)) tB.set(b[0], b[1], b[2]); else tB.copy(b);
  tD.subVectors(tB, tA);
  const L = tD.length() || 1e-6;
  mesh.position.copy(tA).addScaledVector(tD, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, tD.normalize());
  mesh.scale.set(1, L, 1);
}

/** Places a unit-height box between two points, its thin side (z) facing `normal`. */
export function plate(mesh: T.Object3D, a: V3, b: V3, normal: V3): void {
  tA.set(...a);
  tB.set(...b);
  tD.subVectors(tB, tA);
  const L = tD.length() || 1e-6;
  tD.normalize();
  tN.set(...normal);
  tN.addScaledVector(tD, -tN.dot(tD)).normalize();
  tX.crossVectors(tD, tN);
  mesh.position.copy(tA).addScaledVector(tD, L / 2);
  mesh.quaternion.setFromRotationMatrix(tM.makeBasis(tX, tD, tN));
  mesh.scale.set(1, L, 1);
}

export function disposeTree(g: T.Object3D, keep?: T.Material): void {
  g.traverse((o: any) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material !== keep) o.material.dispose();
  });
}

