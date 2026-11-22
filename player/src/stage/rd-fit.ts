// The measured rear derailleur (rd-kin.ts) fitted to one bike: where its hanger bolt is, how long the
// chain is, how long the cage is, and the three angles for a derailleur position z and a B gap.
// Pure maths (three.js vectors and the chain path); derailleur.ts builds and moves the meshes.
// Session area: D (derailleur).
//
// How the angles are found, as on a real bike:
//   link  (the cable): the upper pulley's centre plane lies on the target z;
//   body  (the B screw): the gap on the largest sprocket is the target gap;
//   cage  (its spring): the cage turns back until the chain, which has a fixed length, is taut.
// The gap on the other sprockets follows from the geometry.
// Every size here is drawing data, not a fact about any part (hard rule 3).

import * as T from 'three';
import { buildPath, newPath, type Circle } from './chain.js';
import { chordLength } from './pins.js';
import { RD_RIG } from './rd-rig.js';
import { LINK_SWING, RIG, rdPose, type RdAngles, type RdPose } from './rd-kin.js';
import { GAP_BIG, PITCH, type BikeSpec } from './spec.js';

const DEG = Math.PI / 180;

/** The pulleys' pitch radius (11 teeth, chain-true at the model's roller seats). */
export const RP_RD = RD_RIG.pulleys.upper.rPitch;
/** The source cage: upper to lower pulley, length and direction (library space). */
export const CAGE_LEN = RIG.Lp.clone().sub(RIG.Up).length();
export const CAGE_DIR = RIG.Lp.clone().sub(RIG.Up).normalize();

/**
 * Long cage (owner decision 2026-11-21): above 36 teeth on the largest sprocket the cage is made longer.
 * Rule: the wrap is (largest - smallest sprocket) + (largest - smallest chainring; one chainring here,
 * so 0). The source cage (82 mm) turns about 3.1 degrees per tooth of wrap, so between its stops
 * (CAGE_STOP, 115 degrees) it takes up about 36 teeth. Each tooth of wrap beyond 36 adds
 * CAGE_PER_TOOTH (4.25 mm): the shortest that keeps the chain taut in every gear within the stops
 * (measured: 10-51 on 13 speeds needs 21 mm). A cassette above 36 teeth with a wrap of 36 or less (11-42 on one
 * chainring: 31) fits the source cage, so it keeps its length.
 */
export const CAGE_PER_TOOTH = 0.0085;
export function cageStretch(B: BikeSpec): number {
  const wrap = B.cassette[B.n - 1] - B.cassette[0];
  return B.cassette[B.n - 1] > 36 ? Math.max(0, wrap - 36) * CAGE_PER_TOOTH : 0;
}

/**
 * Hanger bolt: below and slightly behind the axle (BOLT_DIR), as on real frames. Its distance from the
 * axle is chosen so the B screw can open the gap on the largest sprocket to GAP_BIG and a little more
 * before the upper pulley turns away again: the farthest the upper pulley gets from the bolt is about
 * the B-axis to the cage pivot plus the cage pivot to the upper pulley (REACH, measured on the rig, less
 * 1 mm). At least BOLT_MIN (25 mm). A wide cassette (51 teeth) gets a long hanger (about 65 mm): there
 * is no source for a mountain bike derailleur with a longer B-knuckle yet.
 */
export const BOLT_DIR = -105 * DEG;
export const BOLT_MIN = 0.06;
const GAP_TOP = GAP_BIG + 0.004;

/** Illinois (regula falsi) on [a, b] with f(a), f(b) of opposite signs. */
function root(f: (x: number) => number, a: number, b: number, fa: number, fb: number, tol: number): number {
  let side = 0;
  for (let i = 0; i < 60; i++) {
    const c = (a * fb - b * fa) / (fb - fa);
    const fc = f(c);
    if (Math.abs(fc) < tol || Math.abs(b - a) < 1e-12) return c;
    if (Math.sign(fc) === Math.sign(fb)) {
      b = c;
      fb = fc;
      if (side === -1) fa /= 2;
      side = -1;
    } else {
      a = c;
      fa = fc;
      if (side === 1) fb /= 2;
      side = 1;
    }
  }
  return (a + b) / 2;
}

export interface RdState {
  z: number;
  ang: RdAngles;
  pose: RdPose;
  /** pulley centres in bike space */
  up: T.Vector3;
  lp: T.Vector3;
  /** the chain path's taut length for this pose (units), and whether the cage made it the chain's length */
  len: number;
  taut: boolean;
}

export interface RdFitOpts {
  boltDist?: number;
  boltDir?: number;
  stretch?: number;
}

export class RdFit {
  readonly bolt: T.Vector3;
  /** chain length in links (even) */
  readonly links: number;
  /** extra cage length, units */
  readonly stretch: number;
  private circ: Circle[];
  private path = newPath();
  private bodyCache = new Map<number, number>();
  private tab: Array<{ b: number; g: number }> | null = null;
  private lastCage = RIG.src.cage;
  private lastLink = RIG.src.link;
  private tmpU = new T.Vector3();
  private tmpL = new T.Vector3();

  constructor(readonly B: BikeSpec, opt: RdFitOpts = {}) {
    const n = B.n;
    // The hanger sits on the dropout's outside (zDrop - 0.0055 .. + 0.0035); the upper body's inner
    // face (the source hanger's outer face) sits against it.
    const dz = B.zDrop + 0.0035 - RD_RIG.hangerZ[1];
    this.stretch = opt.stretch ?? cageStretch(B);
    let dist = opt.boltDist;
    if (dist === undefined) {
      const link = this.linkAt(B.zs[n - 1] - dz);
      const p = rdPose(RIG.B, { ...RIG.src, link });
      const P = RIG.P.clone().applyMatrix4(p.lower);
      const reach = Math.hypot(P.x - RIG.B.x, P.y - RIG.B.y) + Math.hypot(RIG.P.x - RIG.Up.x, RIG.P.y - RIG.Up.y) - 0.002;
      dist = Math.max(BOLT_MIN, B.rs[n - 1] + RP_RD + GAP_TOP - reach);
    }
    const dir = opt.boltDir ?? BOLT_DIR;
    this.bolt = new T.Vector3(B.rx + dist * Math.cos(dir), B.huby + dist * Math.sin(dir), RIG.B.z + dz);
    this.circ = [
      { x: 0, y: B.bby, z: B.chainline, r: B.rc, s: 1 },
      { x: B.rx, y: B.huby, z: B.zs[n - 1], r: B.rs[n - 1], s: 1 },
      { x: 0, y: 0, z: 0, r: RP_RD, s: -1 },
      { x: 0, y: 0, z: 0, r: RP_RD, s: 1 },
    ];
    // Chain length, by the usual rule: around the chainring and the largest sprocket (not through the
    // derailleur), plus two links (one inch), rounded up to whole link pairs.
    buildPath(this.circ.slice(0, 2).map((c) => ({ ...c })), this.path);
    const bigBig = chordLength(this.path, PITCH) / PITCH;
    this.links = 2 * Math.ceil((Math.ceil(bigBig - 1e-6) + 2) / 2);
  }

  /** The link angle that puts the source pose's upper pulley on z, in library space (for placing the bolt). */
  private linkAt(zLib: number): number {
    const f = (link: number) => RIG.Up.clone().applyMatrix4(rdPose(RIG.B, { ...RIG.src, link }).cage).z - zLib;
    const a = LINK_SWING.min;
    const b = LINK_SWING.max;
    const fa = f(a);
    const fb = f(b);
    return Math.sign(fa) === Math.sign(fb) ? (Math.abs(fa) < Math.abs(fb) ? a : b) : root(f, a, b, fa, fb, 1e-8);
  }

  pose(ang: RdAngles): RdPose {
    return rdPose(this.bolt, ang);
  }

  /** Pulley centres in bike space for a pose (the lower one moved out along the cage by the stretch). */
  pulleys(pose: RdPose, up = new T.Vector3(), lp = new T.Vector3()): [T.Vector3, T.Vector3] {
    up.copy(RIG.Up).applyMatrix4(pose.cage);
    lp.copy(RIG.Up).addScaledVector(CAGE_DIR, CAGE_LEN + this.stretch).applyMatrix4(pose.cage);
    return [up, lp];
  }

  /** Sprocket radius at z, between sprockets in proportion (as drivetrain.ts's rAt: the chain path while shifting). */
  rAt(z: number): number {
    const { zs, rs, n } = this.B;
    if (z >= zs[0]) return rs[0];
    if (z <= zs[n - 1]) return rs[n - 1];
    for (let i = 0; i < n - 1; i++) if (z <= zs[i] && z >= zs[i + 1]) return rs[i] + (rs[i + 1] - rs[i]) * ((zs[i] - z) / (zs[i] - zs[i + 1]));
    return rs[0];
  }

  /** The chain's circles for a pose (chainring, sprocket, upper and lower pulley), written into `c`. */
  circles(z: number, pose: RdPose, c: Circle[] = this.circ): Circle[] {
    const [up, lp] = this.pulleys(pose, this.tmpU, this.tmpL);
    c[1].z = z;
    c[1].r = this.rAt(z);
    c[2].x = up.x;
    c[2].y = up.y;
    c[2].z = up.z;
    c[3].x = lp.x;
    c[3].y = lp.y;
    c[3].z = lp.z;
    return c;
  }

  /** Taut chain length (units) with the derailleur in this pose and the chain on the sprocket at z. */
  lengthAt(z: number, pose: RdPose): number {
    buildPath(this.circles(z, pose), this.path);
    return chordLength(this.path, PITCH);
  }

  /** The link angle that puts the upper pulley's centre plane on z (clamped to the links' swing). */
  linkFor(z: number, body: number, cage: number): number {
    const f = (link: number) => this.tmpU.copy(RIG.Up).applyMatrix4(this.pose({ body, link, cage }).cage).z - z;
    // z falls as the link angle rises; bracket from the last solution
    const g = this.lastLink;
    const fg = f(g);
    if (Math.abs(fg) < 1e-9) return g;
    const step = 4 * DEG * (fg > 0 ? 1 : -1);
    let a = g;
    let fa = fg;
    for (let k = 0; k < 40; k++) {
      const b = Math.max(LINK_SWING.min, Math.min(LINK_SWING.max, a + step));
      const fb = f(b);
      if (Math.sign(fb) !== Math.sign(fa)) return (this.lastLink = root(f, a, b, fa, fb, 1e-9));
      if (b === LINK_SWING.min || b === LINK_SWING.max) return (this.lastLink = b);
      a = b;
      fa = fb;
    }
    return a;
  }

  /** The cage's stops, from the source angle: about 36 teeth of wrap for the source cage (see CAGE_PER_TOOTH). */
  static CAGE_STOP = { back: -55 * DEG, fwd: 60 * DEG };

  /**
   * The cage angle that makes the chain path exactly the chain's length. The path gets longer as the
   * cage turns back (lower angle), steadily from the back end of the swing until the pulleys pass the
   * point where the chain's wrap flips; there the length jumps. So the answer is the first crossing from
   * the back end where the length really reaches the chain's (not a jump). Without one, the chain is
   * slack (cage all the way back) or too short (the shortest path forward); `taut` is then false.
   */
  cageFor(z: number, body: number, link: number): { cage: number; taut: boolean } {
    const target = this.links * PITCH;
    const f = (cage: number) => this.lengthAt(z, this.pose({ body, link, cage })) - target;
    const lo = RIG.src.cage + RdFit.CAGE_STOP.back;
    const hi = RIG.src.cage + RdFit.CAGE_STOP.fwd;
    const TOL = 1e-7;
    const real = (c: number) => Math.abs(f(c)) < 1e-5;
    // from the last answer, if the crossing next to it is a real one on the steady part
    const g = Math.max(lo, Math.min(hi, this.lastCage));
    const fg = f(g);
    if (Math.abs(fg) < TOL) return { cage: g, taut: true };
    const step = 3 * DEG * (fg > 0 ? 1 : -1);
    const b = Math.max(lo, Math.min(hi, g + step));
    const fb = f(b);
    if (Math.sign(fb) !== Math.sign(fg) && (b - g) * (fb - fg) < 0) {
      const c = root(f, g, b, fg, fb, TOL);
      if (real(c)) return { cage: (this.lastCage = c), taut: true };
    }
    // scan from the back end
    const K = 42;
    let a = lo;
    let fa = f(lo);
    if (fa < 0) return { cage: (this.lastCage = lo), taut: false };
    let best = lo;
    let fBest = fa;
    for (let k = 1; k <= K; k++) {
      const c1 = lo + ((hi - lo) * k) / K;
      const f1 = f(c1);
      if (fa > 0 && f1 <= 0) {
        const c = root(f, a, c1, fa, f1, TOL);
        if (real(c)) return { cage: (this.lastCage = c), taut: true };
      }
      if (f1 < fBest && f1 > 0) {
        best = c1;
        fBest = f1;
      }
      a = c1;
      fa = f1;
    }
    return { cage: (this.lastCage = best), taut: false };
  }

  /** The pose for z with a body angle: link and cage solved together (the cage's tilt moves the pulley's plane a little). */
  solve(z: number, body: number): RdState {
    let cage = this.lastCage;
    let link = this.lastLink;
    let taut = false;
    for (let it = 0; it < 6; it++) {
      link = this.linkFor(z, body, cage);
      const c = this.cageFor(z, body, link);
      const done = Math.abs(c.cage - cage) < 1e-7;
      cage = c.cage;
      taut = c.taut;
      if (done) break;
    }
    const ang = { body, link, cage };
    const pose = this.pose(ang);
    const [up, lp] = this.pulleys(pose);
    return { z, ang, pose, up, lp, len: this.lengthAt(z, pose), taut };
  }

  /** The gap between the upper pulley and the sprocket at z (pitch circle to pitch circle). */
  gapOf(st: RdState): number {
    return Math.hypot(st.up.x - this.B.rx, st.up.y - this.B.huby) - this.rAt(st.z) - RP_RD;
  }

  /** The gap on the largest sprocket for a body angle. */
  gapAt(body: number): number {
    return this.gapOf(this.solve(this.B.zs[this.B.n - 1], body));
  }

  /**
   * The body angle (set by the B screw) for a gap on the largest sprocket. The B screw works on the
   * side of the widest gap where the body turns forward (higher angle): there, turning the body back
   * (screwing in) opens the gap. A gap beyond the widest gives the widest.
   */
  bodyFor(gap: number): number {
    const key = Math.round(gap * 1e6);
    const hit = this.bodyCache.get(key);
    if (hit !== undefined) return hit;
    const keep = { link: this.lastLink, cage: this.lastCage };
    if (!this.tab) {
      this.tab = [];
      for (let d = 70; d >= -70; d -= 7) {
        const b = RIG.src.body + d * DEG;
        this.tab.push({ b, g: this.gapAt(b) });
      }
    }
    const tab = this.tab;
    let top = 0;
    for (let i = 1; i < tab.length; i++) if (tab[i].g > tab[top].g) top = i;
    let body = tab[top].b;
    if (gap < tab[top].g) {
      // tab runs from forward (high angle) to back; on [0, top] the gap rises
      let i = top;
      while (i > 0 && tab[i - 1].g > gap) i--;
      if (i === 0) body = tab[0].b;
      else {
        const f = (b: number) => this.gapAt(b) - gap;
        body = root(f, tab[i - 1].b, tab[i].b, tab[i - 1].g - gap, tab[i].g - gap, 1e-7);
      }
    }
    this.lastLink = keep.link;
    this.lastCage = keep.cage;
    if (this.bodyCache.size > 512) this.bodyCache.clear();
    this.bodyCache.set(key, body);
    return body;
  }
}
