// Animations: named clips (ported from the prototype's alignAnim, gapAnim, shiftAnim and the
// prep step) and generic motions on any node. An animation is a function of time that returns a
// Frame: what the derailleur, screws, cranks and the bike's pose should do at that moment.
// The stage applies frames; nothing here touches three.js objects.

import { GAP_BIG, GAP_OK, GAP_SMALL, type BikeSpec } from './bike.js';
import { CLIPS, MOTIONS, NODES, partsOf, type Pose } from './registry.js';

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
  /** a marker for where the pulley should be */
  ghost?: { kind: 'align'; z: number } | { kind: 'gap' };
  /** a turning arrow on a screw; dir 1 = screw in */
  arrow?: { node: ScrewNode; dir: 1 | -1 };
  /** the bike moving from one way of holding to another */
  pose?: { from: Pose; to: Pose; k: number };
  /** the stand's clamp lever, rad; positive closes */
  lever?: number;
  node?: NodeMotion;
}

export interface Anim {
  /** one loop, in seconds */
  duration: number;
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
const PEDAL = 4.2;

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

    case 'limit-screw-align': {
      // The pulley starts out of line with the sprocket and moves into line as the screw turns.
      const screw: ScrewNode = a.target === 'l_screw' || a.target === 'h_screw' ? a.target : ctx.focus.includes('l_screw') && !ctx.focus.includes('h_screw') ? 'l_screw' : 'h_screw';
      const base = screw === 'h_screw' ? small : large;
      // H limits the way out, L the way in; screwing in moves the pulley away from that limit.
      // Out of line by about two sprockets, so the difference reads but stays plausible.
      const o = Math.max(0.016, spec.sp * 2);
      const off = screw === 'h_screw' ? (sign > 0 ? o : -o) : sign > 0 ? -o : o;
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
          const gap = start + (GAP_OK - start) * ramp(t, 0.9, 2.6);
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
      return {
        duration: 5.4,
        frame: (t) => ({
          derZ: zb + (zg - zb) * (0.3 * (ramp(t, 0.2, 0.6) - ramp(t, 0.8, 1.2)) + ramp(t, 3.1, 3.9)),
          crankSpeed: PEDAL,
          screws: { barrel_adjuster: sign * QUARTER * ramp(t, 1.4, 2.8) },
          status: t < 3.9 ? 'bad' : 'good',
          arrow: t > 1.2 && t < 3.0 ? { node: 'barrel_adjuster', dir: sign } : undefined,
        }),
      };
    }
  }
  return undefined;
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
    return { duration: 4, frame: () => ({ crankSpeed: sign * 2.6 }) };
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
