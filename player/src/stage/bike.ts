// The generated bike, ported from the prototype (toBike, buildBike, buildStand, updateDer).
// bikeSpec() turns the bike's facts into dimensions; BikeModel builds the meshes, one part per
// registry node, and moves the derailleur, the chain and the cranks.
//
// Units: 1 scene unit = 0.5 m. x points to the front wheel, y up, z to the drive side.
// The drivetrain is drawn about twice as wide (z) as on a real bike, so the sprockets read on a phone.

import * as T from 'three';
import { buildPath, newPath, pointAt, type Circle } from './chain.js';

export const TAU = Math.PI * 2;
export const HP = Math.PI / 2;
export const PITCH = 0.0254;
export const rOf = (teeth: number) => PITCH / (2 * Math.sin(Math.PI / teeth));
/** default rear axle position and tyre radius; a bike's own values are in its BikeSpec */
export const HUBY = 0.7;
export const RX = -0.9;
export const RT = 0.73;
export const LIFT = 0.3;
export const GROUND = -0.03;
/** gap between the upper pulley and the sprocket: right, too big, too small */
export const GAP_OK = 0.011;
export const GAP_BIG = 0.036;
export const GAP_SMALL = 0.004;
/** pulley radius (where the chain runs) and cage length */
export const RP = 0.04;
export const LC = 0.13;
/** default bottom bracket height (a city bike: 65 mm below the axles) */
export const BBY = HUBY - 0.13;
const DEG = Math.PI / 180;

type V2 = [number, number];
type V3 = [number, number, number];

export interface BikeSpec {
  kind: 'city' | 'road' | 'mountain';
  bar: 'drop' | 'riser' | 'flat';
  forkKind: 'susp' | 'rigid';
  gears: 'derailleur' | 'hub' | 'single' | 'gearbox';
  barrelAt: 'derailleur' | 'shifter';
  motor: boolean;
  kickstand: boolean;
  /** frame colour from bike.colour (#rrggbb), or null for the theme's part colour */
  colour: string | null;
  /** rear axle x and both axles' height, tyre radius, front axle x, bottom bracket height */
  rx: number;
  huby: number;
  rt: number;
  FX: number;
  bby: number;
  cassette: number[];
  chainring: number;
  tt: number;
  n: number;
  sp: number;
  zs: number[];
  rs: number[];
  rc: number;
  chainW: number;
  /** z of the chainring, and of the cassette's middle */
  chainline: number;
  /** z of the rear dropouts (±) and the derailleur hanger: just outside the smallest sprocket */
  zDrop: number;
  /** top of the seat tube, top and bottom of the head tube */
  ST: V2;
  HT: V2;
  HB: V2;
  saddleX: number;
  saddleY: number;
  /** handlebar clamp, right shifter, highest point of the bar (the bike rests on it upside down) */
  C: V2;
  S: V3;
  barTop: V2;
}

function cassetteFor(kind: BikeSpec['kind'], n: number): number[] {
  if (n <= 1) return [18];
  const last = kind === 'road' ? 28 : kind === 'city' ? (n <= 8 ? 28 : 34) : n >= 11 ? 51 : n >= 9 ? 42 : 34;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let t = Math.round(11 * Math.pow(last / 11, i / (n - 1)));
    if (i && t <= out[i - 1]) t = out[i - 1] + 1;
    out.push(t);
  }
  return out;
}

const known = (v: unknown) => v !== undefined && v !== null && v !== 'unknown' && v !== '';

/**
 * Plausible ranges for the geometry facts (mm and degrees), from published geometry tables of
 * road, gravel, city, trekking and mountain bikes. A value outside its range is ignored.
 */
export const GEOMETRY_RANGES: Record<string, [number, number]> = {
  stack_mm: [450, 720],
  reach_mm: [330, 520],
  head_tube_mm: [80, 260],
  head_angle_deg: [62, 76],
  seat_angle_deg: [68, 79],
  seat_tube_mm: [330, 640],
  chainstay_mm: [390, 520],
  bb_drop_mm: [0, 90],
};
const WHEELS = [559, 584, 622];

/** The geometry facts that are known and plausible, in mm and degrees. */
export function geometryOf(facts: Record<string, unknown>): Partial<Record<keyof typeof GEOMETRY_RANGES | 'wheel_bsd_mm', number>> {
  const g: Record<string, number> = {};
  for (const [k, [lo, hi]] of Object.entries(GEOMETRY_RANGES)) {
    const v = facts[`geometry.${k}`];
    if (!known(v)) continue;
    const x = Number(v);
    if (Number.isFinite(x) && x >= lo && x <= hi) g[k] = x;
  }
  const w = Number(facts['geometry.wheel_bsd_mm']);
  if (WHEELS.includes(w)) g.wheel_bsd_mm = w;
  return g;
}

/**
 * Dimensions from the bike's facts. Unknown facts give a generic city bike with a rear
 * derailleur and 8 sprockets, the most common case in the target market.
 *
 * Rules (facts -> drawing):
 * - bike.category: road_gravel -> road frame; mtb -> mountain frame with a suspension fork;
 *   anything else -> city frame with a kickstand. Cargo bikes are drawn as city bikes.
 * - bike.handlebar (drop, flat, riser) picks the bar; unknown -> drop on road bikes, riser on
 *   mountain bikes, flat otherwise.
 * - A drop bar has combined brake and shift levers, which have no barrel adjuster: the barrel
 *   adjuster is drawn at the derailleur. Flat and riser bars have a trigger shifter with the
 *   barrel adjuster on it.
 * - drive.gear_type: hub_gear, gearbox, single_speed -> one sprocket; else a rear derailleur.
 *   drive.rear_speeds (5..13) sets the number of sprockets; unknown -> 8.
 * - bike.ebike -> motor and down-tube battery. bike.colour (#rrggbb) -> frame colour.
 * - Bottom bracket height: 70 mm below the axles on road bikes, 65 mm on city bikes, 45 mm on
 *   mountain bikes, unless geometry.bb_drop_mm is known.
 * - geometry.*: stack and reach place the head tube, with the head angle and head tube length;
 *   the seat angle and seat tube length place the seat tube; chainstay and bottom bracket drop
 *   place the rear axle; the wheel size sets the wheel. A missing or implausible value keeps
 *   the default drawing for that part. The front wheel moves forward if it would touch the frame.
 */
export function bikeSpec(facts: Record<string, unknown>): BikeSpec {
  const cat = facts['bike.category'];
  const kind: BikeSpec['kind'] = cat === 'road_gravel' ? 'road' : cat === 'mtb' ? 'mountain' : 'city';
  const road = kind === 'road';
  const mtb = kind === 'mountain';
  const gt = facts['drive.gear_type'];
  const gears: BikeSpec['gears'] = gt === 'hub_gear' ? 'hub' : gt === 'single_speed' ? 'single' : gt === 'gearbox' ? 'gearbox' : 'derailleur';
  const speedsFact = Number(facts['drive.rear_speeds']);
  const speeds = gears !== 'derailleur' ? 1 : known(facts['drive.rear_speeds']) && speedsFact >= 5 && speedsFact <= 13 ? Math.round(speedsFact) : 8;
  const ebike = facts['bike.ebike'];
  const hb = facts['bike.handlebar'];
  const bar: BikeSpec['bar'] = hb === 'drop' || hb === 'flat' || hb === 'riser' ? hb : road ? 'drop' : mtb ? 'riser' : 'flat';
  const colourFact = facts['bike.colour'];
  const colour = typeof colourFact === 'string' && /^#[0-9a-f]{6}$/i.test(colourFact) ? colourFact.toLowerCase() : null;
  const cassette = cassetteFor(kind, speeds);
  const n = cassette.length;
  // Sprocket spacing 1.25 times the real one (so the sprockets still read on a phone), on a
  // realistic chain line: the cassette's middle lines up with the chainring.
  const realMm = n <= 7 ? 5 : n === 8 ? 4.8 : n === 9 ? 4.35 : n === 10 ? 3.95 : n === 11 ? 3.74 : n === 12 ? 3.5 : 3.3;
  const sp = n > 1 ? (realMm * 1.25) / 500 : 0.03;
  const chainline = road ? 0.1 : mtb ? 0.115 : 0.105;
  const zs = cassette.map((_, i) => (n > 1 ? chainline + ((n - 1) / 2 - i) * sp : chainline));
  const tt = road ? 0.028 : mtb ? 0.07 : 0.045;

  // ---- geometry: defaults, replaced by the bike's own values where known
  const g = geometryOf(facts);
  const u = (mm: number) => mm / 500;
  const rt = g.wheel_bsd_mm ? u(g.wheel_bsd_mm / 2) + 2 * tt : RT;
  const huby = GROUND + rt;
  const bby = huby - (g.bb_drop_mm !== undefined ? u(g.bb_drop_mm) : road ? 0.14 : mtb ? 0.09 : 0.13);
  const ha = (g.head_angle_deg ?? 72) * DEG;
  const hl = g.head_tube_mm !== undefined ? u(g.head_tube_mm) : road ? 0.15 : 0.22;
  const frameFacts = g.stack_mm !== undefined || g.reach_mm !== undefined;
  // Front end: the fork follows the steering axis and is long enough for the wheel. Without
  // stack and reach, the head tube stays where the prototype drew it (the down tube then clears
  // the tyre); road bikes get a shorter head tube, so their bars sit lower.
  let HB: V2 = [1.05, 1.56];
  let HT: V2 = [HB[0] - hl * Math.cos(ha), HB[1] + hl * Math.sin(ha)];
  if (frameFacts) {
    const stack = g.stack_mm !== undefined ? u(g.stack_mm) : HT[1] - bby;
    const reach = g.reach_mm !== undefined ? u(g.reach_mm) : HT[0];
    HT = [reach, bby + stack];
    HB = [HT[0] + hl * Math.cos(ha), HT[1] - hl * Math.sin(ha)];
  }
  // fork offset (45 mm) only for a bike drawn from its geometry, so the default look stays
  const offset = Object.keys(g).length ? u(45) : 0;
  let FX = HB[0] + (HB[1] - huby) / Math.tan(ha) + offset / Math.sin(ha);
  // Keep the tyre clear of the down tube, the battery and the fork crown (the clearance test
  // checks the same): with an unusual geometry the front wheel moves forward.
  const dtPts: Array<[V2, V2]> = [[[0, bby], HB], [[HB[0] - 0.12, HB[1] - 0.06], [0.12, bby + 0.15]]];
  const hl0 = Math.hypot(HT[0] - HB[0], HT[1] - HB[1]) || 1;
  const crown: V2 = [HB[0] - ((HT[0] - HB[0]) / hl0) * 0.04, HB[1] - ((HT[1] - HB[1]) / hl0) * 0.04];
  const tight = () => dtPts.some(([a, b]) => distSeg([FX, huby], a, b) - 0.05 < rt + 0.015) || Math.hypot(FX - crown[0], huby - crown[1]) - 0.022 < rt + 0.015;
  for (let i = 0; i < 60 && tight(); i++) FX += 0.01;
  // Rear: chainstay length sets the rear axle.
  let rx = g.chainstay_mm !== undefined ? -Math.sqrt(Math.max(0.6, u(g.chainstay_mm) ** 2 - (huby - bby) ** 2)) : RX;
  // Seat tube: from the bottom bracket along the seat angle, ending 0.1 unit below the top tube.
  let ST: V2 = road ? [-0.2, 1.5] : [-0.22, 1.5];
  if (frameFacts || g.seat_angle_deg !== undefined || g.seat_tube_mm !== undefined) {
    const sa = (g.seat_angle_deg ?? 73) * DEG;
    const len = g.seat_tube_mm !== undefined ? u(g.seat_tube_mm) : (Math.min(HT[1] - 0.2, 1.5 + (HT[1] - 1.7)) - bby) / Math.sin(sa);
    ST = [-len * Math.cos(sa), bby + len * Math.sin(sa)];
  }
  // The rear wheel moves back if it would touch the seat tube (short chainstays, slack seat angle).
  for (let i = 0; i < 40 && distSeg([rx, huby], [0, bby], ST) - 0.034 < rt + 0.015; i++) rx -= 0.01;
  // Seat post continues the seat tube; the saddle sits 0.06 behind the top of the post.
  const saddleY = ST[1] + (road ? 0.3 : 0.26);
  const sdx = ST[0] / Math.max(0.1, ST[1] - bby);
  const saddleX = ST[0] + sdx * (saddleY - 0.04 - ST[1]) - 0.06;

  const [hx, hy] = HT;
  const C: V2 = [hx + 0.14, hy + 0.03];
  // right shifter: the hood of a drop bar, or the trigger pod under a flat or riser bar
  const grip = gripOf(bar, HT);
  const S: V3 = bar === 'drop' ? [C[0] + 0.165, C[1] + 0.012, 0.21] : [grip[0], grip[1] - 0.04, 0.255];
  const barTop: V2 = bar === 'drop' ? [C[0] + 0.19, C[1] + 0.058] : [grip[0], grip[1] + 0.02];
  const chainW = Math.min(0.013, sp * 1.1);
  return {
    kind, bar, gears, colour,
    forkKind: mtb ? 'susp' : 'rigid',
    barrelAt: bar === 'drop' ? 'derailleur' : 'shifter',
    motor: ebike === true || ebike === 'true',
    kickstand: kind === 'city',
    rx, huby, rt, FX, bby,
    cassette,
    chainring: road ? 50 : mtb ? 32 : 44,
    tt,
    n, sp, zs,
    rs: cassette.map(rOf),
    rc: rOf(road ? 50 : mtb ? 32 : 44),
    chainW,
    chainline,
    zDrop: zs[0] + sp * 0.25 + 0.022,
    ST, HT, HB,
    saddleX, saddleY,
    C, S, barTop,
  };
}

/** Where the grip starts on a flat or riser bar (x, y); the grip runs from z 0.3 to 0.4. */
function gripOf(bar: BikeSpec['bar'], HT: V2): V2 {
  const [hx, hy] = HT;
  return bar === 'riser' ? [hx - 0.04, hy + 0.16] : [hx - 0.04, hy + 0.12];
}

/** Distance from point p to segment ab, in the side plane. */
export function distSeg(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** The battery on the down tube of an e-bike, as a segment (radius 0.05). */
export function batteryLine(B: BikeSpec): [V2, V2] {
  return [[B.HB[0] - 0.12, B.HB[1] - 0.06], [0.12, B.bby + 0.15]];
}

/**
 * A rear stay's centre line on one side (sd = 1 drive side, -1 the other), as points for a tube.
 * Chainstays run straight from the bottom bracket inside the chainring, bend out once just behind
 * it (clearing the tyre), then run straight to the dropout. Seat stays run straight. Both meet
 * the dropout square, for the last 0.09 units, so they stay outside the sprockets.
 */
export function stayPts(B: BikeSpec, which: 'chain' | 'seat', sd: 1 | -1): V3[] {
  const { rx, huby, bby, zDrop } = B;
  const D: V3 = [rx, huby, sd * zDrop];
  const lerp = (p: V3, q: V3, t: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  // the point 0.09 from the axle towards `from`, at the dropout's z
  const end = (from: V3): V3 => {
    const d = Math.hypot(from[0] - rx, from[1] - huby) || 1;
    return [rx + ((from[0] - rx) / d) * 0.09, huby + ((from[1] - huby) / d) * 0.09, sd * zDrop];
  };
  if (which === 'seat') {
    const sy = B.ST[1] - (B.kind === 'road' ? 0.05 : 0);
    const A: V3 = [B.ST[0], sy, sd * 0.05];
    const E = end(A);
    return [A, lerp(A, E, 0.85), E, D];
  }
  const kx = -(B.rc + 0.045);
  const ky = bby + (huby - bby) * (kx / rx);
  const zk = Math.max(0.07, B.tt + 0.024);
  const A: V3 = [0, bby, sd * 0.065];
  const K: V3 = [kx, ky, sd * zk];
  const E = end(K);
  return [A, lerp(A, K, 0.8), K, lerp(K, E, 0.15), lerp(K, E, 0.85), E, D];
}

/** z of a chainstay at x (between the bottom bracket and the axle), on one side. */
function stayZ(B: BikeSpec, x: number, sd: 1 | -1): number {
  const p = stayPts(B, 'chain', sd);
  for (let i = 1; i < p.length; i++) {
    if (x >= p[i][0]) return p[i - 1][2] + (p[i][2] - p[i - 1][2]) * ((x - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1));
  }
  return p[p.length - 1][2];
}

// ------------------------------------------------------------------ derailleur layout

/*
 * The rear derailleur is built like a real one. Its body (B-knuckle) turns about the hanger bolt,
 * below and behind the axle, outside the smallest sprocket, and points backwards. Two parallel
 * link plates (the parallelogram) swing from the body inwards towards the spokes; their far end
 * (the P-knuckle) carries the cage pivot, and the cage hangs from it with the two pulleys.
 *
 * For a derailleur position z and a gap, derPose() finds the link swing (from z), the cage angle
 * (rotating back a little on the small sprockets) and the body's turn about the bolt that brings
 * the upper pulley to the gap below the sprocket. The body only turns within a range, as on a real
 * derailleur: on the small sprockets of a wide-range cassette the gap then opens up. No part
 * stretches; nothing but the chain and the pulleys comes near the sprockets (stage.test.ts).
 */

/** inner link this far inside the outer one; outer link's free end this far outside the chain */
const EZ = 0.022;
const POFF = 0.05;
/** link pins to the cage pivot, and cage pivot to the upper pulley */
const PIN = 0.018;
const CO = 0.045;
/** body angle on the largest sprocket, how far it turns, and the cage angle on the smallest and largest */
const BETA_L = -135 * DEG;
const BETA_RANGE = 45 * DEG;
const CAGE_S = -35 * DEG;
const CAGE_L = -55 * DEG;

export interface DerGeom {
  /** z of the hanger, and of the outer link's pin on the body (the inner one is EZ further in) */
  zH: number;
  zB: number;
  /** link length; body length from the bolt to the link pins */
  L: number;
  eb: number;
  /** hanger bolt (x, y) */
  Hb: V2;
}

export function derGeom(B: BikeSpec): DerGeom {
  const { zs, rs, n, rx, huby } = B;
  const zH = B.zDrop;
  const zB = zH + 0.03;
  const span = zs[0] - zs[n - 1];
  const L = Math.max(0.09, span / Math.sin(60 * DEG));
  const Hb: V2 = [rx - 0.012, huby - 0.052];
  // body length: on the largest sprocket, with the body at BETA_L and the cage at CAGE_L, the
  // upper pulley sits at the right gap
  const DL = rs[n - 1] + GAP_OK + RP;
  const w: V2 = [Hb[0] - rx + CO * Math.cos(CAGE_L), Hb[1] - huby + CO * Math.sin(CAGE_L)];
  const bw = w[0] * Math.cos(BETA_L) + w[1] * Math.sin(BETA_L);
  const rho = -bw + Math.sqrt(Math.max(0, bw * bw - (w[0] ** 2 + w[1] ** 2 - DL * DL)));
  const phiL = Math.asin(Math.max(-1, Math.min(1, (zB - (zs[n - 1] + POFF)) / L)));
  const eb = Math.max(0.02, rho - L * Math.cos(phiL) - PIN);
  return { zH, zB, L, eb, Hb };
}

export interface DerPose {
  /** body angle (bolt -> cage pivot), link swing, cage angle (pivot -> upper pulley), all in rad */
  beta: number;
  phi: number;
  cage: number;
  /** cage pivot and upper pulley (x, y) */
  Cv: V2;
  U: V2;
}

const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Where the derailleur's parts are for a position z, a gap and the sprocket radius r there. */
export function derPose(B: BikeSpec, G: DerGeom, z: number, gap: number, r: number): DerPose {
  const s = Math.max(-0.95, Math.min(0.99, (G.zB - (z + POFF)) / G.L));
  const phi = Math.asin(s);
  const rho = G.eb + G.L * Math.cos(phi) + PIN;
  const t = (r - B.rs[0]) / (B.rs[B.n - 1] - B.rs[0] || 1);
  const cage = CAGE_S + (CAGE_L - CAGE_S) * Math.max(0, Math.min(1, t));
  const w: V2 = [G.Hb[0] - B.rx + CO * Math.cos(cage), G.Hb[1] - B.huby + CO * Math.sin(cage)];
  const lw = Math.hypot(w[0], w[1]);
  const need = r + gap + RP;
  const dAt = (b: number) => Math.hypot(w[0] + rho * Math.cos(b), w[1] + rho * Math.sin(b));
  const inRange = (b: number) => Math.abs(angDiff(b, BETA_L)) <= BETA_RANGE + 1e-9;
  // exact solutions of |w + rho dir(b)| = need inside the range: take the one nearest BETA_L
  const c = (need * need - rho * rho - lw * lw) / (2 * rho * lw);
  let beta: number | null = null;
  if (Math.abs(c) <= 1) {
    const aw = Math.atan2(w[1], w[0]);
    const sols = [aw + Math.acos(c), aw - Math.acos(c)].filter(inRange);
    if (sols.length) beta = sols.sort((p, q) => Math.abs(angDiff(p, BETA_L)) - Math.abs(angDiff(q, BETA_L)))[0];
  }
  if (beta === null) {
    // can't reach the gap: the end of the range (or the turning point inside it) that keeps the
    // pulley clear and nearest
    const cands = [BETA_L - BETA_RANGE, BETA_L + BETA_RANGE, Math.atan2(w[1], w[0]) + Math.PI, Math.atan2(w[1], w[0])].filter(inRange);
    const clear = cands.filter((b) => dAt(b) >= need);
    beta = clear.length ? clear.sort((p, q) => dAt(p) - dAt(q))[0] : cands.sort((p, q) => dAt(q) - dAt(p))[0];
  }
  const Cv: V2 = [G.Hb[0] + rho * Math.cos(beta), G.Hb[1] + rho * Math.sin(beta)];
  return { beta, phi, cage, Cv, U: [Cv[0] + CO * Math.cos(cage), Cv[1] + CO * Math.sin(cage)] };
}

/** A turnable part: screws and the barrel adjuster. `pos` and `axis` are in its parent's frame; `axis` points from the head into the thread. */
export interface Turn {
  pos: V3;
  axis: V3;
  len: number;
}

/** The derailleur barrel adjuster (or cable stop) on the body, in the body's frame (origin at the bolt, body along -x). */
function bodyBarrel(G: DerGeom): Turn {
  const ax: V3 = [0.55, -0.835, 0];
  return { pos: [-G.eb + 0.006, 0.034, (G.zH + G.zB) / 2 + 0.002], axis: ax, len: 0.034 };
}

/** Body frame -> bike space, for a body angle beta. */
function bodyToBike(G: DerGeom, beta: number, p: V3): V3 {
  const th = beta + Math.PI;
  return [G.Hb[0] + p[0] * Math.cos(th) - p[1] * Math.sin(th), G.Hb[1] + p[0] * Math.sin(th) + p[1] * Math.cos(th), p[2]];
}

/**
 * Where the barrel adjuster is on this bike, in bike space (on the derailleur: with the chain on
 * the middle sprocket). `axis` points from its head into the thread.
 */
export function barrelTurn(B: BikeSpec): Turn {
  if (B.barrelAt === 'derailleur') {
    const G = derGeom(B);
    const mid = Math.floor(B.n / 2);
    const P = derPose(B, G, B.zs[mid], GAP_OK, B.rs[mid]);
    const t = bodyBarrel(G);
    const th = P.beta + Math.PI;
    return { pos: bodyToBike(G, P.beta, t.pos), axis: [t.axis[0] * Math.cos(th) - t.axis[1] * Math.sin(th), t.axis[0] * Math.sin(th) + t.axis[1] * Math.cos(th), 0], len: t.len };
  }
  // on the trigger pod's inner end, pointing in and forward where the cable leaves
  const ax: V3 = [0.45, 0, -0.89];
  const tip: V3 = [B.S[0] + 0.012, B.S[1] + 0.004, B.S[2] - 0.0225];
  return { pos: [tip[0] + ax[0] * 0.019, tip[1], tip[2] + ax[2] * 0.019], axis: [-ax[0], 0, -ax[2]], len: 0.038 };
}

/** The upper pulley's position (x, y) for a derailleur position z and a gap. */
export function upperPulley(B: BikeSpec, z: number, gap = GAP_OK): V2 {
  const G = derGeom(B);
  const r = rAt(B, z);
  return derPose(B, G, z, gap, r).U;
}

/** Sprocket radius at a z between the sprockets. */
export function rAt(B: BikeSpec, z: number): number {
  const { zs, rs, n } = B;
  if (z >= zs[0]) return rs[0];
  if (z <= zs[n - 1]) return rs[n - 1];
  for (let i = 0; i < n - 1; i++) {
    if (z <= zs[i] && z >= zs[i + 1]) return rs[i] + (rs[i + 1] - rs[i]) * ((zs[i] - z) / (zs[i] - zs[i + 1]));
  }
  return rs[0];
}

// ------------------------------------------------------------------ parts

export interface Part {
  id: string;
  group: T.Group;
  mats: T.MeshStandardMaterial[];
  /** groups of related parts that stay visible when one of them is in focus */
  ctx: string[];
  /** current and target visibility (0.1 faded .. 1) and highlight (0..1) */
  vis: number;
  visT: number;
  hot: number;
  hotT: number;
  /** extra opacity from a remove or insert motion */
  fade: number;
  /** where the group sits in its parent, and the centre of its meshes there */
  basePos: T.Vector3;
  center: T.Vector3;
}

/** Context groups: focus on one part keeps the others of its group visible. */
const CTX: Record<string, string[]> = {
  frame: ['frame'],
  fork: ['front', 'frame'],
  front_wheel: ['front'],
  rear_wheel: ['drive', 'rear'],
  saddle: ['seat'],
  seat_post: ['seat'],
  handlebar: ['cockpit', 'cable', 'front'],
  brake_lever: ['cockpit'],
  kickstand: ['rear'],
  stand_clamp: ['seat'],
  motor: ['frame'],
  chainring: ['drive'],
  crank: ['drive'],
  chain: ['drive'],
  cassette: ['drive', 'rear'],
  smallest_sprocket: ['drive', 'rear'],
  largest_sprocket: ['drive', 'rear'],
  rear_derailleur: ['drive', 'rear'],
  upper_pulley: ['drive', 'rear'],
  derailleur_hanger: ['drive', 'rear'],
  h_screw: ['drive', 'rear'],
  l_screw: ['drive', 'rear'],
  b_screw: ['drive', 'rear'],
  barrel_adjuster: ['cable'],
  shift_cable: ['cable'],
  shifter_rear: ['cable', 'cockpit'],
};

interface MatOpt {
  k?: number;
  dark?: boolean;
  tint?: string;
  flat?: boolean;
  parent?: T.Object3D;
}

const UP = new T.Vector3(0, 1, 0);

function tubeGeo(a: V3, b: V3, r: number): T.BufferGeometry {
  const A = new T.Vector3(...a);
  const B = new T.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new T.CylinderGeometry(r, r, len, 10);
  g.translate(0, len / 2, 0);
  g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(UP, B.clone().sub(A).normalize())));
  g.translate(A.x, A.y, A.z);
  return g;
}

function curveGeo(pts: V3[], r: number, seg = 48): T.BufferGeometry {
  return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), seg, r, 8, false);
}

/** A toothed wheel in the xy plane, centred on z = 0: chainring and pulleys. */
function gearGeo(r: number, teeth: number, thick: number, depth = 0.006): T.BufferGeometry {
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
function slabGeo(s: T.Shape, z0: number, z1: number, bevel = 0.003): T.BufferGeometry {
  const b = Math.min(bevel, (z1 - z0) / 2.2);
  const g = new T.ExtrudeGeometry(s, { depth: Math.max(1e-4, z1 - z0 - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.9, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, z0 + b);
  return g;
}

/** Outline around circles [x, y, r]: their convex hull, as a shape (cage plates, hanger). */
function hullShape(circles: Array<[number, number, number]>): T.Shape {
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
function capsuleShape(x0: number, x1: number, w0: number, w1: number): T.Shape {
  return hullShape([[x0, 0, w0], [x1, 0, w1]]);
}

/** A flat plate from a polygon in the xy plane, centred on z. */
function polyGeo(pts: V2[], z: number, thick: number): T.BufferGeometry {
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
function plate(mesh: T.Object3D, a: V3, b: V3, normal: V3): void {
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

/** One generated bike, with the work stand and the hook it can be held by. */
export class BikeModel {
  /** the bike itself, in bike space */
  readonly bike = new T.Group();
  /** work stand and hook, in world space */
  readonly standG = new T.Group();
  readonly hookG = new T.Group();
  readonly parts = new Map<string, Part>();
  /** where each node's tag is anchored */
  readonly anchors = new Map<string, T.Object3D>();
  /** screws and the barrel adjuster: where they are (in their parent), which way they turn, and the group that turns */
  readonly turns = new Map<string, Turn & { spin: T.Object3D }>();
  readonly crankset = new T.Group();
  readonly rearHub = new T.Group();
  readonly frontHub = new T.Group();
  cage: T.Group | null = null;
  /** the rope of the hook, a unit-height mesh placed each frame */
  rope!: T.Mesh;
  /** the derailleur's current z and gap, the chain's travel along its path */
  derZ: number;
  gap = GAP_OK;
  chainShift = 0;

  private der: {
    G: DerGeom;
    body: T.Group;
    links: T.Mesh[];
    pk: T.Group;
    wire: T.Mesh | null;
    housing: T.Mesh | null;
    housingFrom: V3;
  } | null = null;
  private chainMesh!: T.InstancedMesh;
  private circ: Circle[] = [];
  private path = newPath();
  private N = 0;
  private decal: { cv: HTMLCanvasElement; tex: T.CanvasTexture; mat: T.MeshBasicMaterial; key: string } | null = null;
  private Q = new T.Object3D();
  private pt = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };

  constructor(readonly spec: BikeSpec, readonly standMat: T.Material) {
    this.derZ = spec.zs[Math.floor(spec.n / 2)];
    this.build();
    this.buildStand();
    this.buildHook();
    this.setDer(this.derZ, this.gap);
    this.bike.updateMatrixWorld(true);
    this.standG.updateMatrixWorld(true);
    for (const p of this.parts.values()) {
      // A part whose meshes live elsewhere (the upper pulley sits in the cage) has an empty box;
      // it has its own anchor and is never moved by a generic motion.
      const box = new T.Box3().setFromObject(p.group);
      const c = box.isEmpty() ? new T.Vector3() : box.getCenter(new T.Vector3());
      p.center.copy(p.group.parent ? p.group.parent.worldToLocal(c) : c);
      if (!this.anchors.has(p.id)) {
        const a = new T.Object3D();
        a.position.copy(p.center);
        (p.group.parent ?? this.bike).add(a);
        this.anchors.set(p.id, a);
      }
    }
  }

  dispose(): void {
    disposeTree(this.bike);
    disposeTree(this.standG, this.standMat);
    disposeTree(this.hookG, this.standMat);
    if (this.decal) this.decal.tex.dispose();
  }

  /** The part ids that exist on this bike. */
  has(part: string): boolean {
    return this.parts.has(part);
  }

  /** The chain as laid out now: points along its path, in bike space. */
  chainPoints(): Array<[number, number, number]> {
    const p = this.path;
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < p.n; i++) out.push([p.x[i], p.y[i], p.z[i]]);
    return out;
  }

  private part(id: string, parent: T.Object3D = this.bike, pos?: V3): Part {
    const g = new T.Group();
    if (pos) g.position.set(...pos);
    parent.add(g);
    const p: Part = { id, group: g, mats: [], ctx: CTX[id] ?? [], vis: 1, visT: 1, hot: 0, hotT: 0, fade: 1, basePos: g.position.clone(), center: new T.Vector3() };
    this.parts.set(id, p);
    return p;
  }

  private add(id: string, geo: T.BufferGeometry, pos?: V3 | null, rot?: V3 | null, opt: MatOpt = {}): T.Mesh {
    const m = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.15, transparent: true, flatShading: !!opt.flat });
    m.userData.k = opt.k ?? 1;
    m.userData.dark = !!opt.dark;
    m.userData.tint = opt.tint ?? null;
    const mesh = new T.Mesh(geo, m);
    mesh.userData.partId = id;
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    (opt.parent ?? this.parts.get(id)!.group).add(mesh);
    this.parts.get(id)!.mats.push(m);
    return mesh;
  }

  private anchor(node: string, parent: T.Object3D, at: V3): void {
    const o = new T.Object3D();
    o.position.set(...at);
    parent.add(o);
    this.anchors.set(node, o);
  }

  /**
   * A part that turns about its own axis (a screw, the barrel adjuster). Its meshes are built
   * along local y, head at -y, inside a group that spins about y; `spin.rotation.y > 0` turns it
   * clockwise as seen from the head (screwing in).
   */
  private turnable(id: string, t: Turn, parent: T.Object3D = this.bike): T.Object3D {
    const p = this.part(id, parent, t.pos);
    const orient = new T.Group();
    orient.quaternion.setFromUnitVectors(UP, new T.Vector3(...t.axis).normalize());
    const spin = new T.Group();
    orient.add(spin);
    p.group.add(orient);
    this.turns.set(id, { ...t, spin });
    this.anchors.set(id, p.group);
    return spin;
  }

  private screw(id: string, at: V3, axis: V3, parent: T.Object3D): void {
    const spin = this.turnable(id, { pos: at, axis, len: 0.026 }, parent);
    this.add(id, new T.CylinderGeometry(0.0075, 0.0075, 0.026, 10), null, null, { parent: spin, k: 1.15 });
    this.add(id, new T.CylinderGeometry(0.012, 0.012, 0.007, 14), [0, -0.015, 0], null, { parent: spin, k: 1.2 });
    this.add(id, new T.BoxGeometry(0.018, 0.004, 0.0035), [0, -0.0185, 0], null, { parent: spin, dark: true });
  }

  // ---------------------------------------------------------------- build

  private build(): void {
    const B = this.spec;
    const road = B.kind === 'road';
    const { ST, HT, HB, C, S, rx, huby, bby, zDrop: zD, chainline: zc } = B;
    const [hx, hy] = HT;
    const FX = B.FX;

    // Wheels: built around their hubs so they can turn.
    const wheel = (id: string, hub: T.Group, cx: number) => {
      hub.position.set(cx, huby, 0);
      this.bike.add(hub);
      this.part(id, hub);
      const rm = B.rt - B.tt;
      const rim = B.rt - 2 * B.tt - 0.012;
      this.add(id, new T.TorusGeometry(rm, B.tt, 12, 56), null, null, { k: 0.45 });
      this.add(id, new T.TorusGeometry(rim, 0.02, 8, 56), null, null, { k: 1, tint: 'rims' });
      const rear = id === 'rear_wheel';
      // axle from dropout to dropout, and the hub shell between the spoke flanges (inside the sprockets)
      const za = rear ? zD + 0.02 : 0.1;
      this.add(id, new T.CylinderGeometry(0.011, 0.011, 2 * za, 10), null, [HP, 0, 0], { k: 1.2 });
      const s1 = rear ? B.zs[B.n - 1] - 0.012 : 0.05;
      this.add(id, new T.CylinderGeometry(0.026, 0.026, s1 + 0.05, 16), [0, 0, (s1 - 0.05) / 2], [HP, 0, 0], { k: 0.9 });
      for (const fz of [0.03, -0.03]) this.add(id, new T.CylinderGeometry(0.034, 0.034, 0.006, 16), [0, 0, fz], [HP, 0, 0], { k: 0.9 });
      if (rear && B.gears === 'hub') this.add(id, new T.CylinderGeometry(0.075, 0.075, 0.13, 20), null, [HP, 0, 0], { k: 0.8 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        this.add(id, tubeGeo([0, 0, i % 2 ? 0.03 : -0.03], [(rim - 0.01) * Math.cos(a), (rim - 0.01) * Math.sin(a), 0], 0.004), null, null, { k: 1.2 });
      }
      this.anchor(id, this.bike, [cx, huby + B.rt * 0.72, 0.05]);
    };
    wheel('rear_wheel', this.rearHub, rx);
    wheel('front_wheel', this.frontHub, FX);

    // Frame
    this.part('frame');
    const ft = (a: V3, b: V3, r: number) => this.add('frame', tubeGeo(a, b, r), null, null, { tint: 'frame' });
    const fr = B.kind === 'mountain' ? 0.03 : road ? 0.02 : 0.024;
    const dtR = fr + 0.004;
    ft([0, bby, 0], [ST[0], ST[1], 0], fr + (road ? 0.004 : 0));
    ft([ST[0], ST[1], 0], [HT[0], HT[1], 0], fr - 0.002);
    ft([HT[0], HT[1], 0], [HB[0], HB[1], 0], 0.03);
    ft([0, bby, 0], [HB[0], HB[1], 0], fr + 0.004);
    // rear triangle on both sides; the dropouts sit just outside the sprockets
    for (const sd of [1, -1] as const) {
      this.add('frame', curveGeo(stayPts(B, 'chain', sd), 0.016, 48), null, null, { tint: 'frame' });
      this.add('frame', curveGeo(stayPts(B, 'seat', sd), 0.012, 40), null, null, { tint: 'frame' });
      // dropout plate; on the drive side the hanger sits on its outside
      const dz = sd > 0 ? zD - 0.0095 : -zD;
      this.add('frame', slabGeo(hullShape([[rx, huby, 0.03], [rx + 0.045, huby - 0.012, 0.02], [rx + 0.02, huby + 0.04, 0.018]]), dz - 0.004, dz + 0.004, 0.002), null, null, { tint: 'frame' });
    }
    this.add('frame', new T.CylinderGeometry(0.045, 0.045, 0.15, 18), [0, bby, 0], [HP, 0, 0], { tint: 'frame' });
    this.makeDecal([0, bby], HB, dtR);
    this.anchor('frame', this.bike, [HB[0] / 2, (bby + HB[1]) / 2, 0.03]);

    if (B.motor) {
      this.part('motor');
      const [b0, b1] = batteryLine(B);
      this.add('motor', new T.BoxGeometry(0.2, 0.2, 0.2), [0.0, bby + 0.01, 0], null, { k: 0.6 });
      this.add('motor', tubeGeo([b0[0], b0[1], 0], [b1[0], b1[1], 0], 0.05), null, null, { k: 0.55 });
    }

    // Seat post along the seat tube, and the saddle
    this.part('seat_post');
    const postTop: V3 = [B.saddleX + 0.06, B.saddleY - 0.04, 0];
    this.add('seat_post', tubeGeo([ST[0], ST[1], 0], postTop, 0.015), null, null, { k: 1.1 });
    this.part('saddle');
    this.add('saddle', new T.BoxGeometry(0.34, 0.05, 0.12), [B.saddleX, B.saddleY, 0], null, { k: 0.5 });
    this.add('saddle', new T.BoxGeometry(0.14, 0.035, 0.06), [B.saddleX + 0.22, B.saddleY - 0.005, 0], null, { k: 0.5 });
    this.anchor('saddle', this.bike, [B.saddleX, B.saddleY + 0.04, 0]);

    // Fork
    this.part('fork');
    {
      const dl = Math.hypot(hx - HB[0], hy - HB[1]);
      const Cr: V2 = [HB[0] - ((hx - HB[0]) / dl) * 0.04, HB[1] - ((hy - HB[1]) / dl) * 0.04];
      if (B.forkKind === 'susp') {
        const fz = 0.095;
        const M: V2 = [FX + (Cr[0] - FX) * 0.5, huby + (Cr[1] - huby) * 0.5];
        for (const sd of [1, -1]) {
          this.add('fork', tubeGeo([FX, huby, sd * fz], [M[0], M[1], sd * fz], 0.024), null, null, { k: 0.9 });
          this.add('fork', tubeGeo([M[0], M[1], sd * fz], [Cr[0], Cr[1], sd * fz], 0.019), null, null, { k: 1.3 });
        }
        this.add('fork', tubeGeo([Cr[0], Cr[1], -fz - 0.01], [Cr[0], Cr[1], fz + 0.01], 0.022));
      } else {
        for (const z of [0.06, -0.06]) this.add('fork', tubeGeo([HB[0], HB[1], z], [FX, huby, z], 0.016));
      }
      this.add('fork', tubeGeo([Cr[0], Cr[1], 0], [HB[0], HB[1], 0], 0.02));
    }

    this.buildCockpit();

    // Kickstand, on the left chainstay, folded down
    if (B.kickstand) {
      this.part('kickstand');
      const kx = -0.42;
      const ky = bby + (huby - bby) * (kx / rx);
      const kz = stayZ(B, kx, -1) - 0.012;
      this.add('kickstand', new T.BoxGeometry(0.06, 0.03, 0.05), [kx, ky - 0.02, kz], null, { k: 0.7 });
      this.add('kickstand', tubeGeo([kx, ky - 0.03, kz - 0.01], [kx - 0.14, GROUND + 0.02, -0.34], 0.012), null, null, { k: 0.7 });
      this.add('kickstand', new T.BoxGeometry(0.07, 0.012, 0.04), [kx - 0.14, GROUND + 0.012, -0.34], null, { k: 0.5 });
    }

    // Crankset: chainring, cranks and pedals turn together around the bottom bracket.
    this.crankset.position.set(0, bby, 0);
    this.bike.add(this.crankset);
    this.part('chainring', this.crankset);
    this.add('chainring', gearGeo(B.rc, B.chainring, 0.012, 0.007), [0, 0, zc], null, { flat: true });
    this.add('chainring', new T.CylinderGeometry(B.rc * 0.55, B.rc * 0.55, 0.016, 5), [0, 0, zc + 0.012], [HP, 0, 0], { k: 0.7, flat: true });
    this.anchor('chainring', this.bike, [0, bby + B.rc + 0.01, zc]);
    this.part('crank', this.crankset);
    const zr = zc + 0.035;
    this.add('crank', tubeGeo([0, 0, zr], [0.14, -0.3, zr + 0.02], 0.02));
    this.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [0.14, -0.3, zr + 0.07], null, { k: 0.5 });
    this.add('crank', tubeGeo([0, 0, -zr], [-0.14, 0.3, -zr - 0.02], 0.02));
    this.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [-0.14, 0.3, -zr - 0.07], null, { k: 0.5 });
    this.add('crank', new T.CylinderGeometry(0.02, 0.02, 2 * zr, 10), null, [HP, 0, 0]);
    this.anchor('crank', this.crankset, [0.14, -0.3, zr + 0.07]);

    // Sprockets turn with the rear wheel: smooth discs reaching the tooth tips, as in the
    // prototype (teeth on a stack of sprockets read as noise on a phone).
    const sprocketPart = (i: number) => (B.n === 1 ? 'cassette' : i === 0 ? 'smallest_sprocket' : i === B.n - 1 ? 'largest_sprocket' : 'cassette');
    for (const id of new Set(B.cassette.map((_, i) => sprocketPart(i)))) this.part(id, this.rearHub);
    B.cassette.forEach((t, i) => this.add(sprocketPart(i), new T.CylinderGeometry(B.rs[i] + 0.0025, B.rs[i] + 0.0025, B.sp * 0.5, Math.min(t, 48)), [0, 0, B.zs[i]], [HP, 0, 0], { k: 0.9, flat: true }));
    const mid = Math.floor(B.n / 2);
    if (B.n > 1) {
      this.anchor('smallest_sprocket', this.bike, [rx, huby + B.rs[0] + 0.015, B.zs[0]]);
      this.anchor('largest_sprocket', this.bike, [rx, huby + B.rs[B.n - 1] + 0.015, B.zs[B.n - 1]]);
    }
    this.anchor('cassette', this.bike, [rx, huby + B.rs[mid] + 0.015, B.zs[mid]]);

    if (B.gears === 'gearbox') this.add('frame', new T.BoxGeometry(0.22, 0.2, 0.16), [0, bby, 0], null, { k: 0.6 });

    const hasShifter = B.gears !== 'single';
    if (hasShifter) this.part('shift_cable');
    if (B.gears === 'derailleur') this.buildDerailleur();

    // Gear cable from the shifter to the derailleur (or the hub, or the gearbox)
    if (hasShifter) {
      const bt = barrelTurn(B);
      // On a derailleur the housing ends in a loop behind the axle; its last bit, to the
      // derailleur (which turns about its bolt), is placed in setDer.
      const derEnd: V3 | null = this.der ? this.der.housingFrom : null;
      const end: V3 = derEnd ?? (B.gears === 'hub' ? [rx + 0.035, huby - 0.02, zD + 0.02] : [0.05, bby + 0.1, zc - 0.01]);
      const loop: V3[] = derEnd ? [[rx + 0.1, huby + 0.03, zD + 0.04], [rx + 0.01, huby + 0.06, zD + 0.06]] : [];
      // along the down tube (u from the bottom bracket) or just above the top tube (at x)
      const dt = (u: number): V3 => [HB[0] * (1 - u), bby + (HB[1] - bby) * u, 0.06];
      const tt = (x: number, z: number): V3 => [x, ST[1] + ((x - ST[0]) / (HT[0] - ST[0])) * (HT[1] - ST[1]) + 0.04, z];
      const cs = stayPts(B, 'chain', 1);
      const ss = stayPts(B, 'seat', 1);
      const along = (a: V3, b: V3, t: number, dy: number, dz: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + dy, a[2] + (b[2] - a[2]) * t + dz];
      let start: V3[];
      if (B.bar === 'drop') {
        start = [[S[0] - 0.035, S[1] - 0.02, S[2] - 0.005], [C[0] + 0.07, C[1] - 0.012, 0.2], [C[0] + 0.015, C[1] - 0.02, 0.13], [C[0] - 0.03, C[1] - 0.07, 0.07]];
      } else {
        const head: V3 = [bt.pos[0] - bt.axis[0] * bt.len / 2, bt.pos[1], bt.pos[2] - bt.axis[2] * bt.len / 2];
        start = [head, [head[0] + 0.06, head[1] - 0.02, head[2] - 0.08], [hx + 0.08, hy - 0.04, 0.09]];
      }
      const path: V3[] = B.bar === 'drop'
        ? [...start, [HB[0] + 0.02, HB[1] + 0.01, 0.07], [HB[0] * 0.7, dt(0.7)[1], 0.06], dt(0.35), [0.05, bby - 0.07, 0.05], along(cs[2], cs[4], 0.1, 0.035, 0.02), along(cs[2], cs[4], 0.6, 0.035, 0.022), ...loop, end]
        : B.gears === 'gearbox'
          ? [...start, [HB[0] - 0.08, HB[1] - 0.05, 0.07], dt(0.4), end]
          : [...start, tt(HT[0] - 0.25, 0.08), tt(HT[0] - 0.45, 0.05), tt(-0.05, 0.05), tt(ST[0] + 0.02, 0.06), along(ss[0], ss[1], 0.4, 0.03, 0.02), along(ss[0], ss[1], 0.75, 0.03, 0.022), ...loop, end];
      this.add('shift_cable', curveGeo(path, 0.006, 96), null, null, { k: 0.6 });
      this.anchor('shift_cable', this.bike, B.bar === 'drop' ? along(cs[2], cs[4], 0.3, 0.05, 0.02) : tt(-0.05, 0.08));
      if (this.der) {
        // the housing's last bit, and the inner wire from the barrel down to its clamp on the outer link
        this.der.housing = this.add('shift_cable', new T.CylinderGeometry(0.006, 0.006, 1, 8), null, null, { k: 0.6 });
        this.der.wire = this.add('shift_cable', new T.CylinderGeometry(0.0028, 0.0028, 1, 6), null, null, { parent: this.der.body, k: 1.3 });
      }
    }

    // Chain
    const z0 = B.zs[B.n - 1];
    this.circ = B.gears === 'derailleur'
      ? [
        { x: 0, y: bby, z: zc, r: B.rc, s: 1 },
        { x: rx, y: huby, z: z0, r: B.rs[0], s: 1 },
        { x: rx, y: huby - 0.2, z: z0, r: RP, s: -1 },
        { x: rx, y: huby - 0.3, z: z0, r: RP, s: 1 },
      ]
      : [
        { x: 0, y: bby, z: zc, r: B.rc, s: 1 },
        { x: rx, y: huby, z: B.zs[0], r: B.rs[0], s: 1 },
      ];
    this.part('chain');
    if (B.gears === 'derailleur') this.layoutCirc(z0, GAP_OK);
    const Lref = buildPath(this.circ, this.path);
    this.N = Math.max(40, Math.round(Lref / PITCH / 2) * 2);
    const cm = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.15, transparent: true });
    cm.userData.k = 0.6;
    this.chainMesh = new T.InstancedMesh(new T.BoxGeometry(PITCH * 0.8, 0.014, B.chainW), cm, this.N);
    this.chainMesh.frustumCulled = false;
    this.chainMesh.userData.partId = 'chain';
    this.chainMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const chain = this.parts.get('chain')!;
    chain.group.add(this.chainMesh);
    chain.mats.push(cm);
    this.anchor('chain', this.bike, [-0.45, (bby + B.rc + huby + B.rs[mid]) / 2 + 0.03, zc]);
  }

  /** Handlebar, brake levers and the right shifter. */
  private buildCockpit(): void {
    const B = this.spec;
    const { HT, C, S } = B;
    const [hx, hy] = HT;
    const hasShifter = B.gears !== 'single';
    this.part('handlebar');
    this.part('brake_lever');
    if (hasShifter) this.part('shifter_rear');

    if (B.bar === 'drop') {
      // Drop bar: the hoods hold combined brake and shift levers. The brake lever hangs in front
      // of the curve; on the right, the shift paddle sits behind it.
      this.add('handlebar', tubeGeo([HT[0], HT[1], 0], [C[0], C[1], 0], 0.02));
      for (const sd of [1, -1]) {
        const z = sd * 0.21;
        this.add('handlebar', tubeGeo([C[0], C[1], 0], [C[0], C[1], z], 0.014));
        this.add('handlebar', curveGeo([[C[0], C[1], z], [C[0] + 0.1, C[1] + 0.01, z], [C[0] + 0.18, C[1] - 0.08, z], [C[0] + 0.16, C[1] - 0.19, z], [C[0] + 0.05, C[1] - 0.23, z]], 0.013));
        const hood = sd > 0 && hasShifter ? 'shifter_rear' : 'brake_lever';
        this.add(hood, new T.BoxGeometry(0.08, 0.038, 0.034), [C[0] + 0.162, C[1] + 0.012, z], [0, 0, 0.28], { k: 0.42 });
        this.add(hood, new T.BoxGeometry(0.022, 0.03, 0.028), [C[0] + 0.198, C[1] + 0.036, z], [0, 0, 0.5], { k: 0.42 });
        this.add('brake_lever', curveGeo([[C[0] + 0.2, C[1] + 0.005, z], [C[0] + 0.218, C[1] - 0.07, z], [C[0] + 0.2, C[1] - 0.14, z], [C[0] + 0.165, C[1] - 0.19, z]], 0.009, 24), null, null, { k: 1.15 });
        if (sd > 0 && hasShifter) {
          this.add('shifter_rear', curveGeo([[C[0] + 0.188, C[1] - 0.01, z], [C[0] + 0.198, C[1] - 0.07, z - 0.004], [C[0] + 0.182, C[1] - 0.12, z - 0.012]], 0.0065, 16), null, null, { k: 0.7 });
        }
      }
      this.anchor('brake_lever', this.bike, [C[0] + 0.22, C[1] - 0.09, 0.21]);
    } else {
      const g = gripOf(B.bar, HT);
      if (B.bar === 'flat') {
        this.add('handlebar', tubeGeo([hx, hy, 0], [g[0], g[1], 0], 0.018));
        this.add('handlebar', tubeGeo([g[0], g[1], -0.4], [g[0], g[1], 0.4], 0.015));
      } else {
        this.add('handlebar', tubeGeo([hx, hy, 0], [hx - 0.02, hy + 0.08, 0], 0.02));
        for (const sd of [1, -1]) {
          this.add('handlebar', tubeGeo([hx - 0.02, hy + 0.08, 0], [hx - 0.02, hy + 0.08, sd * 0.14], 0.016));
          this.add('handlebar', tubeGeo([hx - 0.02, hy + 0.08, sd * 0.14], [g[0], g[1], sd * 0.3], 0.015));
          this.add('handlebar', tubeGeo([g[0], g[1], sd * 0.3], [g[0], g[1], sd * 0.4], 0.015));
        }
      }
      for (const sd of [1, -1]) {
        // grip, then the brake lever: a clamp, a body forward of the bar and a blade in front of the grip
        this.add('handlebar', tubeGeo([g[0], g[1], sd * 0.3], [g[0], g[1], sd * 0.4], 0.021), null, null, { k: 0.45 });
        this.add('brake_lever', new T.CylinderGeometry(0.021, 0.021, 0.016, 12), [g[0], g[1], sd * 0.288], [HP, 0, 0], { k: 0.5 });
        this.add('brake_lever', new T.BoxGeometry(0.055, 0.026, 0.02), [g[0] + 0.03, g[1] + 0.004, sd * 0.288], null, { k: 0.5 });
        this.add('brake_lever', curveGeo([[g[0] + 0.052, g[1] + 0.0, sd * 0.292], [g[0] + 0.068, g[1] - 0.008, sd * 0.33], [g[0] + 0.07, g[1] - 0.016, sd * 0.385]], 0.0075, 16), null, null, { k: 1.15 });
      }
      if (hasShifter) {
        // trigger shifter under the bar, inside the brake lever: the large lever for the thumb
        // (towards the rider) and the small release lever in front for the index finger
        this.add('shifter_rear', new T.CylinderGeometry(0.019, 0.019, 0.012, 12), [g[0], g[1], 0.262], [HP, 0, 0], { k: 0.5 });
        this.add('shifter_rear', new T.BoxGeometry(0.06, 0.036, 0.045), [S[0], S[1], S[2]], null, { k: 0.55 });
        const thumb = this.add('shifter_rear', new T.BoxGeometry(0.03, 1, 0.007), null, null, { k: 0.85 });
        plate(thumb, [S[0] - 0.02, S[1] - 0.012, S[2] + 0.005], [S[0] - 0.065, S[1] - 0.022, S[2] + 0.04], [0, 1, 0]);
        const trig = this.add('shifter_rear', new T.BoxGeometry(0.018, 1, 0.006), null, null, { k: 0.85 });
        plate(trig, [S[0] + 0.022, S[1] - 0.008, S[2] + 0.004], [S[0] + 0.042, S[1] - 0.026, S[2] + 0.03], [1, 0, 0]);
        this.add('shifter_rear', new T.BoxGeometry(0.004, 0.016, 0.026), [S[0] - 0.031, S[1] + 0.004, S[2]], null, { dark: true });
      }
      this.anchor('brake_lever', this.bike, [g[0] + 0.07, g[1], 0.36]);
    }
    if (hasShifter) this.anchor('shifter_rear', this.bike, [S[0], S[1] + 0.05, S[2]]);
  }

  /** Hanger; body with the H, L and B screws; parallelogram links; P-knuckle; cage and pulleys. */
  private buildDerailleur(): void {
    const B = this.spec;
    const { rx, huby } = B;
    const G = derGeom(B);
    const { zH, zB, L, eb, Hb } = G;
    const D = 'rear_derailleur';
    const pw = B.chainW / 2 + 0.0035;
    const P0 = derPose(B, G, B.zs[B.n - 1], GAP_OK, B.rs[B.n - 1]);

    // Hanger: a plate from the axle down to the derailleur bolt, with a tab the B screw rests on.
    this.part('derailleur_hanger');
    const tab = bodyToBike(G, P0.beta, [0.019, 0.03, 0]);
    this.add('derailleur_hanger', slabGeo(hullShape([[rx, huby, 0.03], [Hb[0], Hb[1], 0.022], [tab[0], tab[1], 0.012]]), zH - 0.0045, zH + 0.0045, 0.002), null, null, { k: 0.8 });
    this.add('derailleur_hanger', new T.CylinderGeometry(0.008, 0.008, zB - zH + 0.005, 10), [tab[0], tab[1], (zH + zB) / 2], [HP, 0, 0], { k: 0.8 });
    this.anchor('derailleur_hanger', this.bike, [(rx + Hb[0]) / 2, (huby + Hb[1]) / 2, zH + 0.01]);

    this.part(D);
    this.part('upper_pulley');
    const dg = this.parts.get(D)!.group;

    // Body (B-knuckle): turns about the bolt; its frame has the bolt at the origin and points along -x.
    const body = new T.Group();
    body.position.set(Hb[0], Hb[1], 0);
    dg.add(body);
    const bz0 = zH + 0.005;
    const bz1 = zB + 0.008;
    this.add(D, new T.CylinderGeometry(0.021, 0.021, bz1 - zH + 0.006, 20), [0, 0, (bz1 + zH - 0.006) / 2], [HP, 0, 0], { parent: body, k: 0.45 });
    this.add(D, new T.CylinderGeometry(0.011, 0.011, 0.006, 6), [0, 0, bz1 + 0.003], [HP, 0, 0], { parent: body, k: 1.25 });
    this.add(D, slabGeo(capsuleShape(0, -eb - 0.004, 0.022, 0.02), bz0, bz1, 0.005), null, null, { parent: body, k: 0.5 });
    // a lighter cover on the outer face, as on a real derailleur
    this.add(D, slabGeo(capsuleShape(-0.01, -eb + 0.004, 0.014, 0.013), bz1 - 0.001, bz1 + 0.002, 0.001), null, null, { parent: body, k: 0.85 });
    for (const z of [zB, zB - EZ]) this.add(D, new T.CylinderGeometry(0.005, 0.005, 0.05, 8), [-eb, 0, z], null, { parent: body, k: 1.2 });

    // Links: rigid plates from pins on the body to pins on the P-knuckle; they swing inwards.
    const links = [0.02, 0.016].map((hw, i) => {
      const geo = slabGeo(capsuleShape(0, -L, hw, hw * 0.9), -0.003, 0.003, 0.0015);
      const m = this.add(D, geo, [-eb, 0, i ? zB - EZ : zB], null, { parent: body, k: i ? 0.55 : 0.75 });
      return m;
    });
    // P-knuckle: moves with the links' free end without turning; carries the cage pivot (round cap)
    const pk = new T.Group();
    body.add(pk);
    this.add(D, slabGeo(capsuleShape(0.004, -PIN, 0.017, 0.021), -EZ - 0.005, 0.006, 0.004), null, null, { parent: pk, k: 0.5 });
    this.add(D, new T.CylinderGeometry(0.023, 0.023, 0.014, 22), [-PIN, 0, 0.004], [HP, 0, 0], { parent: pk, k: 0.4 });
    this.add(D, new T.CylinderGeometry(0.012, 0.012, 0.004, 16), [-PIN, 0, 0.012], [HP, 0, 0], { parent: pk, k: 0.95 });
    for (const z of [0, -EZ]) this.add(D, new T.CylinderGeometry(0.005, 0.005, 0.05, 8), [0, 0, z], null, { parent: pk, k: 1.2 });

    // Cage: two plates with the upper and lower pulley; hangs from the pivot, at local (0, CO).
    const cage = new T.Group();
    this.cage = cage;
    dg.add(cage);
    this.add('upper_pulley', gearGeo(RP, 11, Math.min(0.011, B.sp * 0.9)), null, null, { parent: cage, k: 0.35, flat: true });
    this.add(D, gearGeo(RP, 11, Math.min(0.011, B.sp * 0.9)), [0, -LC, 0], null, { parent: cage, k: 0.35, flat: true });
    this.add(D, slabGeo(hullShape([[0, CO, 0.019], [0, 0, 0.03], [0, -LC, 0.035]]), pw, pw + 0.006, 0.002), null, null, { parent: cage, k: 0.5 });
    // the inner plate starts below the upper pulley's axle, so it stays off the next larger sprocket
    this.add(D, slabGeo(hullShape([[0, -0.068, 0.012], [0, -LC, 0.024]]), -pw - 0.004, -pw, 0.0015), null, null, { parent: cage, k: 0.55 });
    for (const y of [0, -LC]) this.add(D, new T.CylinderGeometry(0.011, 0.011, 2 * pw + 0.006, 12), [0, y, 0], [HP, 0, 0], { parent: cage, k: 1.25 });
    // pivot axle from the cage up into the P-knuckle
    this.add(D, new T.CylinderGeometry(0.009, 0.009, POFF - pw, 10), [0, CO, (POFF + pw) / 2], [HP, 0, 0], { parent: cage, k: 1.1 });
    this.anchor('upper_pulley', cage, [0, 0.01, 0.02]);
    this.anchor(D, cage, [0, CO * 0.5, 0.05]);

    // Limit screws H and L on top of the body, heads up and back where you turn them; the B
    // screw behind the bolt, its tip against the hanger's tab.
    this.screw('h_screw', [-0.022, 0.026, (zH + zB) / 2 + 0.006], [0.3, -0.954, 0], body);
    this.screw('l_screw', [-0.046, 0.024, (zH + zB) / 2 + 0.006], [0.3, -0.954, 0], body);
    this.screw('b_screw', [0.003, 0.03, zB - 0.004], [1, 0, 0], body);

    // Barrel adjuster: on the body where the housing comes in, or on the trigger shifter
    const bt = B.barrelAt === 'derailleur' ? bodyBarrel(G) : barrelTurn(B);
    const spin = this.turnable('barrel_adjuster', bt, B.barrelAt === 'derailleur' ? body : this.bike);
    const br = 0.013;
    this.add('barrel_adjuster', new T.CylinderGeometry(br, br, bt.len * 0.75, 10), [0, -bt.len * 0.125, 0], null, { parent: spin, flat: true });
    for (const y of [-0.3, 0, 0.3]) this.add('barrel_adjuster', new T.CylinderGeometry(br + 0.002, br + 0.002, 0.004, 10), [0, -bt.len * 0.125 + y * bt.len * 0.75, 0], null, { parent: spin, k: 0.8, flat: true });
    this.add('barrel_adjuster', new T.CylinderGeometry(br * 0.55, br * 0.55, bt.len * 0.25, 8), [0, bt.len * 0.375, 0], null, { parent: spin, k: 1.2 });
    this.add('barrel_adjuster', new T.BoxGeometry(0.006, 0.004, br * 2.2), [0, -bt.len / 2, 0], null, { parent: spin, dark: true });
    if (B.barrelAt !== 'derailleur') {
      // a plain cable stop where the barrel would be
      const st = bodyBarrel(G);
      const stop = this.add(D, new T.CylinderGeometry(0.01, 0.01, 0.022, 10), null, null, { parent: body, k: 1.1 });
      stop.position.set(...st.pos);
      stop.quaternion.setFromUnitVectors(UP, new T.Vector3(...st.axis));
    }
    // the housing loop ends here; its last bit to the body is placed in setDer
    const head = bodyToBike(G, P0.beta, bodyBarrel(G).pos);
    this.der = { G, body, links, pk, wire: null, housing: null, housingFrom: [head[0] - 0.03, head[1] + 0.07, head[2] + 0.03] };
  }

  private buildStand(): void {
    const B = this.spec;
    const cx = B.ST[0] - 0.03;
    const cz = -0.34;
    const cy = B.ST[1] + 0.12 + LIFT;
    const top = cy + 0.2;
    const mk = (geo: T.BufferGeometry, p?: V3) => {
      const m = new T.Mesh(geo, this.standMat);
      if (p) m.position.set(...p);
      this.standG.add(m);
      return m;
    };
    mk(tubeGeo([cx, GROUND, cz], [cx, top, cz], 0.02));
    mk(tubeGeo([cx, cy, cz], [cx, cy, -0.06], 0.016));
    for (const a of [HP, HP + TAU / 3, HP + (2 * TAU) / 3]) {
      mk(tubeGeo([cx, GROUND + 0.02, cz], [cx + 0.5 * Math.cos(a), GROUND + 0.02, cz + 0.5 * Math.sin(a)], 0.018));
    }
    const clamp = this.part('stand_clamp', this.standG, [cx, cy, 0]);
    this.add('stand_clamp', new T.BoxGeometry(0.07, 0.1, 0.07), null, null, { k: 0.7 });
    const lever = new T.Group();
    lever.position.set(0, 0, 0.05);
    clamp.group.add(lever);
    this.add('stand_clamp', new T.CylinderGeometry(0.012, 0.012, 0.05, 8), [0, 0, 0.0], [HP, 0, 0], { parent: lever, k: 0.5 });
    this.add('stand_clamp', new T.BoxGeometry(0.1, 0.018, 0.018), [0.045, 0, 0.03], null, { parent: lever, k: 0.5 });
    clamp.group.userData.lever = lever;
    this.anchors.set('stand_clamp', clamp.group);
  }

  private buildHook(): void {
    this.rope = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 1, 6), this.standMat);
    const hook = new T.Mesh(new T.TorusGeometry(0.05, 0.008, 6, 20, Math.PI * 1.4), this.standMat);
    hook.name = 'hook';
    this.hookG.add(this.rope, hook);
  }

  /** The point on the saddle the hook holds, in bike space. */
  get hookPoint(): T.Vector3 {
    return new T.Vector3(this.spec.saddleX + 0.13, this.spec.saddleY - 0.03, 0);
  }

  // ---------------------------------------------------------------- name on the down tube

  private makeDecal(a: V2, b: V2, r: number): void {
    if (typeof document === 'undefined') return;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx);
    const w = len * 0.5;
    const hgt = 0.07;
    const cv = document.createElement('canvas');
    cv.width = 1280;
    cv.height = Math.round((1280 * hgt) / w);
    const tex = new T.CanvasTexture(cv);
    const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new T.PlaneGeometry(w, hgt);
    const ca = Math.cos(th);
    const sa = Math.sin(th);
    for (const sd of [1, -1]) {
      const m = new T.Mesh(geo, mat);
      m.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(sd * ca, sd * sa, 0), new T.Vector3(-sa, ca, 0), new T.Vector3(0, 0, sd)));
      m.position.set(a[0] + dx * 0.66, a[1] + dy * 0.66, sd * (r + 0.003));
      m.userData.partId = 'frame';
      this.parts.get('frame')!.group.add(m);
    }
    this.decal = { cv, tex, mat, key: '' };
  }

  /** Writes the bike's name on the down tube, in a colour that reads on the frame. */
  drawDecal(name: string, frame: T.Color, opacity: number): void {
    const d = this.decal;
    if (!d) return;
    d.mat.opacity = opacity;
    const txt = (name || 'Your bike').toUpperCase();
    const key = `${txt}|${frame.getHexString()}`;
    if (key === d.key) return;
    d.key = key;
    const c = d.cv.getContext('2d');
    if (!c) return;
    const W = d.cv.width;
    const H = d.cv.height;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 0.2126 * frame.r + 0.7152 * frame.g + 0.0722 * frame.b > 0.45 ? '#14202A' : '#F4F7F9';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let size = Math.round(H * 0.8);
    const font = (z: number) => `700 ${z}px "Barlow Condensed","Arial Narrow",sans-serif`;
    c.font = font(size);
    while (c.measureText(txt).width > W * 0.94 && size > 20) {
      size -= 4;
      c.font = font(size);
    }
    c.fillText(txt, W / 2, H / 2 + size * 0.04);
    d.tex.needsUpdate = true;
  }

  /** Forces the name to be drawn again (after web fonts load). */
  redrawDecal(): void {
    if (this.decal) this.decal.key = '';
  }

  // ---------------------------------------------------------------- derailleur and chain

  /** Sprocket radius at a z between the sprockets. */
  rAtZ(z: number): number {
    return rAt(this.spec, z);
  }

  /** Where the upper pulley sits for a derailleur position z and a gap (see derPose), with the cage angle and the lower pulley. */
  layout(z: number, gap: number): { r: number; a: number; gx: number; gy: number; lx: number; ly: number; pose: DerPose } {
    const B = this.spec;
    const r = this.rAtZ(z);
    const G = this.der?.G ?? derGeom(B);
    const pose = derPose(B, G, z, gap, r);
    const [gx, gy] = pose.U;
    return { r, a: pose.cage + HP, gx, gy, lx: gx + LC * Math.cos(pose.cage), ly: gy + LC * Math.sin(pose.cage), pose };
  }

  private layoutCirc(z: number, gap: number) {
    const L = this.layout(z, gap);
    const c = this.circ;
    c[1].r = L.r;
    c[1].z = z;
    c[2].x = L.gx;
    c[2].y = L.gy;
    c[2].z = z;
    c[3].x = L.lx;
    c[3].y = L.ly;
    c[3].z = z;
    return L;
  }

  /** Moves the derailleur to z with the given gap, and lays the chain along the new path. */
  setDer(z: number, gap: number): void {
    this.derZ = z;
    this.gap = gap;
    const d = this.der;
    if (this.cage && d) {
      const { G } = d;
      const Lo = this.layoutCirc(z, gap);
      const P = Lo.pose;
      this.cage.position.set(Lo.gx, Lo.gy, z);
      this.cage.rotation.z = Lo.a;
      d.body.rotation.z = P.beta + Math.PI;
      for (const m of d.links) m.rotation.y = -P.phi;
      const px = -G.eb - G.L * Math.cos(P.phi);
      const pz = G.zB - G.L * Math.sin(P.phi);
      d.pk.position.set(px, 0, pz);
      const bb = bodyBarrel(G);
      if (d.wire) {
        const k = 0.45;
        seg(d.wire, [bb.pos[0] + bb.axis[0] * bb.len * 0.5, bb.pos[1] + bb.axis[1] * bb.len * 0.5, bb.pos[2]], [-G.eb - G.L * Math.cos(P.phi) * k, -0.012, G.zB - G.L * Math.sin(P.phi) * k + 0.006]);
      }
      if (d.housing) {
        const head = bodyToBike(G, P.beta, [bb.pos[0] - bb.axis[0] * bb.len * 0.5, bb.pos[1] - bb.axis[1] * bb.len * 0.5, bb.pos[2]]);
        seg(d.housing, d.housingFrom, head);
      }
    }
    const total = buildPath(this.circ, this.path);
    const step = total / this.N;
    const Q = this.Q;
    const pt = this.pt;
    let hint = 0;
    const shift = ((this.chainShift % total) + total) % total;
    for (let k = 0; k < this.N; k++) {
      hint = pointAt(this.path, k * step + shift, pt, hint);
      Q.position.set(pt.x, pt.y, pt.z);
      // the link runs along the chain, its width stays across the bike: no twist where the chain bends sideways
      tX.set(pt.dx, pt.dy, pt.dz).normalize();
      tN.set(0, 0, 1).addScaledVector(tX, -tX.z).normalize();
      tD.crossVectors(tN, tX);
      Q.quaternion.setFromRotationMatrix(tM.makeBasis(tX, tD, tN));
      Q.scale.set(1, k % 2 ? 0.7 : 1, 1);
      Q.updateMatrix();
      this.chainMesh.setMatrixAt(k, Q.matrix);
    }
    this.chainMesh.instanceMatrix.needsUpdate = true;
  }

  /** z of the derailleur for sprocket i. */
  zOf(i: number): number {
    const { zs, n } = this.spec;
    return zs[Math.max(0, Math.min(n - 1, i))];
  }
}
