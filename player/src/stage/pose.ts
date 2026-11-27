// How the bike is held: the pose values (where the holder stands, how the bike turns in it) for each way of holding it,
// and the mix between two poses. Pure maths on the BikeSpec, no three.js, so a test can check where the bike rests.
// A pose's world transform of a bike point (x, y, z): holder at (hx, hy) turned by hrz about z, then the bike at
// (rx, ry, rz) turned by rrx about x. `steer` is the handlebar's angle (BikeModel.setSteer), `wall` how much of the
// parked bike's wall is drawn (0..1, park.ts).

import { GROUND, LIFT, type BikeSpec } from './spec.js';
import { PARK_STEER, parkedLean } from './park.js';
import type { Pose } from './registry.js';

export interface PoseVals { hx: number; hy: number; hrz: number; rx: number; ry: number; rz: number; rrx: number; steer: number; wall: number }

const REST: PoseVals = { hx: 0, hy: 0, hrz: 0, rx: 0, ry: 0, rz: 0, rrx: 0, steer: 0, wall: 0 };

export function poseVals(p: Pose, B: BikeSpec): PoseVals {
  if (p === 'stand') return { ...REST, ry: LIFT };
  if (p === 'flipped') {
    // resting on the saddle's highest point and the bar's (both measured on the library parts, mounts.ts)
    const [xs, ys] = B.saddleRest;
    const by = B.barTop;
    return { ...REST, hx: xs, hy: GROUND, hrz: -Math.atan((ys - by[1]) / (by[0] - xs)), rx: -xs, ry: ys, rrx: Math.PI };
  }
  if (p === 'hung') {
    // hanging by the saddle: the rear wheel lifts, the front wheel stays on the ground
    return { ...REST, hx: B.FX, hy: GROUND, hrz: -0.17, rx: -B.FX, ry: -GROUND };
  }
  // on its wheels, leaning on a wall at the rear tyre, the bar turned towards the wall
  if (p === 'parked') return { ...REST, ...parkedLean(), steer: PARK_STEER, wall: 1 };
  return { ...REST };
}

export function mixPose(a: PoseVals, b: PoseVals, k: number): PoseVals {
  const m = (x: number, y: number) => x + (y - x) * k;
  // turning the bike over lifts it on the way; leaning it on a wall does not
  const arc = Math.abs(a.rrx - b.rrx) > 1 ? Math.sin(Math.PI * k) * 0.45 : 0;
  return {
    hx: m(a.hx, b.hx), hy: m(a.hy, b.hy) + arc, hrz: m(a.hrz, b.hrz), rx: m(a.rx, b.rx), ry: m(a.ry, b.ry), rz: m(a.rz, b.rz),
    rrx: m(a.rrx, b.rrx), steer: m(a.steer, b.steer), wall: m(a.wall, b.wall),
  };
}
