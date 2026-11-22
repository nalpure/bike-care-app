// Spec: constants, BikeSpec and bikeSpec(facts) (which bike to draw), the cassette, the geometry
// facts, and the frame-point helpers (grip, battery line, stays).
// Session area: shared by everything; session C (cassette, chain line) and E (frame, bar) edit here.

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
/**
 * B gap on the largest sprocket (pitch circle to pitch circle), set by the B screw: right (5.5 mm),
 * too big (11 mm, twice the right one), too small (2 mm). Drawing values, not a setting to rely on.
 */
export const GAP_OK = 0.011;
export const GAP_BIG = 0.022;
export const GAP_SMALL = 0.004;
/** the derailleur pulleys' pitch radius (where the chain's pins run): 11 teeth (rd-rig.ts) */
export const RP = rOf(11);
/** default bottom bracket height (a city bike: 65 mm below the axles) */
export const BBY = HUBY - 0.13;
export const DEG = Math.PI / 180;

export type V2 = [number, number];
export type V3 = [number, number, number];

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
  /** distance between sprockets, and the thickness of one (scene units) */
  sp: number;
  sprT: number;
  zs: number[];
  rs: number[];
  rc: number;
  /** outer width of the chain, by number of speeds (scene units) */
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

/**
 * Common cassettes, one row per kind of bike and number of speeds. DRAWING DATA, not facts: the
 * tooth counts only decide what the 3D view shows and are never given as a part's compatibility
 * (hard rule 3). Where I am not sure of the exact real sequence, the sequence is a plausible
 * spread with the right first and last tooth.
 */
const CASSETTES: Record<BikeSpec['kind'], Record<number, number[]>> = {
  road: {
    8: [11, 13, 15, 17, 19, 21, 24, 28],
    9: [11, 12, 13, 15, 17, 19, 21, 24, 28],
    10: [11, 12, 14, 16, 18, 20, 23, 26, 29, 32],
    11: [11, 12, 13, 14, 16, 18, 20, 22, 25, 28, 32],
    12: [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34],
  },
  city: {
    7: [14, 16, 18, 20, 22, 24, 28],
    8: [11, 13, 15, 17, 20, 23, 27, 32],
    9: [11, 13, 15, 17, 20, 23, 26, 30, 34],
    10: [11, 13, 15, 17, 19, 21, 24, 28, 32, 36],
  },
  mountain: {
    8: [11, 13, 15, 18, 21, 24, 28, 32],
    9: [11, 13, 15, 17, 20, 23, 26, 30, 34],
    10: [11, 13, 15, 17, 19, 21, 24, 28, 32, 36],
    11: [11, 13, 15, 17, 19, 21, 24, 28, 32, 37, 42],
    12: [10, 12, 14, 16, 18, 21, 24, 28, 33, 39, 45, 51],
  },
};

/** `n` tooth counts spread evenly (geometric, so the small sprockets stay close) from `first` to `last`. */
function spread(first: number, last: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let t = Math.round(first * Math.pow(last / first, i / Math.max(1, n - 1)));
    if (i && t <= out[i - 1]) t = out[i - 1] + 1;
    out.push(t);
  }
  return out;
}

/**
 * The sprockets to draw (smallest first) for a kind of bike and a number of speeds.
 * Rule: take the row of the table above with the same kind and speeds. For other speeds (5, 6, 13)
 * take the row with the nearest speeds (the larger one on a tie) and spread `n` tooth counts
 * evenly between its smallest and largest. If `model` (drive.cassette_model) contains a range such
 * as `11-34` or `11–42`, use the same row, stretched to that first and last tooth; a range that
 * cannot be a cassette (first below 9, last above 55, or too narrow for `n` sprockets) is ignored.
 * One sprocket (hub gear, single speed): 18 teeth.
 */
export function cassetteFor(kind: BikeSpec['kind'], n: number, model?: unknown): number[] {
  if (n <= 1) return [18];
  const rows = CASSETTES[kind];
  const speeds = Object.keys(rows).map(Number);
  const near = speeds.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) || (Math.abs(b - n) === Math.abs(a - n) && b > a) ? b : a));
  const row = rows[near];
  let first = row[0];
  let last = row[row.length - 1];
  const range = typeof model === 'string' ? /(?<!\d)(\d{2})\s*[-–]\s*(\d{2})(?!\d)/.exec(model) : null;
  if (range) {
    const [f, l] = [Number(range[1]), Number(range[2])];
    if (f >= 9 && l <= 55 && l - f >= n - 1) {
      first = f;
      last = l;
    }
  }
  if (near === n && first === row[0] && last === row[row.length - 1]) return row.slice();
  // the table's shape (or, for other speeds, an even spread), stretched to the first and last tooth
  const base = near === n ? row : spread(row[0], row[row.length - 1], n);
  const out = base.map((t) => Math.round(first + ((t - base[0]) / (base[n - 1] - base[0])) * (last - first)));
  for (let i = 1; i < n; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 1;
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
 * - Drivetrain sizes are real, in mm: sprocket spacing 5 (up to 7 speeds), 4.8, 4.35, 3.95, 3.74,
 *   3.5, 3.3 (8 to 13); chain outer width 7.3 (up to 8 speeds), 6.6, 5.9, 5.5, 5.3 (12 and 13);
 *   sprocket thickness 1.8 (less where it would touch the chain on the next sprocket). They are
 *   drawing values, never shown as a part's compatibility. The dropouts sit 12 mm (0.0245 units)
 *   outside the smallest sprocket's middle. The sprockets are `cassetteFor` (see there).
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
  const cassette = cassetteFor(kind, speeds, facts['drive.cassette_model']);
  const n = cassette.length;
  // Sprocket spacing, chain width and sprocket thickness are the real ones (drawing values, see
  // the comment above bikeSpec), on a realistic chain line: the cassette's middle lines up with
  // the chainring. The close-up views make up for the small spacing.
  const spMm = n <= 7 ? 5 : n === 8 ? 4.8 : n === 9 ? 4.35 : n === 10 ? 3.95 : n === 11 ? 3.74 : n === 12 ? 3.5 : 3.3;
  const sp = n > 1 ? spMm / 500 : 0.03;
  const chainMm = speeds <= 8 ? 7.3 : speeds === 9 ? 6.6 : speeds === 10 ? 5.9 : speeds === 11 ? 5.5 : 5.3;
  // 1.8 mm thick, thinner only where the chain would not fit beside the next sprocket
  const sprT = (n > 1 ? Math.min(1.8, 2 * (spMm - chainMm / 2) - 0.1) : 1.8) / 500;
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
  const chainW = chainMm / 500;
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
    n, sp, sprT, zs,
    rs: cassette.map(rOf),
    rc: rOf(road ? 50 : mtb ? 32 : 44),
    chainW,
    chainline,
    zDrop: zs[0] + 0.0245,
    ST, HT, HB,
    saddleX, saddleY,
    C, S, barTop,
  };
}

/** Where the grip starts on a flat or riser bar (x, y); the grip runs from z 0.3 to 0.4. */
export function gripOf(bar: BikeSpec['bar'], HT: V2): V2 {
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
export function stayZ(B: BikeSpec, x: number, sd: 1 | -1): number {
  const p = stayPts(B, 'chain', sd);
  for (let i = 1; i < p.length; i++) {
    if (x >= p[i][0]) return p[i - 1][2] + (p[i][2] - p[i - 1][2]) * ((x - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1));
  }
  return p[p.length - 1][2];
}
