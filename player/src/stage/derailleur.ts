// The rear derailleur: the library pieces (rd_*) on the measured rig, placed by rd-fit.ts and moved
// with rd-kin.ts; the hanger, the H, L and B screws, the barrel adjuster (or a plain cable stop) and the
// cable ends. Session area: D (derailleur).
//
// Every piece is stored where it sits in the source model (library space). Each moving piece hangs in a
// frame whose matrix is "from the source pose to the pose now" (rdPose), so the piece's own geometry is
// never moved. The screws and the barrel hang in the upper body's frame, the pulleys in the cage's.
// All sizes are drawing data, not facts about any part (hard rule 3).

import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { layoutCirc } from './drivetrain.js';
import { curveGeo, hullShape, seg, SEAT_R, slabGeo, toothOutline, UP } from './geo.js';
import { libGeo, type LibName } from './library.js';
import { CAGE_DIR, CAGE_LEN, RdFit, RP_RD, type RdState } from './rd-fit.js';
import { pulleySpin, RIG } from './rd-kin.js';
import { RD_RIG, type RigV3 } from './rd-rig.js';
import { GAP_OK, TAU, type BikeSpec, type V2, type V3 } from './spec.js';
import type { BikeModel } from './bike.js';

const V = (v: RigV3) => new T.Vector3(v[0], v[1], v[2]);
const D = 'rear_derailleur';

/** A turnable part: screws and the barrel adjuster. `pos` and `axis` are in its parent's frame; `axis` points from the head into the thread. */
export interface Turn {
  pos: V3;
  axis: V3;
  len: number;
}

// ------------------------------------------------------------------ fit per bike

const fits = new WeakMap<BikeSpec, RdFit>();
/** The derailleur fitted to a bike (cached per spec). */
export function fitFor(B: BikeSpec): RdFit {
  let f = fits.get(B);
  if (!f) fits.set(B, (f = new RdFit(B)));
  return f;
}

/** The derailleur's pose for z and a gap. Remembers the last few, since the stage asks every frame. */
function stateFor(fit: RdFit, z: number, gap: number): RdState {
  const memo = memos.get(fit) ?? [];
  memos.set(fit, memo);
  const hit = memo.find((s) => s.z === z && s.gap === gap);
  if (hit) return hit.st;
  const st = fit.solve(z, fit.bodyFor(gap));
  memo.unshift({ z, gap, st });
  if (memo.length > 4) memo.pop();
  return st;
}
const memos = new WeakMap<RdFit, Array<{ z: number; gap: number; st: RdState }>>();

/** Where the upper pulley sits (x, y) for a derailleur position z and a gap. */
export function upperPulley(B: BikeSpec, z: number, gap = GAP_OK): V2 {
  const st = stateFor(fitFor(B), z, gap);
  return [st.up.x, st.up.y];
}

/** The lower pulley (x, y) for a derailleur position z and a gap. */
export function lowerPulley(B: BikeSpec, z: number, gap = GAP_OK): V2 {
  const st = stateFor(fitFor(B), z, gap);
  return [st.lp.x, st.lp.y];
}

/** Everything the chain needs for a derailleur position z and a gap: sprocket radius, pulley centres, the pose. */
export function derLayout(B: BikeSpec, z: number, gap: number) {
  const fit = fitFor(B);
  const st = stateFor(fit, z, gap);
  return { r: fit.rAt(z), gx: st.up.x, gy: st.up.y, gz: st.up.z, lx: st.lp.x, ly: st.lp.y, lz: st.lp.z, st };
}

const BARREL = RD_RIG.barrel;
const BARREL_LEN = V(BARREL.seat).distanceTo(V(BARREL.head));

// ------------------------------------------------------------------ barrel bracket and cable clamp
//
// The model has no cable clamp the wire can reach: its barrel points about 10 deg down, past the lower body,
// and the boss on the lower body's top (RD_RIG.clamp) lies under the outer link in most gears. So the
// barrel's bracket (the bottom of the upper body, below the L screw) is turned up about its root until the
// barrel points at a clamp bolt made here under the lower body's back end; the wire runs straight from the
// barrel to the bolt and is pinched between the bolt's washer and the body (owner request 2026-11-22).
// Found with scratch scripts in tools/assets/out (not kept). Drawing data, not facts about any part.
//
// The lower body travels about 38 mm inwards over the gears, so the wire leaves the barrel straight in the
// middle gears and up to about 26 deg off its axis on the smallest and the largest sprocket.

/** The bracket's turn: about the hinge (its root), by the quaternion. Library space. */
const BRACKET_HINGE = new T.Vector3(-0.920416, -0.038573, 0.161665);
const BRACKET_TURN = new T.Quaternion(0.04888, 0.066113, 0.082942, 0.993157).normalize();
const BRACKET_M = new T.Matrix4()
  .makeTranslation(BRACKET_HINGE.x, BRACKET_HINGE.y, BRACKET_HINGE.z)
  .multiply(new T.Matrix4().makeRotationFromQuaternion(BRACKET_TURN))
  .multiply(new T.Matrix4().makeTranslation(-BRACKET_HINGE.x, -BRACKET_HINGE.y, -BRACKET_HINGE.z));
/**
 * Which vertices of the upper body are the bracket: below and behind its root, measured in the upper body's
 * frame turned 27.7 deg as the derailleur hangs on the bike (U up, X forward). The weight goes from 0 to 1
 * over 4 mm at the root, so the mesh stays closed where the bracket bends.
 */
const BR_U = new T.Vector3(0.464842, 0.885394, 0);
const BR_X = new T.Vector3(0.885394, -0.464842, 0);
const bracketWeight = (p: T.Vector3) => {
  const wu = Math.max(0, Math.min(1, (-0.462 - p.dot(BR_U)) / 0.008));
  const wx = Math.max(0, Math.min(1, (-0.78 - p.dot(BR_X)) / 0.004));
  return wu * wx;
};

/** The barrel where the turned bracket holds it (library space, upper body's frame). */
const BAR = {
  head: V(BARREL.head).applyMatrix4(BRACKET_M),
  seat: V(BARREL.seat).applyMatrix4(BRACKET_M),
  d: V(BARREL.d).normalize().applyQuaternion(BRACKET_TURN),
};

/**
 * The clamp bolt under the lower body (library space, lower body's frame): its centre on the body's face
 * and its axis out of the face; the wire enters under the washer at WIRE_IN, beside the shank, and leaves
 * past the bolt at WIRE_TAIL.
 */
const CLAMP = {
  p: new T.Vector3(-0.829789, -0.084916, 0.175834),
  d: new T.Vector3(-0.382574, -0.912791, 0.143001).normalize(),
};
/** The inner wire's drawn radius (cockpit.ts draws it). */
export const WIRE_R = 0.0014;
// measured with the wire's centre 2 mm off the face; moved to one radius off it
const WIRE_IN = new T.Vector3(-0.840865, -0.081107, 0.183532).addScaledVector(CLAMP.d, WIRE_R - 0.002);
const WIRE_TAIL = new T.Vector3(-0.820661, -0.089745, 0.182448).addScaledVector(CLAMP.d, WIRE_R - 0.002);

/** The upper body with its bracket turned (see BRACKET_M). */
function upperBodyGeo(): T.BufferGeometry {
  return once('upper-body', () => {
    const g = libGeo('rd_upper_body').clone();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const v = new T.Vector3();
    const t = new T.Vector3();
    const n = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const w = bracketWeight(v);
      if (w === 0) continue;
      t.copy(v).applyMatrix4(BRACKET_M);
      v.lerp(t, w);
      pos.setXYZ(i, v.x, v.y, v.z);
      if (nor) {
        n.fromBufferAttribute(nor, i);
        t.copy(n).applyQuaternion(BRACKET_TURN);
        n.lerp(t, w).normalize();
        nor.setXYZ(i, n.x, n.y, n.z);
      }
    }
    return g;
  });
}

/**
 * Where the barrel adjuster is on this bike, in bike space (on the derailleur: with the chain on the
 * middle sprocket). `axis` points from its head into the thread.
 */
export function barrelTurn(B: BikeSpec): Turn {
  if (B.barrelAt === 'derailleur') {
    const mid = Math.floor(B.n / 2);
    const st = stateFor(fitFor(B), B.zs[mid], GAP_OK);
    const c = BAR.head.clone().add(BAR.seat).multiplyScalar(0.5).applyMatrix4(st.pose.upper);
    const d = BAR.d.clone().transformDirection(st.pose.upper);
    return { pos: c.toArray() as V3, axis: d.toArray() as V3, len: BARREL_LEN };
  }
  // on the trigger pod's inner end, pointing in and forward where the cable leaves
  const ax: V3 = [0.45, 0, -0.89];
  const tip: V3 = [B.S[0] + 0.012, B.S[1] + 0.004, B.S[2] - 0.0225];
  return { pos: [tip[0] + ax[0] * 0.019, tip[1], tip[2] + ax[2] * 0.019], axis: [-ax[0], 0, -ax[2]], len: 0.038 };
}

// ------------------------------------------------------------------ shared geometry (library space)

/** In-plane basis of an axis d, e1 the projection of world x (as rd-kin's planeBasis). */
function basis(d: T.Vector3): [T.Vector3, T.Vector3] {
  const e1 = new T.Vector3(1, 0, 0).addScaledVector(d, -d.x).normalize();
  return [e1, new T.Vector3().crossVectors(d, e1)];
}

const shared = new Map<string, T.BufferGeometry>();
/** Geometry made once and shared by every bike: marked like library geometry, so disposeTree keeps it. */
function once(key: string, make: () => T.BufferGeometry): T.BufferGeometry {
  let g = shared.get(key);
  if (!g) {
    g = make();
    g.userData.lib = true;
    shared.set(key, g);
  }
  return g;
}

/** Position and normal only, without an index (so pieces can be merged). */
function plain(g: T.BufferGeometry): T.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}

/**
 * A pulley: the library piece's hub (its triangles inside the tooth roots) with a generated 11-tooth
 * ring on the chain's pitch circle (`toothOutline`). The model's own pulleys have 10 generic teeth,
 * which the chain's rollers would not sit in. Gap k of the ring is at angle k * 2 pi / 11 from e1
 * (`basis` of the axle) in the pulley's plane.
 */
function pulleyGeo(which: 'upper' | 'lower'): T.BufferGeometry {
  return once(`pulley-${which}`, () => {
    const r = RD_RIG.pulleys[which];
    const c = V(r.c);
    const d = V(r.d).normalize();
    const [e1, e2] = basis(d);
    const cut = RP_RD - SEAT_R - 0.0015;
    const src = plain(libGeo(which === 'upper' ? 'rd_pulley_upper' : 'rd_pulley_lower'));
    const pos = src.attributes.position;
    const nor = src.attributes.normal;
    const keepP: number[] = [];
    const keepN: number[] = [];
    const v = new T.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      let inside = true;
      for (let j = 0; j < 3 && inside; j++) {
        v.fromBufferAttribute(pos, i + j).sub(c);
        inside = Math.hypot(v.dot(e1), v.dot(e2)) < cut;
      }
      if (!inside) continue;
      for (let j = 0; j < 3; j++) {
        keepP.push(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
        keepN.push(nor.getX(i + j), nor.getY(i + j), nor.getZ(i + j));
      }
    }
    const hub = new T.BufferGeometry();
    hub.setAttribute('position', new T.Float32BufferAttribute(keepP, 3));
    hub.setAttribute('normal', new T.Float32BufferAttribute(keepN, 3));
    // the ring, from inside the hub's edge out to the teeth
    const shape = new T.Shape(toothOutline(r.teeth).map(([x, y]) => new T.Vector2(x, y)));
    const hole = new T.Path();
    hole.absarc(0, 0, cut - 0.003, 0, TAU, true);
    shape.holes.push(hole);
    const ring = new T.ExtrudeGeometry(shape, { depth: r.width, bevelEnabled: false, curveSegments: 18 });
    ring.translate(0, 0, -r.width / 2);
    ring.applyMatrix4(new T.Matrix4().makeBasis(e1, e2, d).setPosition(c));
    return mergeGeometries([hub, plain(ring)])!;
  });
}

/**
 * A cage plate, made longer by `stretch` along the line from the upper to the lower pulley. Vertices
 * up to 13 mm beyond the upper axle stay (the upper boss), those from 13 mm before the lower axle move
 * the whole stretch (the lower boss), and the straight part between is stretched evenly.
 */
function cagePlate(name: LibName, stretch: number): T.BufferGeometry {
  const src = libGeo(name);
  if (stretch <= 0) return src;
  return once(`${name}-${stretch.toFixed(5)}`, () => {
    const g = src.clone();
    const pos = g.attributes.position;
    const t0 = 0.026;
    const t1 = CAGE_LEN - 0.026;
    const v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const t = v.clone().sub(RIG.Up).dot(CAGE_DIR);
      const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
      v.addScaledVector(CAGE_DIR, stretch * k);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    return g;
  });
}

/** The barrel adjuster re-centred on its axis: local y along the axis (head at -y), origin at its middle. */
function barrelGeo(): T.BufferGeometry {
  return once('barrel', () => {
    const c = V(BARREL.head).add(V(BARREL.seat)).multiplyScalar(0.5);
    const q = new T.Quaternion().setFromUnitVectors(UP, V(BARREL.d).normalize());
    const toLocal = new T.Matrix4().compose(c, q, new T.Vector3(1, 1, 1)).invert();
    return libGeo('rd_barrel').clone().applyMatrix4(toLocal);
  });
}

// ------------------------------------------------------------------ build

/** What BikeModel keeps of the derailleur it built, for moving it in moveDerailleur. */
export interface DerParts {
  fit: RdFit;
  /** frames from library space to bike space (matrices set from the pose) */
  upper: T.Group;
  linkOuter: T.Group;
  linkInner: T.Group;
  lower: T.Group;
  cage: T.Group;
  pulleyU: T.Group;
  pulleyL: T.Group;
  st: RdState | null;
  /** the housing's last bend into the barrel (bike space, at the middle sprocket), ending at housingFrom along the barrel's axis */
  housingIn: V3[];
  /** the cable: housing from housingFrom (bike space) to housingEnd; wire (3 pieces) from wireFrom out along the barrel to wireOut (upper body), straight to WIRE_IN under the clamp bolt and on to WIRE_TAIL (lower body) */
  housing: T.Mesh | null;
  wire: T.Mesh[];
  housingFrom: V3;
  housingEnd: T.Vector3;
  wireFrom: T.Vector3;
  wireOut: T.Vector3;
  /** the B screw slides along its axis as the body turns, so its tip stays on the hanger's tab (bike space) */
  bScrew: { group: T.Object3D; base: T.Vector3; p: T.Vector3; d: T.Vector3; len: number; tab: T.Vector3 };
  /** the pulleys' spin and the chainShift it belongs to */
  spin: { u: number; l: number; shift: number };
}

const frame = (parent: T.Object3D) => {
  const g = new T.Group();
  g.matrixAutoUpdate = false;
  parent.add(g);
  return g;
};

/** Screw lengths: the H and L screws' shanks; the B screw sticks out of its boss this far at the right gap. */
const HL_LEN = 0.02;
const B_OUT = 0.006;

/**
 * An M4 screw with a socket head, turnable: shank `len` long from the head seat `p` along `d`, the
 * head outside. Made in code (the model's screws are fused into the body).
 */
function screw(m: BikeModel, id: string, p: T.Vector3, d: T.Vector3, len: number, parent: T.Object3D): T.Object3D {
  const at = p.clone().addScaledVector(d, len / 2);
  const spin = m.turnable(id, { pos: at.toArray() as V3, axis: d.toArray() as V3, len }, parent);
  const h = len / 2;
  m.add(id, new T.CylinderGeometry(0.004, 0.004, len, 10), null, null, { parent: spin, k: 1.15 });
  m.add(id, new T.CylinderGeometry(0.0068, 0.007, 0.006, 18), [0, -h - 0.003, 0], null, { parent: spin, k: 1.25 });
  m.add(id, new T.CylinderGeometry(0.0029, 0.0029, 0.0008, 6), [0, -h - 0.0062, 0], null, { parent: spin, dark: true });
  return m.parts.get(id)!.group;
}

/**
 * The clamp bolt under the lower body (CLAMP): shank, washer and an M4 socket head, made in code. The washer
 * stands one wire's thickness off the body's face, so the wire is pinched between them, beside the shank.
 */
function cableClamp(m: BikeModel, lower: T.Object3D): void {
  const q = new T.Quaternion().setFromUnitVectors(UP, CLAMP.d);
  // a cylinder on the bolt axis, from `from` to `from + h` out of the face
  const disc = (r: number, h: number, from: number, k: number, dark = false) => {
    const mesh = m.add(D, new T.CylinderGeometry(r, r, h, 18), null, null, { parent: lower, k, dark });
    mesh.position.copy(CLAMP.p).addScaledVector(CLAMP.d, from + h / 2);
    mesh.quaternion.copy(q);
  };
  const washer = 2 * WIRE_R;
  disc(0.004, washer + 0.001, -0.001, 1.15); // shank, from inside the face to the washer
  disc(0.0085, 0.001, washer, 1.2); // washer
  disc(0.0068, 0.006, washer + 0.001, 1.25); // head
  disc(0.0029, 0.0008, washer + 0.007, 1, true); // hex socket
}

/**
 * The wire's loose end past the clamp, in the lower body's frame: on straight out of the washer, then bent
 * away from the body and out to the side, with a crimped end cap. Drawing data.
 */
export function buildWireTail(m: BikeModel): void {
  const d = m.der;
  if (!d) return;
  const along = WIRE_TAIL.clone().sub(WIRE_IN).normalize();
  const out = new T.Vector3(0, 0, 1).addScaledVector(along, -along.z).normalize();
  const p0 = WIRE_TAIL.clone();
  const p1 = p0.clone().addScaledVector(along, 0.006);
  const p2 = p1.clone().addScaledVector(along, 0.01).addScaledVector(out, 0.008).addScaledVector(CLAMP.d, 0.004);
  const p3 = p2.clone().addScaledVector(out, 0.03).addScaledVector(along, 0.006).addScaledVector(CLAMP.d, 0.004);
  const pts = [p0, p1, p2, p3].map((p) => p.toArray() as V3);
  m.add('shift_cable', curveGeo(pts, WIRE_R, 24), null, null, { parent: d.lower, k: 1.3 });
  const dir = p3.clone().sub(p2).normalize();
  const CAP = 0.01;
  const cap = m.add('shift_cable', new T.CylinderGeometry(WIRE_R * 1.7, WIRE_R * 1.7, CAP, 10), null, null, { parent: d.lower, k: 0.95 });
  cap.position.copy(p3).addScaledVector(dir, CAP / 2 - 0.002);
  cap.quaternion.setFromUnitVectors(UP, dir);
}

/** Hanger; upper body with the H, L and B screws and the barrel; links; lower body; cage and pulleys. */
export function buildDerailleur(m: BikeModel): void {
  const B = m.spec;
  const fit = fitFor(B);
  const dg = m.part(D).group;
  m.part('upper_pulley');
  const upper = frame(dg);
  const linkOuter = frame(dg);
  const linkInner = frame(dg);
  const lower = frame(dg);
  const cage = frame(dg);
  const pulleyU = frame(cage);
  const pulleyL = frame(cage);
  m.cage = cage;

  // shading: the bodies lighter, links and cage darker, pulleys dark as before
  m.add(D, upperBodyGeo(), null, null, { parent: upper, k: 0.9 });
  m.add(D, libGeo('rd_link_outer'), null, null, { parent: linkOuter, k: 0.62 });
  m.add(D, libGeo('rd_link_inner'), null, null, { parent: linkInner, k: 0.55 });
  m.add(D, libGeo('rd_lower_body'), null, null, { parent: lower, k: 0.85 });
  m.add(D, cagePlate('rd_cage_outer', fit.stretch), null, null, { parent: cage, k: 0.5 });
  m.add(D, cagePlate('rd_cage_inner', fit.stretch), null, null, { parent: cage, k: 0.45 });
  m.add('upper_pulley', pulleyGeo('upper'), null, null, { parent: pulleyU, k: 0.35 });
  m.add(D, pulleyGeo('lower'), null, null, { parent: pulleyL, k: 0.35 }).userData.pulley = true;
  m.anchor('upper_pulley', cage, RIG.Up.clone().add(new T.Vector3(0, 0.008, 0.02)).toArray() as V3);
  m.anchor(D, upper, RIG.B.clone().lerp(RIG.UO, 0.6).add(new T.Vector3(0, 0.012, 0.03)).toArray() as V3);

  // the screws, at the spots measured on the upper body
  const sc = RD_RIG.screws;
  screw(m, 'h_screw', V(sc.h.p), V(sc.h.d).normalize(), HL_LEN, upper);
  screw(m, 'l_screw', V(sc.l.p), V(sc.l.d).normalize(), HL_LEN, upper);
  const bp = V(sc.b.p);
  const bd = V(sc.b.d).normalize();
  const bLen = sc.bLen + B_OUT;
  const bGroup = screw(m, 'b_screw', bp.clone().addScaledVector(bd, -B_OUT), bd, bLen, upper);
  // the B screw's tip at the right gap, on the middle sprocket: the hanger's tab is there
  const ref = stateFor(fit, B.zs[Math.floor(B.n / 2)], GAP_OK);
  const tab = bp.clone().addScaledVector(bd, sc.bLen).applyMatrix4(ref.pose.upper);

  // Hanger, in the plane of the source's hanger, from the dropout to the bolt, with the tab the B
  // screw's tip rests on. Built in code; rd_hanger is for measuring only.
  m.part('derailleur_hanger');
  const z0 = B.zDrop - 0.0055;
  const z1 = B.zDrop + 0.0035;
  const bolt = fit.bolt;
  m.add('derailleur_hanger', slabGeo(hullShape([[B.rx, B.huby, 0.022], [bolt.x, bolt.y, 0.019], [tab.x, tab.y, 0.006]]), z0, z1, 0.0015), null, null, { k: 0.8 });
  m.anchor('derailleur_hanger', m.bike, [(B.rx + bolt.x) / 2, (B.huby + bolt.y) / 2, z1 + 0.008]);

  // Barrel adjuster on the body where the housing comes in, or a plain cable stop there when the
  // barrel is on the shifter (the user never sees two).
  const head = BAR.head.clone();
  const seat = BAR.seat.clone();
  const bdir = BAR.d.clone();
  let housingEnd = head.clone();
  if (B.barrelAt === 'derailleur') {
    const spin = m.turnable('barrel_adjuster', { pos: head.clone().add(seat).multiplyScalar(0.5).toArray() as V3, axis: bdir.toArray() as V3, len: BARREL_LEN }, upper);
    m.add('barrel_adjuster', barrelGeo(), null, null, { parent: spin, k: 1.0 });
  } else {
    const len = 0.014;
    const stop = m.add(D, new T.CylinderGeometry(BARREL.r * 0.85, BARREL.r, len, 14), null, null, { parent: upper, k: 1.05 });
    stop.position.copy(seat).addScaledVector(bdir, -len / 2);
    stop.quaternion.setFromUnitVectors(UP, bdir);
    housingEnd = seat.clone().addScaledVector(bdir, -len);
    const bt = barrelTurn(B);
    const spin = m.turnable('barrel_adjuster', bt, m.bike);
    const br = 0.011;
    m.add('barrel_adjuster', new T.CylinderGeometry(br, br, bt.len * 0.75, 12), [0, -bt.len * 0.125, 0], null, { parent: spin, flat: true });
    for (const y of [-0.3, 0, 0.3]) m.add('barrel_adjuster', new T.CylinderGeometry(br + 0.0018, br + 0.0018, 0.003, 12), [0, -bt.len * 0.125 + y * bt.len * 0.75, 0], null, { parent: spin, k: 0.8, flat: true });
    m.add('barrel_adjuster', new T.CylinderGeometry(br * 0.55, br * 0.55, bt.len * 0.25, 8), [0, bt.len * 0.375, 0], null, { parent: spin, k: 1.2 });
  }
  // the housing comes in along the barrel's axis from behind: cockpit.ts loops it down from the stay through
  // housingIn, which bends it round onto the axis; the short straight piece to the barrel moves with the body
  const onAxis = (t: number) => housingEnd.clone().addScaledVector(bdir, -t).applyMatrix4(ref.pose.upper);
  const hb = onAxis(0.012);
  // a circular arc (radius 4 cm) in the upright plane through the barrel's axis: back along the axis, then up
  const e0 = onAxis(0.03);
  const back = bdir.clone().transformDirection(ref.pose.upper).negate();
  const up = new T.Vector3(0, 1, 0).addScaledVector(back, -back.y).normalize();
  const R = 0.08;
  const arc = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    return e0.clone().addScaledVector(back, R * Math.sin(t)).addScaledVector(up, R * (1 - Math.cos(t)));
  };
  const housingIn = [arc(115), arc(90), arc(60), arc(30), e0].map((p) => p.toArray() as V3);
  cableClamp(m, lower);
  m.der = {
    fit, upper, linkOuter, linkInner, lower, cage, pulleyU, pulleyL, st: null,
    housing: null, wire: [],
    housingFrom: [hb.x, hb.y, hb.z],
    housingIn,
    housingEnd, wireFrom: seat.clone(), wireOut: seat.clone().addScaledVector(bdir, WIRE_EXIT),
    bScrew: { group: bGroup, base: bGroup.position.clone(), p: bp, d: bd, len: bLen, tab },
    spin: { u: 0, l: 0, shift: 0 },
  };
}

// ------------------------------------------------------------------ move

const tV = new T.Vector3();
const tA = new T.Vector3();
const tB = new T.Vector3();
const tM = new T.Matrix4();
const tInv = new T.Matrix4();

/** Poses the derailleur for z and a gap, puts the chain's pulley circles there, and moves the cable ends. */
export function moveDerailleur(m: BikeModel, z: number, gap: number): void {
  const d = m.der;
  if (!d) return;
  const st = layoutCirc(m, z, gap).st;
  d.st = st;
  const p = st.pose;
  const set = (g: T.Group, mat: T.Matrix4) => {
    g.matrix.copy(mat);
    g.matrixWorldNeedsUpdate = true;
  };
  set(d.upper, p.upper);
  set(d.linkOuter, p.linkOuter);
  set(d.linkInner, p.linkInner);
  set(d.lower, p.lower);
  set(d.cage, p.cage);
  // B screw: its tip stays on the tab as the body turns
  const bs = d.bScrew;
  tV.copy(bs.tab).applyMatrix4(tM.copy(p.upper).invert());
  const s = tV.sub(bs.p).dot(bs.d) - RD_RIG.screws.bLen;
  bs.group.position.copy(bs.base).addScaledVector(bs.d, s);
  // cable
  if (d.housing) seg(d.housing, d.housingFrom, tA.copy(d.housingEnd).applyMatrix4(p.upper));
  if (d.wire.length === 3) {
    // through the barrel and the bracket's bore, straight to the clamp bolt, under its washer and past it
    tA.copy(d.wireFrom).applyMatrix4(p.upper);
    tB.copy(d.wireOut).applyMatrix4(p.upper);
    seg(d.wire[0], tA, tB);
    tA.copy(WIRE_IN).applyMatrix4(p.lower);
    seg(d.wire[1], tB, tA);
    tC.copy(WIRE_TAIL).applyMatrix4(p.lower);
    seg(d.wire[2], tA, tC);
  }
}

/**
 * The inner wire leaves the bracket WIRE_EXIT along the barrel's axis past its seat (9.5 mm, measured by ray
 * parity on the source mesh, plus 1 mm). Drawing data.
 */
const WIRE_EXIT = 0.021;
const tC = new T.Vector3();

/** One pin of a wheel: its index, or -1. */
function firstOn(m: BikeModel, wheel: number): number {
  for (let k = 0; k < m.links; k++) if (m.pins.wheel[k] === wheel) return k;
  return -1;
}

const BAS = { upper: basis(V(RD_RIG.pulleys.upper.d).normalize()), lower: basis(V(RD_RIG.pulleys.lower.d).normalize()) };
const PULLEY_C = { upper: V(RD_RIG.pulleys.upper.c), lower: V(RD_RIG.pulleys.lower.c) };

/**
 * Spins the pulleys with the chain (after layChain): a tooth gap under the pins on each pulley, the
 * whole number of teeth taken from how far the chain moved since the last frame, as layChain does
 * for the sprockets. The chain wraps the upper pulley clockwise, the lower one counterclockwise.
 */
export function spinPulleys(m: BikeModel): void {
  const d = m.der;
  if (!d?.st) return;
  const a = TAU / RD_RIG.pulleys.upper.teeth;
  const inv = tInv.copy(d.st.pose.cage).invert();
  const travel = m.chainShift - d.spin.shift;
  d.spin.shift = m.chainShift;
  for (const [which, wheel, sgn] of [['upper', 2, -1], ['lower', 3, 1]] as const) {
    const key = which === 'upper' ? 'u' : 'l';
    const expected = d.spin[key] + (sgn * travel) / RP_RD;
    const k = firstOn(m, wheel);
    let spin = expected;
    if (k >= 0) {
      tV.set(m.pins.x[k], m.pins.y[k], m.pins.z[k]).applyMatrix4(inv);
      if (which === 'lower') tV.addScaledVector(CAGE_DIR, -d.fit.stretch);
      tV.sub(PULLEY_C[which]);
      const [e1, e2] = BAS[which];
      const phi = Math.atan2(tV.dot(e2), tV.dot(e1));
      const base = ((phi % a) + a) % a;
      spin = base + Math.round((expected - base) / a) * a;
    }
    d.spin[key] = spin;
    const g = which === 'upper' ? d.pulleyU : d.pulleyL;
    g.matrix.copy(pulleySpin(which, spin));
    if (which === 'lower') g.matrix.premultiply(tM.makeTranslation(CAGE_DIR.x * d.fit.stretch, CAGE_DIR.y * d.fit.stretch, CAGE_DIR.z * d.fit.stretch));
    g.matrixWorldNeedsUpdate = true;
  }
}
