// The parked bike (pose 'parked', clip park-at-wall): it leans a little towards a wall on its non-drive side and
// rests on it with the rear tyre only; the bar is turned towards the wall, as a parked bike's falls. Pure maths,
// no three.js: the lean, and where the wall stands (wall.ts builds it from the bike's meshes).
//
// The wall is a vertical plane at an angle to the bike, closest at the rear: the bar end and the left pedal stick
// out much further than the tyre, so a wall parallel to the bike would touch them first (owner, 2026-11-26).
// `wallLine` finds the smallest angle at which the rear tyre touches the wall and every other point of the bike
// stays WALL_GAP off it. Space: world (x along the bike, forward +; y up; z across, drive side +); plan is (x, z).

import { GROUND, type BikeSpec, type V3 } from './spec.js';

/** the lean towards the wall, rad (3 deg, drawing value) */
export const PARK_LEAN = 0.052;
/** the bar turned towards the wall, rad (10 deg, drawing value; BikeModel.setSteer: positive is to the rider's left) */
export const PARK_STEER = 0.17;
/** how far every part but the rear tyre stays off the wall (5 mm) */
export const WALL_GAP = 0.01;
/** parts not drawn on a parked bike: the kickstand is folded away */
export const PARK_HIDES: readonly string[] = ['kickstand'];
/** the steepest wall angle tried (40 deg) and the search step (0.25 deg) */
const ANGLE_MAX = 0.7;
const ANGLE_STEP = 0.0044;

export type P2 = [number, number];

/** The camera on the parked bike (bike space): from the drive side, behind and above, about as far as whole_bike. */
export function parkCam(B: BikeSpec): { p: V3; t: V3 } {
  const t: V3 = [(B.rx + B.FX) / 2, B.huby + 0.35, -0.15];
  const dir: V3 = [-1, 0.45, 0.6];
  const k = 6.2 / Math.hypot(...dir);
  return { p: [t[0] + dir[0] * k, t[1] + dir[1] * k, t[2] + dir[2] * k], t };
}

/**
 * The lean as pose values (pose.ts): a roll about x (rrx) towards the non-drive side (-z), and the move (ry, rz)
 * that keeps the line where the tyres stand on the ground (y = GROUND, z = 0) where it was.
 */
export function parkedLean(): { ry: number; rz: number; rrx: number } {
  const a = -PARK_LEAN;
  return { ry: GROUND * (1 - Math.cos(a)), rz: -GROUND * Math.sin(a), rrx: a };
}

/** A bike-space point where the parked pose puts it in world space. */
export function leanPt(p: V3): V3 {
  const { ry, rz, rrx } = parkedLean();
  const c = Math.cos(rrx), s = Math.sin(rrx);
  return [p[0], p[1] * c - p[2] * s + ry, p[1] * s + p[2] * c + rz];
}

/** Points on the rear tyre's surface (the torus it is drawn as, bike.ts), in bike space. */
export function tyrePts(B: BikeSpec, ring = 720, tube = 36): V3[] {
  const R = B.rt - B.tt;
  const out: V3[] = [];
  for (let i = 0; i < ring; i++) {
    const f = (i / ring) * 2 * Math.PI;
    for (let j = 0; j < tube; j++) {
      const g = (j / tube) * 2 * Math.PI;
      const r = R + B.tt * Math.cos(g);
      out.push([B.rx + r * Math.cos(f), B.huby + r * Math.sin(f), B.tt * Math.sin(g)]);
    }
  }
  return out;
}

/** The convex hull of plan points (Andrew's monotone chain): only its corners can touch a straight wall first. */
export function hull2(pts: P2[]): P2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (pts: P2[]) => {
    const h: P2[] = [];
    for (const q of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    return h.slice(0, -1);
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * The wall's face in plan: its normal (sin angle, cos angle) points from the wall to the bike, and points on the face
 * have normal·(x, z) = d. So at angle 0 it runs along the bike's non-drive side, and with a larger angle it moves away
 * from the bike towards the front.
 */
export interface WallLine { angle: number; d: number }

/** How far a plan point is from the wall's face, positive on the bike's side. */
export function wallDist(w: WallLine, p: P2): number {
  return Math.sin(w.angle) * p[0] + Math.cos(w.angle) * p[1] - w.d;
}

/**
 * The wall the rear tyre rests on: the smallest angle at which every point of `rest` stays `gap` off the face while
 * the face touches `tyre`. Both are world plan points. Null if no angle up to 40 deg does it.
 */
export function wallLine(tyre: P2[], rest: P2[], gap = WALL_GAP): WallLine | null {
  const t = hull2(tyre);
  const r = hull2(rest);
  const low = (pts: P2[], a: number) => pts.reduce((m, p) => Math.min(m, Math.sin(a) * p[0] + Math.cos(a) * p[1]), Infinity);
  for (let i = 0; i * ANGLE_STEP <= ANGLE_MAX; i++) {
    const a = i * ANGLE_STEP;
    const d = low(t, a);
    if (low(r, a) - d >= gap) return { angle: a, d };
  }
  return null;
}
