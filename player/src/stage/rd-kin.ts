// The rear derailleur's kinematics on the measured rig (rd-rig.ts): where each moving piece is for a hanger
// bolt position and three angles. Pure maths on three.js matrices; derailleur.ts builds and moves the meshes.
// Session area: D (derailleur).
//
// The pieces are stored where they sit in the source model (library space), so each piece's transform is
// "turn it from its source pose to the new one":
//   upper body  turns about the B-axis (the hanger bolt) by the body angle, and moves with the bolt;
//   links       turn about their upper pins (on the upper body). The four pins are not an exact parallelogram
//               (upper pins 16.03 mm apart, lower 15.00 mm), so the inner link and the lower body follow
//               from solving the four-bar linkage, not from copying the outer link's turn;
//   lower body  (P-knuckle) is the four-bar's coupler;
//   cage        turns about the P-axis on the lower body;
//   pulleys     spin about their axles on the cage.
//
// Angles are absolute, measured from the axes themselves, so the source's own pose is just one set of angles:
//   body  the direction from the B-axis to the upper outer pin, about the B-axis (0 = forward, + = up/forward turn);
//   link  the outer link's direction (upper -> lower pin) about the pin axis, in the upper body's frame;
//   cage  the direction from the upper to the lower pulley about the P-axis, in the lower body's frame.

import * as T from 'three';
import { RD_RIG, type RigV3 } from './rd-rig.js';

const V = (v: RigV3) => new T.Vector3(v[0], v[1], v[2]);

/** A turn by `ang` about the axis through p along d. */
export function rotAbout(p: T.Vector3, d: T.Vector3, ang: number, out = new T.Matrix4()): T.Matrix4 {
  const R = new T.Matrix4().makeRotationAxis(d, ang);
  return out.makeTranslation(p.x, p.y, p.z).multiply(R).multiply(new T.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
}

/** In-plane basis perpendicular to d, with e1 the projection of `ref` (or of world x). */
function planeBasis(d: T.Vector3, ref = new T.Vector3(1, 0, 0)): [T.Vector3, T.Vector3] {
  const e1 = ref.clone().addScaledVector(d, -ref.dot(d));
  if (e1.lengthSq() < 1e-8) e1.set(0, 1, 0).addScaledVector(d, -d.y);
  e1.normalize();
  return [e1, new T.Vector3().crossVectors(d, e1)];
}

/** Angle of v about axis d (with its basis). */
const angleIn = (v: T.Vector3, [e1, e2]: [T.Vector3, T.Vector3]) => Math.atan2(v.dot(e2), v.dot(e1));

export interface Rig {
  B: T.Vector3; Bd: T.Vector3; Bbasis: [T.Vector3, T.Vector3];
  a: T.Vector3; abasis: [T.Vector3, T.Vector3];
  UO: T.Vector3; UI: T.Vector3; LO: T.Vector3; LI: T.Vector3;
  P: T.Vector3; Pd: T.Vector3; Pbasis: [T.Vector3, T.Vector3];
  Up: T.Vector3; Lp: T.Vector3; Ud: T.Vector3; Ld: T.Vector3;
  /** link lengths and the coupler, in the pin plane (2D) */
  lOuter: number; lInner: number; lCoupler: number;
  /** which of the two four-bar solutions the source is in */
  branch: number;
  /** the source pose's angles */
  src: RdAngles;
}

function makeRig(): Rig {
  const r = RD_RIG;
  const B = V(r.bAxis.p), Bd = V(r.bAxis.d).normalize();
  const a = V(r.pinDir).normalize();
  const UO = V(r.pins.upperOuter), UI = V(r.pins.upperInner), LO = V(r.pins.lowerOuter), LI = V(r.pins.lowerInner);
  const P = V(r.pAxis.p), Pd = V(r.pAxis.d).normalize();
  const Up = V(r.pulleys.upper.c), Lp = V(r.pulleys.lower.c);
  const Bbasis = planeBasis(Bd), abasis = planeBasis(a), Pbasis = planeBasis(Pd);
  const p2 = (v: T.Vector3) => new T.Vector2(v.dot(abasis[0]), v.dot(abasis[1]));
  const cr = (u: T.Vector2, v: T.Vector2) => u.x * v.y - u.y * v.x;
  const rig: Rig = {
    B, Bd, Bbasis, a, abasis, UO, UI, LO, LI, P, Pd, Pbasis, Up, Lp,
    Ud: V(r.pulleys.upper.d).normalize(), Ld: V(r.pulleys.lower.d).normalize(),
    lOuter: p2(LO).sub(p2(UO)).length(), lInner: p2(LI).sub(p2(UI)).length(), lCoupler: p2(LI).sub(p2(LO)).length(),
    branch: Math.sign(cr(p2(LO).sub(p2(UI)), p2(LI).sub(p2(UI)))),
    src: { body: 0, link: 0, cage: 0 },
  };
  rig.src = {
    body: angleIn(UO.clone().sub(B), Bbasis),
    link: angleIn(LO.clone().sub(UO), abasis),
    cage: angleIn(Lp.clone().sub(Up), Pbasis),
  };
  return rig;
}

export const RIG = makeRig();

/**
 * The links' whole swing, as absolute link angles. Measured on the rig: the source sits near the outer end (about
 * where the smallest sprocket is); turning the link angle up moves the P-knuckle inwards, down and back (towards
 * the larger sprockets), about 37 mm sideways over the first 70 degrees. Below about -33 degrees from the source
 * the four-bar folds (the outer link's end comes too near the inner upper pin), so the swing stops at -30.
 */
export const LINK_SWING = { min: RIG.src.link - (30 * Math.PI) / 180, max: RIG.src.link + (80 * Math.PI) / 180 };

export interface RdAngles { body: number; link: number; cage: number }

/** Where each moving piece is: matrices from the piece's source pose (library space) to bike space. */
export interface RdPose {
  upper: T.Matrix4;
  linkOuter: T.Matrix4;
  linkInner: T.Matrix4;
  lower: T.Matrix4;
  cage: T.Matrix4;
  /** false when the four-bar cannot reach this link angle (the pose is then the nearest it can do) */
  ok: boolean;
}

/** The pose for a hanger bolt at `bolt` (bike space; the B-axis keeps its direction) and absolute angles. */
export function rdPose(bolt: T.Vector3, ang: RdAngles, rig = RIG): RdPose {
  const { B, Bd, a, UO, UI, LO, LI, P, Pd, abasis } = rig;
  // upper body: turn about the bolt, then move the bolt to its place
  const upper = rotAbout(B, Bd, ang.body - rig.src.body);
  upper.premultiply(new T.Matrix4().makeTranslation(bolt.x - B.x, bolt.y - B.y, bolt.z - B.z));
  // four-bar in the upper body's (source) frame, in the plane perpendicular to the pins
  const dOuter = ang.link - rig.src.link;
  const linkOuterL = rotAbout(UO, a, dOuter);
  const LO1 = LO.clone().applyMatrix4(linkOuterL);
  const p2 = (v: T.Vector3) => new T.Vector2(v.dot(abasis[0]), v.dot(abasis[1]));
  const ui = p2(UI), lo1 = p2(LO1);
  const dv = lo1.clone().sub(ui);
  const dist = dv.length();
  const r0 = rig.lInner, r1 = rig.lCoupler;
  // circle around UI (inner link) meets circle around LO1 (coupler)
  const x = (dist * dist + r0 * r0 - r1 * r1) / (2 * dist);
  const h2 = r0 * r0 - x * x;
  const ok = h2 >= 0;
  const h = Math.sqrt(Math.max(0, h2));
  const ex = dv.clone().divideScalar(dist || 1);
  const ey = new T.Vector2(-ex.y, ex.x);
  const cand = [1, -1].map((s) => ui.clone().addScaledVector(ex, x).addScaledVector(ey, s * h));
  const cr = (u: T.Vector2, v: T.Vector2) => u.x * v.y - u.y * v.x;
  const li1 = cand.find((c) => Math.sign(cr(lo1.clone().sub(ui), c.clone().sub(ui))) === rig.branch) ?? cand[0];
  const ang2 = (v: T.Vector2) => Math.atan2(v.y, v.x);
  const li0 = p2(LI), lo0 = p2(LO);
  const dInner = ang2(li1.clone().sub(ui)) - ang2(li0.clone().sub(ui));
  const dCoupler = ang2(li1.clone().sub(lo1)) - ang2(li0.clone().sub(lo0));
  const linkInnerL = rotAbout(UI, a, dInner);
  const lowerL = rotAbout(LO, a, dCoupler).premultiply(new T.Matrix4().makeTranslation(LO1.x - LO.x, LO1.y - LO.y, LO1.z - LO.z));
  // cage: turns about the P-axis, which rides on the lower body
  const cageL = rotAbout(P, Pd, ang.cage - rig.src.cage);
  const lower = upper.clone().multiply(lowerL);
  return {
    upper,
    linkOuter: upper.clone().multiply(linkOuterL),
    linkInner: upper.clone().multiply(linkInnerL),
    lower,
    cage: lower.clone().multiply(cageL),
    ok,
  };
}

/** A pulley's spin on the cage: from the pulley's source pose to its place on the cage's source pose. */
export function pulleySpin(which: 'upper' | 'lower', ang: number, rig = RIG): T.Matrix4 {
  return which === 'upper' ? rotAbout(rig.Up, rig.Ud, ang) : rotAbout(rig.Lp, rig.Ld, ang);
}

/** The absolute angles of a pose, measured back from its pieces (for tests). */
export function anglesOf(pose: RdPose, rig = RIG): RdAngles {
  const inv = pose.upper.clone().invert();
  const tf = (m: T.Matrix4, v: T.Vector3) => v.clone().applyMatrix4(m);
  const bolt = tf(pose.upper, rig.B);
  const uo = tf(pose.upper, rig.UO);
  // body: the outer pin about the (moved) bolt; the B-axis keeps its direction
  const body = angleIn(uo.clone().sub(bolt), rig.Bbasis);
  // link: in the upper body's frame
  const lo = tf(inv, tf(pose.linkOuter, rig.LO));
  const link = angleIn(lo.clone().sub(rig.UO), rig.abasis);
  // cage: in the lower body's frame
  const invL = pose.lower.clone().invert();
  const up = tf(invL, tf(pose.cage, rig.Up));
  const lp = tf(invL, tf(pose.cage, rig.Lp));
  const cage = angleIn(lp.sub(up), rig.Pbasis);
  return { body, link, cage };
}
