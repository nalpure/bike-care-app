// Geometry helpers: tubes, curves, gears, slabs, hulls, and the small vector helper `v3`.
// Pure functions on three.js geometry; no bike knowledge.
// Session area: shared; any session may add a helper here.

import * as T from 'three';
import { DEG, rOf, TAU, type V2, type V3 } from './spec.js';

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

/**
 * `curveGeo` cut in two at a ring of the tube: [the rest, the end within `cut` (in xy) of `at`].
 * Both geometries keep the very same vertices and triangles as `curveGeo` (they share the
 * attributes and differ only in their index), so drawing both is drawing the whole tube.
 * Either one is null when the tube has no triangle on that side.
 */
export function curveGeoSplit(pts: V3[], r: number, seg: number, at: V2, cut: number): [T.BufferGeometry | null, T.BufferGeometry | null] {
  const RADIAL = 8;
  const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)));
  const whole = new T.TubeGeometry(curve, seg, r, RADIAL, false);
  // the rings from `first` on are near; getPointAt is what TubeGeometry places its rings by
  let first = seg + 1;
  for (let j = seg; j >= 0; j--) {
    const c = curve.getPointAt(j / seg);
    if (Math.hypot(c.x - at[0], c.y - at[1]) >= cut) break;
    first = j;
  }
  const idx = whole.index!;
  const rest: number[] = [];
  const near: number[] = [];
  for (let i = 0; i < idx.count; i += 3) {
    const ring = Math.max(...[0, 1, 2].map((k) => Math.floor(idx.getX(i + k) / (RADIAL + 1))));
    (ring >= first ? near : rest).push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  }
  const make = (list: number[]): T.BufferGeometry | null => {
    if (!list.length) return null;
    const g = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) g.setAttribute(name, whole.getAttribute(name));
    g.setIndex(list);
    return g;
  };
  return [make(rest), make(near)];
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

/** Frees a bike's geometry and materials. Library geometry (userData.lib) is shared and survives. */
export function disposeTree(g: T.Object3D, keep?: T.Material): void {
  g.traverse((o: any) => {
    if (o.geometry && !o.geometry.userData.lib) o.geometry.dispose();
    if (o.material && o.material !== keep) o.material.dispose();
  });
}


// ------------------------------------------------------------------ sprockets and chainrings
// Sizes below are drawing values (mm / 500 = scene units), not facts about any part (hard rule 3).

/** Roller seat radius in a tooth gap: a 7.75 mm roller (radius 3.875 mm) with a little play. */
export const SEAT_R = 0.00806;
/** How far a tooth tip stands out past the pitch circle (the circle the roller centres run on). */
export const TIP_OVER = 0.0022;

/**
 * A sprocket outline on the chain's pitch circle, counterclockwise: 8 points per tooth. Gap k (a
 * roller seat) is centred on the pitch circle at the angle k * 2 pi / teeth; the tooth tips lie
 * half way between gaps. Round seats (5 points), straight flanks and a flat, rounded tip (3 points).
 */
export function toothOutline(teeth: number): V2[] {
  const R = rOf(teeth);
  const a = TAU / teeth;
  const tipHalf = 0.0016 / (R + TIP_OVER);
  const pts: V2[] = [];
  for (let k = 0; k < teeth; k++) {
    const phi = k * a;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    for (const deg of [-70, -35, 0, 35, 70]) {
      const th = deg * DEG;
      // from the roller centre on the pitch circle: sideways along the circle, and inwards
      const tx = SEAT_R * Math.sin(th);
      const ry = -SEAT_R * Math.cos(th);
      pts.push([(R + ry) * c - tx * s, (R + ry) * s + tx * c]);
    }
    for (const d of [-1, 0, 1]) {
      const ang = phi + a / 2 + d * tipHalf;
      const rr = R + TIP_OVER + (d === 0 ? 0.0003 : 0);
      pts.push([rr * Math.cos(ang), rr * Math.sin(ang)]);
    }
  }
  return pts;
}

const toPath = (pts: V2[], p: T.Path) => {
  p.setFromPoints(pts.map(([x, y]) => new T.Vector2(x, y)));
  return p;
};
const polar = (r: number, a: number): V2 => [r * Math.cos(a), r * Math.sin(a)];

/**
 * Vertex colours for a flat toothed plate: dark on the edges of its holes and in the tooth gaps, light on the tooth tips,
 * so the plate reads as a shape although all its faces point the same way. Drawing only: no extra draw calls.
 */
function shadeEdges(g: T.BufferGeometry, shape: T.Shape, teeth: number): void {
  const key = (x: number, y: number) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
  const inHole = new Set<string>();
  for (const h of shape.holes) for (const p of h.getPoints()) inHole.add(key(p.x, p.y));
  const root = rOf(teeth) - SEAT_R;
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let v = inHole.has(key(x, y)) ? EDGE_DARK : 1;
    if (v === 1) {
      const t = Math.min(1, Math.max(0, (Math.hypot(x, y) - root) / (SEAT_R + TIP_OVER)));
      v = EDGE_DARK + (1 - EDGE_DARK) * t * t * (3 - 2 * t);
    }
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = v;
  }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
}
/** How dark the shade gets (1 = none). A drawing value. */
const EDGE_DARK = 0.7;

function extrude(shape: T.Shape, thick: number, teeth: number): T.BufferGeometry {
  const g = new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -thick / 2);
  shadeEdges(g, shape, teeth);
  return g;
}

/**
 * A rear sprocket in the xy plane, centred on z = 0, thick along z, with its tooth gaps as in
 * `toothOutline`. From 28 teeth it has a carrier: 4 windows (5 from 36 teeth) between the hub and
 * the tooth ring. All have a splined hole for the freehub body.
 */
export function sprocketGeo(teeth: number, thick: number): T.BufferGeometry {
  const shape = new T.Shape(toothOutline(teeth).map(([x, y]) => new T.Vector2(x, y)));
  const hubR = 0.0172;
  const hole: V2[] = [];
  for (let j = 0; j < 8; j++) {
    const a = (j * TAU) / 8;
    const w = 0.12;
    hole.push(polar(hubR, a - w), polar(hubR + 0.0014, a - w), polar(hubR + 0.0014, a + w), polar(hubR, a + w));
  }
  shape.holes.push(toPath(hole, new T.Path()));
  if (teeth >= 28) {
    const n = teeth >= 36 ? 5 : 4;
    const r0 = 0.032;
    const r1 = rOf(teeth) - SEAT_R - 0.0075;
    const web = 0.2;
    for (let k = 0; k < n; k++) {
      const a0 = (k * TAU) / n + web / 2 + 0.3;
      const a1 = ((k + 1) * TAU) / n - web / 2 + 0.3;
      const w: V2[] = [];
      for (let i = 0; i <= 6; i++) w.push(polar(r1, a0 + ((a1 - a0) * i) / 6));
      for (let i = 0; i <= 2; i++) w.push(polar(r0, a1 - ((a1 - a0) * i) / 2));
      shape.holes.push(toPath(w, new T.Path()));
    }
  }
  return extrude(shape, thick, teeth);
}

/**
 * A chainring in the xy plane, centred on z = 0: the tooth outline, a narrow ring and `bolts`
 * tabs (4 or 5) reaching in to the bolt circle `bcdR`, each with a bolt hole. Tab 0 points at
 * angle `tab0`. One mesh, centred on the axle, so it can sit on a crank's spider.
 */
export function chainringGeo(teeth: number, thick: number, bolts: 4 | 5, bcdR: number, tab0: number): T.BufferGeometry {
  const shape = new T.Shape(toothOutline(teeth).map(([x, y]) => new T.Vector2(x, y)));
  const ri = rOf(teeth) - SEAT_R - 0.014;
  const rt = bcdR - 0.012;
  const half = 0.011;
  const hole: V2[] = [];
  for (let k = 0; k < bolts; k++) {
    const a = tab0 + (k * TAU) / bolts;
    const next = tab0 + ((k + 1) * TAU) / bolts;
    // the open part between this tab and the next: an arc on the ring's inside, then down the next tab's side
    const aEnd = next - half / ri;
    const aStart = a + half / ri;
    for (let i = 0; i <= 5; i++) hole.push(polar(ri, aStart + ((aEnd - aStart) * i) / 5));
    hole.push(polar(rt, next - half / rt), polar(rt, next + half / rt));
  }
  shape.holes.push(toPath(hole, new T.Path()));
  for (let k = 0; k < bolts; k++) {
    const [cx, cy] = polar(bcdR, tab0 + (k * TAU) / bolts);
    const b: V2[] = [];
    for (let i = 0; i < 8; i++) b.push([cx + 0.0045 * Math.cos((i * TAU) / 8), cy + 0.0045 * Math.sin((i * TAU) / 8)]);
    shape.holes.push(toPath(b, new T.Path()));
  }
  return extrude(shape, thick, teeth);
}
