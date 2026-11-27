// The cockpit: the library stem, the bar (the library's flat bar with grips, or a generated drop bar with levers),
// brake levers, the right shifter, and the gear cable that runs from the shifter to the derailleur (or hub, or gearbox).
// Stem, bar and grips are one rigid piece placed by BikeSpec.xf (spec.ts: cockpitXf); the levers and the shifter sit at the
// spots measured on the bar (mounts.ts).
// Everything here but the cable is built in the steering hinge (BikeModel.steer, steerPose); the cable spans it: its points
// on the cockpit follow the turn, those on the frame stay (layShiftCable).
// Session area: E (other parts).

import * as T from 'three';
import { frontPlace } from './barrel.js';
import { barrelTurn, buildWireTail, inlineRun, WIRE_R } from './derailleur.js';
import { curveGeo, plate, tubeGeo } from './geo.js';
import { libGeo, type LibName } from './library.js';
import { MOUNTS as M } from './mounts.js';
import { HP, stayPts, steerAxis, xfPt, type BikeSpec, type V3 } from './spec.js';
import type { BikeModel } from './bike.js';

/**
 * The steering hinge turned by `a` radians (BikeModel.setSteer: positive to the rider's left) as a pose: a point p in the
 * hinge goes to quat·p + pos in bike space. A turn about the steering axis (steerAxis); exactly the identity at 0.
 */
export function steerPose(B: BikeSpec, a: number, pos = new T.Vector3(), quat = new T.Quaternion()): { pos: T.Vector3; quat: T.Quaternion } {
  const { p, d } = steerAxis(B);
  const P = new T.Vector3(...p);
  quat.setFromAxisAngle(new T.Vector3(...d), a);
  pos.copy(P).sub(P.applyQuaternion(quat));
  return { pos, quat };
}

/** Stem, bar, levers and the right shifter, in the steering hinge. */
export function buildCockpit(m: BikeModel): void {
  const B = m.spec;
  const { HT, C, S, xf } = B;
  const hasShifter = B.gears !== 'single';
  m.part('handlebar', m.steer);
  m.part('brake_lever', m.steer);
  if (hasShifter) m.part('shifter_rear', m.steer);
  const turn = Math.atan2(xf.s, xf.c);
  /** a library part of the cockpit, in the cockpit's place */
  const put = (lib: LibName, opt: { k?: number; dark?: boolean }) => m.add('handlebar', libGeo(lib), [xf.tx, xf.ty, 0], [0, 0, turn], opt);
  put('stem', { k: 1 });
  if (B.spacer > 0) {
    // spacers under the stem (a riser bar): a stack on the steering axis, up to the stem's foot
    const foot = xfPt(xf, [M.stem.axisP[0] + M.stem.axisD[0] * M.stem.footT, M.stem.axisP[1] + M.stem.axisD[1] * M.stem.footT]);
    m.add('handlebar', tubeGeo([HT[0], HT[1], 0], [foot[0], foot[1], 0], 0.036), null, null, { k: 0.8 });
  }

  if (B.bar === 'drop') {
    // Drop bar: the hoods hold combined brake and shift levers. The brake lever hangs in front
    // of the curve; on the right, the shift paddle sits behind it. The middle is as thick as the stem's clamp.
    for (const sd of [1, -1]) {
      const z = sd * 0.21;
      m.add('handlebar', tubeGeo([C[0], C[1], 0], [C[0], C[1], sd * 0.1], M.bar.radius));
      m.add('handlebar', tubeGeo([C[0], C[1], sd * 0.1], [C[0], C[1], z], 0.0238));
      m.add('handlebar', curveGeo([[C[0], C[1], z], [C[0] + 0.1, C[1] + 0.01, z], [C[0] + 0.18, C[1] - 0.08, z], [C[0] + 0.16, C[1] - 0.19, z], [C[0] + 0.05, C[1] - 0.23, z]], 0.0238));
      const hood = sd > 0 && hasShifter ? 'shifter_rear' : 'brake_lever';
      m.add(hood, new T.BoxGeometry(0.08, 0.038, 0.034), [C[0] + 0.162, C[1] + 0.012, z], [0, 0, 0.28], { k: 0.42 });
      m.add(hood, new T.BoxGeometry(0.022, 0.03, 0.028), [C[0] + 0.198, C[1] + 0.036, z], [0, 0, 0.5], { k: 0.42 });
      m.add('brake_lever', curveGeo([[C[0] + 0.2, C[1] + 0.005, z], [C[0] + 0.218, C[1] - 0.07, z], [C[0] + 0.2, C[1] - 0.14, z], [C[0] + 0.165, C[1] - 0.19, z]], 0.009, 24), null, null, { k: 1.15 });
      if (sd > 0 && hasShifter) {
        m.add('shifter_rear', curveGeo([[C[0] + 0.188, C[1] - 0.01, z], [C[0] + 0.198, C[1] - 0.07, z - 0.004], [C[0] + 0.182, C[1] - 0.12, z - 0.012]], 0.0065, 16), null, null, { k: 0.7 });
      }
    }
    m.anchor('brake_lever', m.steer, [C[0] + 0.22, C[1] - 0.09, 0.21]);
  } else {
    // Flat and riser bars are the same library bar and grips (the riser on spacers, see bikeSpec).
    put('bar_flat', { k: 1 });
    put('grip_drive', { dark: true });
    put('grip_nondrive', { dark: true });
    const g = xfPt(xf, M.lever.at);
    for (const sd of [1, -1]) {
      // brake lever: a clamp on the bar just inboard of the grip, a body forward of the bar and a blade in front of the grip
      const lz = sd * M.lever.z;
      m.add('brake_lever', new T.CylinderGeometry(0.027, 0.027, 0.024, 12), [g[0], g[1], lz], [HP, 0, 0], { k: 0.5 });
      m.add('brake_lever', new T.BoxGeometry(0.055, 0.026, 0.02), [g[0] + 0.03, g[1] + 0.004, lz], null, { k: 0.5 });
      m.add('brake_lever', curveGeo([[g[0] + 0.052, g[1] + 0.0, lz + sd * 0.004], [g[0] + 0.07, g[1] - 0.008, lz + sd * 0.045], [g[0] + 0.075, g[1] - 0.016, lz + sd * 0.1]], 0.0075, 16), null, null, { k: 1.15 });
    }
    if (hasShifter) {
      // trigger shifter under the bar, inboard of the brake lever: the large lever for the thumb
      // (towards the rider) and the small release lever in front for the index finger
      const sh = xfPt(xf, M.shifter.at);
      m.add('shifter_rear', new T.CylinderGeometry(0.026, 0.026, 0.02, 12), [sh[0], sh[1], S[2]], [HP, 0, 0], { k: 0.5 });
      m.add('shifter_rear', new T.BoxGeometry(0.06, 0.036, 0.045), [S[0], S[1], S[2]], null, { k: 0.55 });
      const thumb = m.add('shifter_rear', new T.BoxGeometry(0.03, 1, 0.007), null, null, { k: 0.85 });
      plate(thumb, [S[0] - 0.02, S[1] - 0.012, S[2] + 0.005], [S[0] - 0.065, S[1] - 0.022, S[2] + 0.04], [0, 1, 0]);
      const trig = m.add('shifter_rear', new T.BoxGeometry(0.018, 1, 0.006), null, null, { k: 0.85 });
      plate(trig, [S[0] + 0.022, S[1] - 0.008, S[2] + 0.004], [S[0] + 0.042, S[1] - 0.026, S[2] + 0.03], [1, 0, 0]);
      m.add('shifter_rear', new T.BoxGeometry(0.004, 0.016, 0.026), [S[0] - 0.031, S[1] + 0.004, S[2]], null, { dark: true });
    }
    m.anchor('brake_lever', m.steer, [g[0] + 0.07, g[1], M.lever.z + 0.06]);
  }
  if (hasShifter) m.anchor('shifter_rear', m.steer, [S[0], S[1] + 0.05, S[2]]);
}

/** One point of the gear cable's path, and how much of the steering turn it follows: 1 on the cockpit, 0 on the frame. */
export interface CablePt { p: V3; steer: number }

/**
 * How much of the turn the free housing in front of the head tube follows: between the bar and the frame, it swings
 * part of the way, so the curve stays smooth and keeps its distance from the steering axis. Drawing data.
 */
const FREE = 0.5;

/** The cable's path with the bar turned by `a` (setSteer): each point turned about the steering axis by its share of `a`. */
export function cablePath(B: BikeSpec, pts: CablePt[], a: number): V3[] {
  const pose = { pos: new T.Vector3(), quat: new T.Quaternion() };
  return pts.map(({ p, steer }) => {
    if (steer * a === 0) return [...p] as V3;
    steerPose(B, steer * a, pose.pos, pose.quat);
    return new T.Vector3(...p).applyQuaternion(pose.quat).add(pose.pos).toArray() as V3;
  });
}

/** Lays the gear cable's main run for the steering angle `a`: a new tube along cablePath (the old one disposed), and `cableRoute`. */
export function layShiftCable(m: BikeModel, a: number): void {
  const c = m.cable!;
  const path = cablePath(m.spec, c.pts, a);
  c.mesh.geometry.dispose();
  c.mesh.geometry = curveGeo(path, 0.006, 360);
  m.cableRoute = path;
}

/**
 * Gear cable from the shifter to the derailleur (or the hub, or the gearbox). It spans the steering hinge: the main run is
 * laid by layShiftCable from points tagged with their share of the turn; the derailleur's end (setDer) stays on the frame.
 */
export function buildShiftCable(m: BikeModel): void {
  const B = m.spec;
  const { ST, HT, HB, C, S, rx, huby, bby, zDrop: zD, chainline: zc } = B;
  const [hx, hy] = HT;
  const bt = barrelTurn(B, 'front_barrel');
  // On a derailleur the housing ends in a loop behind the axle; its last bit, to the
  // derailleur (which turns about its bolt), is placed in setDer.
  const derEnd: V3 | null = m.der ? m.der.housingFrom : null;
  const end: V3 = derEnd ?? (B.gears === 'hub' ? [rx + 0.035, huby - 0.02, zD + 0.02] : [0.05, bby + 0.1, zc - 0.01]);
  const loop: V3[] = derEnd ? [[rx + 0.1, huby + 0.03, zD + 0.04], [rx + 0.01, huby + 0.06, zD + 0.06], ...m.der!.housingIn] : [];
  // along the down tube (u from the bottom bracket) or just above the top tube (at x)
  const dt = (u: number): V3 => [HB[0] * (1 - u), bby + (HB[1] - bby) * u, 0.06];
  const tt = (x: number, z: number): V3 => [x, ST[1] + ((x - ST[0]) / (HT[0] - ST[0])) * (HT[1] - ST[1]) + 0.04, z];
  const cs = stayPts(B, 'chain', 1);
  const ss = stayPts(B, 'seat', 1);
  const along = (a: V3, b: V3, t: number, dy: number, dz: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + dy, a[2] + (b[2] - a[2]) * t + dz];
  // the points on the cockpit (they turn with the bar), the free housing in front of the head tube, the frame's
  const bar = (...p: V3[]): CablePt[] => p.map((q) => ({ p: q, steer: 1 }));
  const free = (p: V3): CablePt => ({ p, steer: FREE });
  const frame = (...p: V3[]): CablePt[] => p.map((q) => ({ p: q, steer: 0 }));
  let start: CablePt[];
  if (B.bar === 'drop') {
    // from the hood along the bar, then out behind it through a straight run (the inline adjuster's place)
    const { a, b } = inlineRun(B);
    start = [...bar([S[0] - 0.035, S[1] - 0.02, S[2] - 0.005], [C[0] + 0.07, C[1] - 0.012, 0.2], a, bt.pos, b), free([HB[0] + 0.02, HB[1] + 0.01, 0.07])];
  } else {
    const head: V3 = [bt.pos[0] - bt.axis[0] * bt.len / 2, bt.pos[1], bt.pos[2] - bt.axis[2] * bt.len / 2];
    start = [...bar(head, [head[0] + 0.02, head[1] - 0.03, head[2] - 0.17]), free([hx + 0.1, hy - 0.05, 0.09])];
  }
  const pts: CablePt[] = B.bar === 'drop'
    ? [...start, ...frame([HB[0] * 0.7, dt(0.7)[1], 0.06], dt(0.35), [0.05, bby - 0.07, 0.05], along(cs[2], cs[4], 0.1, 0.035, 0.02), along(cs[2], cs[4], 0.6, 0.035, 0.022), ...loop, end)]
    : B.gears === 'gearbox'
      ? [...start, ...frame([HB[0] - 0.08, HB[1] - 0.05, 0.07], dt(0.4), end)]
      : [...start, ...frame(tt(HT[0] - 0.25, 0.08), tt(HT[0] - 0.45, 0.05), tt(-0.05, 0.05), tt(ST[0] + 0.02, 0.06), along(ss[0], ss[1], 0.4, 0.03, 0.02), along(ss[0], ss[1], 0.75, 0.03, 0.022), ...loop, end)];
  m.cable = { mesh: m.add('shift_cable', new T.BufferGeometry(), null, null, { k: 0.6 }), pts };
  layShiftCable(m, m.steerAngle);
  if (m.der) buildFrontBarrel(m);
  m.anchor('shift_cable', m.bike, B.bar === 'drop' ? along(cs[2], cs[4], 0.3, 0.05, 0.02) : tt(-0.05, 0.08));
  if (m.der) {
    // the housing's last bit, and the inner wire out of the barrel and down to its clamp on the lower body
    // (placed by moveDerailleur, in bike space)
    m.der.housing = m.add('shift_cable', new T.CylinderGeometry(0.006, 0.006, 1, 8), null, null, { k: 0.6 });
    m.der.wire = [0, 1, 2].map(() => m.add('shift_cable', new T.CylinderGeometry(WIRE_R, WIRE_R, 1, 6), null, null, { k: 1.3 }));
    buildWireTail(m);
  }
}

/**
 * The front barrel adjuster (barrel.ts): on the trigger shifter's inner end where the cable leaves it (flat and
 * riser bars), or an inline adjuster in the housing just behind a drop bar: a ribbed knob on the shifter's side
 * that turns, on a smooth body towards the frame. Built along local y, head (the cable's way in) at -y. Drawing data.
 */
function buildFrontBarrel(m: BikeModel): void {
  const B = m.spec;
  const bt = barrelTurn(B, 'front_barrel');
  const spin = m.turnable('front_barrel', bt, m.steer);
  const L = bt.len;
  if (frontPlace(B.bar) === 'shifter') {
    const br = 0.011;
    m.add('front_barrel', new T.CylinderGeometry(br, br, L * 0.75, 12), [0, -L * 0.125, 0], null, { parent: spin, flat: true });
    for (const y of [-0.3, 0, 0.3]) m.add('front_barrel', new T.CylinderGeometry(br + 0.0018, br + 0.0018, 0.003, 12), [0, -L * 0.125 + y * L * 0.75, 0], null, { parent: spin, k: 0.8, flat: true });
    m.add('front_barrel', new T.CylinderGeometry(br * 0.55, br * 0.55, L * 0.25, 8), [0, L * 0.375, 0], null, { parent: spin, k: 1.2 });
    return;
  }
  const br = 0.0095;
  m.add('front_barrel', new T.CylinderGeometry(br, br, L * 0.5, 12), [0, -L * 0.25, 0], null, { parent: spin, flat: true });
  for (const y of [-0.4, -0.25, -0.1]) m.add('front_barrel', new T.CylinderGeometry(br + 0.0016, br + 0.0016, 0.0028, 12), [0, y * L, 0], null, { parent: spin, k: 0.8, flat: true });
  m.add('front_barrel', new T.CylinderGeometry(br * 0.8, br * 0.8, L * 0.5, 12), [0, L * 0.25, 0], null, { parent: spin.parent!, k: 1.15 });
}
