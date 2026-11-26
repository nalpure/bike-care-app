// Animations: named clips (ported from the prototype's alignAnim, gapAnim, shiftAnim and the
// prep step) and generic motions on any node. An animation is a function of time that returns a
// Frame: what the derailleur, screws, cranks and the bike's pose should do at that moment.
// The stage applies frames; nothing here touches three.js objects.

import * as T from 'three';
import { GAP_BIG, GAP_OK, GAP_SMALL, rAt, type BikeSpec } from './bike.js';
import type { BarrelPick } from './barrel.js';
import { derLayout, fitFor } from './derailleur.js';
import { CLIPS, MOTIONS, NODES, partsOf, type Pose } from './registry.js';
import { barrelClose, type ViewPose } from './views.js';

type V3 = [number, number, number];

export const ease = (x: number) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};
export const ramp = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export type ScrewNode = 'h_screw' | 'l_screw' | 'b_screw' | 'barrel_adjuster';

export interface NodeMotion {
  parts: string[];
  /** rotation (rad) about the parts' centre, translation in bike units, scale, opacity */
  rot: [number, number, number];
  move: [number, number, number];
  scale: number;
  fade: number;
  /** turn and scale about this point (in the parts' parent space, bike space for parts on the bike) instead of each part's centre: the parts move as one */
  about?: [number, number, number];
}

const tE = new T.Euler();
const tPivot = new T.Vector3();
/**
 * Where a moved part's group goes: turned and scaled about the pivot (`about`, else the part's centre), then moved.
 * Writes into pos and quat; the group's scale is nm.scale. Pure maths, used by the stage and the tests.
 */
export function placeMoved(nm: NodeMotion, basePos: T.Vector3, center: T.Vector3, pos: T.Vector3, quat: T.Quaternion): void {
  quat.setFromEuler(tE.set(...nm.rot));
  const c = nm.about ? tPivot.set(...nm.about) : tPivot.copy(center);
  pos.copy(basePos).sub(c).multiplyScalar(nm.scale).applyQuaternion(quat).add(c).add(tPivot.set(...nm.move));
}

export interface Frame {
  /** where the derailleur should be (z) and the gap of its upper pulley */
  derZ?: number;
  gap?: number;
  /** screw angles in rad; positive means screwing in */
  screws?: Partial<Record<ScrewNode, number>>;
  /** pedalling speed in rad/s; positive is forward */
  crankSpeed?: number;
  /** turning a wheel by hand, rad/s */
  wheelSpeed?: { rear_wheel?: number; front_wheel?: number };
  /** colours the derailleur: still wrong, or right now */
  status?: 'good' | 'bad';
  /** nodes drawn in the "bad" colour while the frame says so: a bent or wrong part (clips only) */
  marks?: string[];
  /** nodes whose outline is drawn where they rest (the correct or starting pose) while the clip moves them (clips only) */
  contour?: string[];
  /** a marker for where the pulley should be */
  ghost?: { kind: 'align'; z: number } | { kind: 'gap' };
  /** a turning arrow on a screw; dir 1 = screw in */
  arrow?: { node: ScrewNode; dir: 1 | -1 };
  /** the bike moving from one way of holding to another */
  pose?: { from: Pose; to: Pose; k: number };
  /** the stand's clamp lever, rad; positive closes */
  lever?: number;
  node?: NodeMotion;
  /**
   * What the clip adds to the card's scene while it plays (clips only): nodes drawn as well, and nodes marked in the
   * focus colour. When the clip stops (or another card shows), the card's own scene comes back.
   */
  scene?: { show?: string[]; focus?: string[] };
  /** where the camera is and what it looks at, in bike space (clips only); the stage follows it smoothly */
  cam?: { p: V3; t: V3 };
}

/** The parts a frame's `status` colours. */
const STATUS_PARTS = partsOf('rear_derailleur');

/** The status colour of one part in a frame: marked parts are 'bad'; `status` colours the derailleur. */
export function partStatus(fr: Frame, part: string): 'good' | 'bad' | undefined {
  if (fr.marks?.some((n) => partsOf(n).includes(part))) return 'bad';
  return fr.status && STATUS_PARTS.includes(part) ? fr.status : undefined;
}

/**
 * The hanger-bend clip's tilt, in rad (drawing data, exaggerated so it reads on a phone; not how far a real hanger
 * bends). And where the hanger bends: this far along it from the axle to the derailleur's bolt.
 */
export const HANGER_TILT = 0.2;
const HANGER_ROOT = 0.4;

export interface Anim {
  /** one loop, in seconds */
  duration: number;
  /** plays once and then stays on its last frame (Replay starts it again), instead of looping */
  once?: boolean;
  frame(t: number): Frame;
}

export interface AnimCtx {
  spec: BikeSpec;
  /** focus nodes of the step */
  focus: string[];
  /** how the bike is held before and after this step */
  poseBefore: Pose;
  pose: Pose;
  /** z of sprocket i */
  zOf(i: number): number;
  /** centre of a part in bike space, for generic motions */
  centerOf(part: string): [number, number, number] | undefined;
  /** the barrel adjuster the bike's facts pick (barrel.ts) */
  barrel: BarrelPick;
  /** the gear cable's path in bike space, from the shifter to the derailleur (empty without a cable) */
  route: V3[];
}

/**
 * +1 or -1 from the direction of an animation.
 * Clockwise (screwing in, seen at the screw head), forward, up and towards the spokes are +1;
 * the opposites are -1.
 */
export function dirSign(direction?: string): 1 | -1 {
  // The content's direction enum (schema common.schema.json, animation.direction).
  const known: Record<string, 1 | -1> = {
    clockwise: 1, counterclockwise: -1, forward: 1, backward: -1, towards_spokes: 1, away_from_spokes: -1, up: 1, down: -1,
  };
  if (direction && direction in known) return known[direction];
  // Free text, as before the enum.
  const d = (direction ?? '').toLowerCase();
  return /unscrew|loosen|undo|open|backward|anticlockwise|counterclockwise|counter-clockwise|\bout\b|outward|\bdown\b|away/.test(d) ? -1 : 1;
}

const QUARTER = Math.PI / 2;
/**
 * The stage draws 60 pictures a second. Anything that moves more than half its repeat distance in one picture looks as if
 * it runs backwards (the wheel's 18 spokes repeat every 20 deg, the 11 tooth sprocket every 33 deg). So the pedals turn
 * at 2.1 rad/s (the "rotate" clip on the crank at 1.3): the sprocket block, which turns exactly with the chain, then moves
 * well under half a tooth a picture in every gear; the rear wheel's drawn turn is capped by wheelStep.
 */
export const PEDAL = 2.1;
export const CRANK_SPIN = 1.3;
/** the most the rear wheel is drawn to turn in one picture (rad): below half the spokes' repeat (0.175 rad) */
export const WHEEL_MAX_STEP = 0.12;

/**
 * How far the wheel is drawn to turn in one picture of length dt at a turn rate (rad/s). A drawing rule against
 * strobing, not physics: the wheel keeps its direction (and the freewheel) but turns slower than it would.
 */
export function wheelStep(rate: number, dt: number): number {
  const step = rate * dt;
  return Math.sign(step) * Math.min(Math.abs(step), WHEEL_MAX_STEP);
}

/**
 * A named clip, or undefined when the clip does not exist. Content names a clip without a
 * direction (the build allows none); the screw clips then show screwing in, and the generic
 * rotate motion on a screw (with its direction) uses the same clip.
 */
export function clip(name: string, a: any, ctx: AnimCtx): Anim | undefined {
  const { spec } = ctx;
  const n = spec.n;
  const sign = dirSign(a.direction);
  const small = ctx.zOf(0);
  const large = ctx.zOf(n - 1);
  switch (name) {
    case 'shift-to-smallest':
      // The chain walks down to the smallest sprocket while the pedals turn.
      return { duration: 5, frame: (t) => ({ derZ: large + (small - large) * ramp(t, 1, 2.4), crankSpeed: PEDAL }) };

    case 'shift-to-largest': {
      // One gear at a time, up to the largest sprocket.
      const per = 0.55;
      return {
        duration: 1.6 + per * n,
        frame: (t) => ({ derZ: ctx.zOf(t < 0.8 ? 0 : Math.min(n - 1, Math.floor((t - 0.8) / per) + 1)), crankSpeed: PEDAL }),
      };
    }

    case 'shift-test-ride': {
      // A ride: the pedals and both wheels turn while the chain is shifted one gear at a time, up to the largest
      // sprocket and back to the smallest. The front wheel turns at the speed the rear wheel is driven at.
      const per = 0.45;
      const lead = 0.8;
      const steps = 2 * Math.max(1, n - 1);
      const gearAt = (t: number) => {
        const s = Math.floor(Math.min(steps, Math.max(0, (t - lead) / per)));
        return s <= steps / 2 ? s : steps - s;
      };
      return {
        duration: lead * 2 + per * steps,
        frame: (t) => {
          const z = ctx.zOf(gearAt(t));
          return { derZ: z, crankSpeed: PEDAL, wheelSpeed: { front_wheel: (PEDAL * spec.rc) / rAt(spec, z) } };
        },
      };
    }

    case 'limit-screw-align': {
      // The pulley starts out of line with the sprocket and moves into line as the screw turns.
      const screw: ScrewNode = a.target === 'l_screw' || a.target === 'h_screw' ? a.target : ctx.focus.includes('l_screw') && !ctx.focus.includes('h_screw') ? 'l_screw' : 'h_screw';
      const base = screw === 'h_screw' ? small : large;
      // H limits the way out, L the way in; screwing in moves the pulley away from that limit.
      // Out of line by about two sprockets, so the difference reads but stays plausible; the links
      // only swing so far (on a wide cassette not even two sprockets past the largest), so the
      // offset is cut to what the derailleur can reach.
      const o0 = Math.max(0.016, spec.sp * 2);
      const want = screw === 'h_screw' ? (sign > 0 ? o0 : -o0) : sign > 0 ? -o0 : o0;
      const o = Math.min(o0, Math.abs(derLayout(spec, base + want, GAP_OK).gz - base));
      const off = Math.sign(want) * o;
      return {
        duration: 4.4,
        frame: (t) => {
          const left = off * (1 - ramp(t, 0.9, 2.6));
          return {
            derZ: base + left,
            screws: { [screw]: sign * QUARTER * ramp(t, 0.2, 2.6) },
            status: Math.abs(left) < o * 0.18 ? 'good' : 'bad',
            ghost: { kind: 'align', z: base },
            arrow: t < 2.9 ? { node: screw, dir: sign } : undefined,
          };
        },
      };
    }

    case 'b-gap-adjust': {
      // Screwing in the B screw opens a gap that is too small; unscrewing closes one too big.
      const start = sign > 0 ? GAP_SMALL : GAP_BIG;
      return {
        duration: 4.4,
        frame: (t) => {
          // the gap follows the screw as it turns
          const gap = start + (GAP_OK - start) * ramp(t, 0.2, 2.6);
          return {
            derZ: large,
            gap,
            screws: { b_screw: sign * QUARTER * ramp(t, 0.2, 2.6) },
            status: Math.abs(gap - GAP_OK) < 0.0025 ? 'good' : 'bad',
            ghost: { kind: 'gap' },
            arrow: t < 2.9 ? { node: 'b_screw', dir: sign } : undefined,
          };
        },
      };
    }

    case 'cable-tension-shift': {
      // A shift stalls, the barrel adjuster turns, then the shift goes through.
      // Unscrewing the barrel tightens the cable: the chain then reaches the bigger sprocket.
      const m = Math.floor(n / 2);
      const goal = Math.max(0, Math.min(n - 1, sign < 0 ? m + 1 : m - 1));
      const zb = ctx.zOf(m);
      const zg = ctx.zOf(goal);
      // The barrel the facts pick is marked and drawn with what is around it, so it does not float: at the
      // derailleur the rear end, the hanger and the cable; at the front the handlebar, the shifter, the cable
      // and the frame (its head tube is what the close-up shows). Owner decision 2026-11-26.
      const at = ctx.barrel.main;
      const scene = at === 'rear_barrel'
        ? { show: ['rear_end', 'derailleur_hanger', 'rear_derailleur', 'shift_cable'], focus: [at] }
        : { show: ['handlebar', 'shifter_rear', 'shift_cable', 'frame'], focus: [at] };
      return {
        duration: 5.4,
        frame: (t) => ({
          derZ: zb + (zg - zb) * (0.3 * (ramp(t, 0.2, 0.6) - ramp(t, 0.8, 1.2)) + ramp(t, 3.1, 3.9)),
          crankSpeed: PEDAL,
          screws: { barrel_adjuster: sign * QUARTER * ramp(t, 1.4, 2.8) },
          status: t < 3.9 ? 'bad' : 'good',
          arrow: t > 1.2 && t < 3.0 ? { node: 'barrel_adjuster', dir: sign } : undefined,
          scene,
        }),
      };
    }

    case 'barrel-tour': {
      // Where to look for the barrel adjuster: both barrels marked, the camera close on the derailleur's, then
      // along the gear cable to the front one (on the shifter, or behind a drop bar), and it stays there.
      const route = tourRoute(ctx.route);
      const from = barrelClose(spec, 'rear_barrel');
      const to = barrelClose(spec, 'front_barrel');
      const scene = { focus: ['rear_barrel', 'front_barrel'] };
      return {
        duration: TOUR.end,
        once: true,
        frame: (t) => ({ cam: tourCam(route, from, to, t), scene }),
      };
    }

    case 'hanger-bend': {
      // The hanger, and with it the whole derailleur (screws, pulleys, cable stop), tilts about the bike's length
      // axis where the hanger leaves the dropout: towards the spokes, back through straight, outwards, back.
      // The hanger is red while it is off straight; the straight hanger and derailleur stay drawn as an outline.
      const bolt = fitFor(spec).bolt;
      const root: [number, number, number] = [
        spec.rx + (bolt.x - spec.rx) * HANGER_ROOT, spec.huby + (bolt.y - spec.huby) * HANGER_ROOT, spec.zDrop,
      ];
      // a positive turn about x moves a point below the root towards -z; the drive side is +z, so that is inwards
      const inward = Math.sign(spec.zDrop || 1) * Math.sign(root[1] - bolt.y || 1);
      const contour = ['derailleur_hanger', 'rear_derailleur'];
      return {
        duration: 5.6,
        frame: (t) => {
          const k = ramp(t, 0.6, 1.4) - 2 * ramp(t, 2.0, 3.0) + ramp(t, 3.6, 4.4);
          const nm: NodeMotion = { parts: ['derailleur_hanger', 'rear_derailleur'], rot: [inward * HANGER_TILT * k, 0, 0], move: [0, 0, 0], scale: 1, fade: 1, about: root };
          return { node: nm, contour, marks: Math.abs(k) > 0.12 ? ['derailleur_hanger'] : undefined };
        },
      };
    }
  }
  return undefined;
}

/** The barrel tour's timing (s): close on the derailleur's barrel until `go`, along the cable until `arrive`, then close on the front one. */
export const TOUR = { go: 1.6, leave: 3.0, near: 6.0, arrive: 8.2, end: 9.7 };
/** How far the camera follows the cable from (bike units), and from which side: the drive side, a little behind and above. */
const TOUR_DIST = 1.0;
const TOUR_DIR: V3 = (() => {
  const d: V3 = [-0.25, 0.4, 1];
  const l = Math.hypot(...d);
  return [d[0] / l, d[1] / l, d[2] / l];
})();

/**
 * The cable's route from the derailleur to the shifter, evened out for a camera to follow: points 1 cm apart
 * along it, each the mean of its neighbours within 12 cm, so loops and bends of the housing do not shake the view.
 */
export function tourRoute(route: V3[]): V3[] {
  const r = route.slice().reverse();
  if (r.length < 2) return r;
  const even: V3[] = [r[0]];
  const step = 0.02;
  let left = step;
  for (let i = 1; i < r.length; i++) {
    let a = r[i - 1];
    const b = r[i];
    let d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    while (d >= left) {
      const k = left / d;
      a = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      even.push(a);
      d -= left;
      left = step;
    }
    left -= d;
  }
  even.push(r[r.length - 1]);
  const w = 12;
  return even.map((_, i) => {
    const lo = Math.max(0, i - w);
    const hi = Math.min(even.length - 1, i + w);
    const s: V3 = [0, 0, 0];
    for (let j = lo; j <= hi; j++) for (let c = 0; c < 3; c++) s[c] += even[j][c];
    return [s[0] / (hi - lo + 1), s[1] / (hi - lo + 1), s[2] / (hi - lo + 1)];
  });
}

/** The tour's camera at time t: the close-up `from`, blended into following the route, blended into the close-up `to`. */
export function tourCam(route: V3[], from: ViewPose, to: ViewPose, t: number): { p: V3; t: V3 } {
  const mix = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const u = ramp(t, TOUR.go, TOUR.arrive);
  let p: V3 = from.p;
  let look: V3 = from.t;
  if (route.length) {
    const f = u * (route.length - 1);
    const i = Math.min(route.length - 2, Math.floor(f));
    const at = route.length > 1 ? mix(route[i], route[i + 1], f - i) : route[0];
    const follow = { p: [at[0] + TOUR_DIR[0] * TOUR_DIST, at[1] + TOUR_DIR[1] * TOUR_DIST, at[2] + TOUR_DIR[2] * TOUR_DIST] as V3, t: at };
    const kIn = ramp(t, TOUR.go, TOUR.leave);
    p = mix(from.p, follow.p, kIn);
    look = mix(from.t, follow.t, kIn);
  }
  const kOut = ramp(t, TOUR.near, TOUR.arrive);
  return { p: mix(p, to.p, kOut), t: mix(look, to.t, kOut) };
}

/** The way of holding the bike that a motion on the whole bike starts from. */
function partnerPose(motion: string, to: Pose): Pose {
  if (to !== 'ground') return 'ground';
  if (motion === 'rotate') return 'flipped';
  if (motion === 'push' || motion === 'pull') return 'hung';
  return 'ground';
}

/** A generic motion on a node, or undefined when the node or motion does not exist. */
export function motion(a: any, ctx: AnimCtx): Anim | undefined {
  const target: string = a.target;
  const kind: string = a.motion;
  if (!NODES[target] || !(MOTIONS as readonly string[]).includes(kind)) return undefined;
  const sign = dirSign(a.direction);

  if (target === 'bike') {
    // From how the bike was held before the step to how it is held after; when the step
    // changes nothing, from the pose the motion usually starts from.
    const to = ctx.pose;
    const from = ctx.poseBefore !== to ? ctx.poseBefore : partnerPose(kind, to);
    return { duration: 4.2, frame: (t) => ({ pose: { from, to, k: ramp(t, 0.7, 2.3) } }) };
  }
  if ((target === 'crank' || target === 'chainring') && kind === 'rotate') {
    return { duration: 4, frame: () => ({ crankSpeed: sign * CRANK_SPIN }) };
  }
  if ((target === 'rear_wheel' || target === 'front_wheel') && kind === 'rotate') {
    return { duration: 4, frame: () => ({ wheelSpeed: { [target]: sign * 2 } }) };
  }
  // Turning a derailleur screw or the barrel adjuster shows what it does:
  // the limit screws bring the pulley into line, the B screw sets the gap, the barrel the cable.
  if ((target === 'h_screw' || target === 'l_screw') && kind === 'rotate') return clip('limit-screw-align', a, ctx);
  if (target === 'b_screw' && kind === 'rotate') return clip('b-gap-adjust', a, ctx);
  if (target === 'barrel_adjuster' && kind === 'rotate') return clip('cable-tension-shift', a, ctx);
  if (target === 'stand_clamp' && kind === 'rotate') {
    // tighten: the lever closes; loosen: it opens
    return { duration: 3.4, frame: (t) => ({ lever: sign > 0 ? -1.4 + 1.4 * ramp(t, 0.5, 1.8) : -1.4 * ramp(t, 0.5, 1.8) }) };
  }
  if (target === 'rear_derailleur' && (kind === 'push' || kind === 'pull')) {
    // Pushing towards the spokes moves it to the largest sprocket, as far as the L screw lets it.
    const inward = (kind === 'push') === (sign > 0);
    const from = ctx.zOf(Math.floor(ctx.spec.n / 2));
    const to = inward ? ctx.zOf(ctx.spec.n - 1) : ctx.zOf(0);
    return { duration: 4.6, frame: (t) => ({ derZ: from + (to - from) * (ramp(t, 0.5, 1.7) - ramp(t, 3.4, 4.2)) }) };
  }

  // Any other node: move its parts about their centre.
  const parts = partsOf(target);
  const c = ctx.centerOf(parts[0]) ?? [0, 0, 0];
  // "in" is towards the bike's centre plane, or down for parts that sit on it
  const inward: [number, number, number] = Math.abs(c[2]) > 0.04 ? [0, 0, -Math.sign(c[2])] : [0, -1, 0];
  const go = (t: number) => ramp(t, 0.5, 1.7) - (kind === 'remove' || kind === 'insert' ? 0 : ramp(t, 3.0, 3.6));
  return {
    duration: 3.9,
    frame: (t) => {
      const k = go(t);
      const nm: NodeMotion = { parts, rot: [0, 0, 0], move: [0, 0, 0], scale: 1, fade: 1 };
      const d = 0.06 * k;
      if (kind === 'rotate') nm.rot = [0, 0, sign * 0.6 * k];
      if (kind === 'push') nm.move = [inward[0] * d * sign, inward[1] * d * sign, inward[2] * d * sign];
      if (kind === 'pull') nm.move = [-inward[0] * d * sign, -inward[1] * d * sign, -inward[2] * d * sign];
      if (kind === 'slide') nm.move = [sign * 0.08 * k, 0, 0];
      if (kind === 'squeeze') nm.scale = 1 - 0.15 * k;
      if (kind === 'remove' || kind === 'insert') {
        const out = kind === 'remove' ? k : 1 - k;
        nm.move = [-inward[0] * 0.3 * out, -inward[1] * 0.3 * out + 0.1 * out, -inward[2] * 0.3 * out];
        nm.fade = 1 - 0.85 * out;
      }
      return { node: nm };
    },
  };
}

/** Any animation from content: a clip or a generic motion. Undefined when it cannot be played. */
export function makeAnim(a: any, ctx: AnimCtx): Anim | undefined {
  if (!a) return undefined;
  if (a.clip) return (CLIPS as readonly string[]).includes(a.clip) ? clip(a.clip, a, ctx) : undefined;
  return motion(a, ctx);
}
