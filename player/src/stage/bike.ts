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
  /** z of the drive-side dropout and derailleur hanger: just outside the smallest sprocket */
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
  const sp = n > 1 ? 0.16 / (n - 1) : 0.03;
  const zs = cassette.map((_, i) => (n > 1 ? 0.32 - i * sp : 0.22));
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
  const chainW = Math.min(0.02, sp * 0.7);
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
    zDrop: zs[0] + sp * 0.25 + 0.02,
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

// ------------------------------------------------------------------ derailleur layout

/**
 * The rear derailleur's fixed points. It hangs from the hanger bolt, below and behind the axle,
 * outside the smallest sprocket. The body (B-knuckle) runs down from there; at its foot, the
 * parallelogram links swing in the plane seen from behind: upright on the smallest sprocket,
 * leaning in towards the spokes for the larger ones. Their free end (the P-knuckle) carries the
 * cage, so nothing but the chain and the pulleys comes near the sprockets.
 */
export interface DerGeom {
  /** z of the hanger, and of the body and links */
  zH: number;
  zL: number;
  /** link length and the links' fixed pivot on the body */
  Lk: number;
  Bk: V3;
  /** hanger bolt */
  Hb: V3;
  /** body: x centre, top and bottom */
  bodyX: number;
  top: number;
  bottom: number;
}

export function derGeom(B: BikeSpec): DerGeom {
  const { zs, rs, n, rx, huby } = B;
  const zH = B.zDrop;
  const zL = zH + 0.016;
  const dz = zs[0] - zs[n - 1];
  const dy = Math.max(1e-3, rs[n - 1] - rs[0]);
  // links long enough that their end follows the pulley from the smallest to the largest sprocket
  const Lk = Math.min(0.21, Math.max(0.15, (dz * dz + dy * dy) / (2 * dy)));
  const uy = huby - rs[0] - GAP_OK - RP;
  const Bk: V3 = [rx - 0.05, uy - Lk, zL];
  return { zH, zL, Lk, Bk, Hb: [rx - 0.03, huby - 0.055, zH], bodyX: rx - 0.125, top: huby - 0.04, bottom: Bk[1] - 0.016 };
}

/** Where the P-knuckle (the links' free end) is when the derailleur is at z. */
export function pivotAt(B: BikeSpec, G: DerGeom, z: number): V3 {
  const s = Math.max(-0.6, Math.min(1, (B.zs[0] - z) / G.Lk));
  return [G.Bk[0], G.Bk[1] + G.Lk * Math.cos(Math.asin(s)), G.zL - G.Lk * s];
}

/** A turnable part: screws and the barrel adjuster. `axis` points from the head into the thread. */
export interface Turn {
  pos: V3;
  axis: V3;
  len: number;
}

/** Where the barrel adjuster sits and which way it points, on this bike. */
export function barrelTurn(B: BikeSpec): Turn {
  if (B.barrelAt === 'derailleur') {
    const G = derGeom(B);
    return { pos: [B.rx - 0.055, B.huby - 0.022, G.zL], axis: [0, -1, 0], len: 0.034 };
  }
  // on the trigger pod's inner end, pointing in and forward where the cable leaves
  const ax: V3 = [0.45, 0, -0.89];
  const tip: V3 = [B.S[0] + 0.012, B.S[1] + 0.004, B.S[2] - 0.0225];
  return { pos: [tip[0] + ax[0] * 0.019, tip[1], tip[2] + ax[2] * 0.019], axis: [-ax[0], 0, -ax[2]], len: 0.038 };
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

/** A toothed wheel in the xy plane, centred on z = 0: sprockets, chainring, pulleys. */
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

/** A flat plate shaped like a slot from (0, 0) to (0, -len), centred on z = 0. */
function slotGeo(r1: number, r2: number, len: number, thick: number): T.BufferGeometry {
  const s = new T.Shape();
  s.absarc(0, 0, r1, 0, Math.PI, false);
  s.lineTo(-r2, -len);
  s.absarc(0, -len, r2, Math.PI, TAU, false);
  s.lineTo(r1, 0);
  const g = new T.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -thick / 2);
  return g;
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
  /** screws and the barrel adjuster: where they are, which way they turn, and the group that turns */
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

  private der: { G: DerGeom; links: T.Mesh[]; pk: T.Mesh; pin: T.Mesh; arm: T.Mesh; wire: T.Mesh | null; wireTop: V3 } | null = null;
  private chainMesh!: T.InstancedMesh;
  private circ: Circle[] = [];
  private path = newPath();
  private N = 0;
  private decal: { cv: HTMLCanvasElement; tex: T.CanvasTexture; mat: T.MeshBasicMaterial; key: string } | null = null;
  private Q = new T.Object3D();
  private AX = new T.Vector3(1, 0, 0);
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
  private turnable(id: string, t: Turn): T.Object3D {
    const p = this.part(id, this.bike, t.pos);
    const orient = new T.Group();
    orient.quaternion.setFromUnitVectors(UP, new T.Vector3(...t.axis).normalize());
    const spin = new T.Group();
    orient.add(spin);
    p.group.add(orient);
    this.turns.set(id, { ...t, spin });
    this.anchors.set(id, p.group);
    return spin;
  }

  private screw(id: string, at: V3, axis: V3): void {
    const spin = this.turnable(id, { pos: at, axis, len: 0.028 });
    this.add(id, new T.CylinderGeometry(0.008, 0.008, 0.028, 10), null, null, { parent: spin, k: 1.15 });
    this.add(id, new T.CylinderGeometry(0.013, 0.013, 0.008, 14), [0, -0.016, 0], null, { parent: spin, k: 1.15 });
    this.add(id, new T.BoxGeometry(0.02, 0.004, 0.0035), [0, -0.0205, 0], null, { parent: spin, dark: true });
  }

  // ---------------------------------------------------------------- build

  private build(): void {
    const B = this.spec;
    const road = B.kind === 'road';
    const { ST, HT, HB, C, S, rx, huby, bby } = B;
    const [hx, hy] = HT;
    const FX = B.FX;
    const zD = B.zDrop;

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
      // hub shell and axle; the rear axle reaches the drive-side dropout outside the sprockets
      const z0 = rear ? -0.13 : -0.1;
      const z1 = rear ? zD + 0.02 : 0.1;
      this.add(id, new T.CylinderGeometry(0.012, 0.012, z1 - z0, 10), [0, 0, (z0 + z1) / 2], [HP, 0, 0], { k: 1.2 });
      const s1 = rear ? B.zs[B.n - 1] - 0.02 : 0.05;
      this.add(id, new T.CylinderGeometry(0.028, 0.028, s1 + 0.06, 16), [0, 0, (s1 - 0.06) / 2], [HP, 0, 0], { k: 0.9 });
      if (rear && B.gears === 'hub') this.add(id, new T.CylinderGeometry(0.075, 0.075, 0.13, 20), null, [HP, 0, 0], { k: 0.8 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        this.add(id, tubeGeo([0, 0, i % 2 ? 0.03 : -0.03], [(rim - 0.01) * Math.cos(a), (rim - 0.01) * Math.sin(a), 0], 0.004), null, null, { k: 1.2 });
      }
      this.anchor(id, this.bike, [cx, huby + B.rt * 0.72, 0.05]);
    };
    wheel('rear_wheel', this.rearHub, rx);
    wheel('front_wheel', this.frontHub, FX);

    // Frame. On the drive side the stays bend out around the sprockets to the dropout, which
    // sits just outside the smallest sprocket, as on a real bike; the hanger is bolted there.
    this.part('frame');
    const ft = (a: V3, b: V3, r: number) => this.add('frame', tubeGeo(a, b, r), null, null, { tint: 'frame' });
    const fr = B.kind === 'mountain' ? 0.03 : road ? 0.02 : 0.024;
    const dtR = fr + 0.004;
    const sy = ST[1] - (road ? 0.05 : 0);
    ft([0, bby, 0], [ST[0], ST[1], 0], fr + (road ? 0.004 : 0));
    ft([ST[0], ST[1], 0], [HT[0], HT[1], 0], fr - 0.002);
    ft([HT[0], HT[1], 0], [HB[0], HB[1], 0], 0.03);
    ft([0, bby, 0], [HB[0], HB[1], 0], fr + 0.004);
    ft([0, bby, -0.1], [rx, huby, -0.1], 0.016);
    ft([ST[0], sy, -0.05], [rx, huby, -0.1], 0.012);
    for (const [from, z0, r] of [[[0, bby], 0.1, 0.016], [[ST[0], sy], 0.05, 0.012]] as Array<[V2, number, number]>) {
      this.add('frame', curveGeo(stayPts(B, from, z0), r, 24), null, null, { tint: 'frame' });
    }
    // drive-side dropout
    this.add('frame', polyGeo([[rx + 0.035, huby + 0.02], [rx + 0.03, huby - 0.025], [rx - 0.02, huby - 0.03], [rx - 0.03, huby + 0.03], [rx + 0.0, huby + 0.045]], zD - 0.012, 0.006), null, null, { tint: 'frame' });
    this.add('frame', new T.CylinderGeometry(0.045, 0.045, 0.2, 18), [0, bby, 0], [HP, 0, 0], { tint: 'frame' });
    this.makeDecal([0, bby], HB, dtR);
    this.anchor('frame', this.bike, [HB[0] / 2, (bby + HB[1]) / 2, 0.03]);

    if (B.motor) {
      this.part('motor');
      const [b0, b1] = batteryLine(B);
      this.add('motor', new T.BoxGeometry(0.2, 0.2, 0.22), [0.0, bby + 0.01, 0], null, { k: 0.6 });
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
      this.add('kickstand', new T.BoxGeometry(0.06, 0.03, 0.05), [kx, ky - 0.02, -0.1], null, { k: 0.7 });
      this.add('kickstand', tubeGeo([kx, ky - 0.03, -0.11], [kx - 0.14, GROUND + 0.02, -0.34], 0.012), null, null, { k: 0.7 });
      this.add('kickstand', new T.BoxGeometry(0.07, 0.012, 0.04), [kx - 0.14, GROUND + 0.012, -0.34], null, { k: 0.5 });
    }

    // Crankset: chainring, cranks and pedals turn together around the bottom bracket.
    this.crankset.position.set(0, bby, 0);
    this.bike.add(this.crankset);
    this.part('chainring', this.crankset);
    this.add('chainring', gearGeo(B.rc, B.chainring, 0.012, 0.007), [0, 0, 0.22], null, { flat: true });
    this.add('chainring', new T.CylinderGeometry(B.rc * 0.55, B.rc * 0.55, 0.024, 5), [0, 0, 0.23], [HP, 0, 0], { k: 0.7, flat: true });
    this.anchor('chainring', this.bike, [0, bby + B.rc + 0.01, 0.22]);
    this.part('crank', this.crankset);
    this.add('crank', tubeGeo([0, 0, 0.27], [0.14, -0.3, 0.29], 0.02));
    this.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [0.14, -0.3, 0.34], null, { k: 0.5 });
    this.add('crank', tubeGeo([0, 0, -0.12], [-0.14, 0.3, -0.14], 0.02));
    this.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [-0.14, 0.3, -0.19], null, { k: 0.5 });
    this.add('crank', new T.CylinderGeometry(0.02, 0.02, 0.42, 10), [0, 0, 0.08], [HP, 0, 0]);
    this.anchor('crank', this.crankset, [0.14, -0.3, 0.34]);

    // Sprockets turn with the rear wheel.
    const sprocketPart = (i: number) => (B.n === 1 ? 'cassette' : i === 0 ? 'smallest_sprocket' : i === B.n - 1 ? 'largest_sprocket' : 'cassette');
    for (const id of new Set(B.cassette.map((_, i) => sprocketPart(i)))) this.part(id, this.rearHub);
    // smooth discs reaching the tooth tips, as in the prototype: teeth on a stack of sprockets read as noise on a phone
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
      const G = B.gears === 'derailleur' ? derGeom(B) : null;
      const bt = barrelTurn(B);
      // the housing ends on top of the derailleur body (at the barrel adjuster or a cable stop)
      const derTop: V3 = G ? [rx - 0.055, huby - 0.022 + (B.barrelAt === 'derailleur' ? bt.len / 2 : 0.012), G.zL] : [0, 0, 0];
      const end: V3 = G ? derTop : B.gears === 'hub' ? [rx + 0.035, huby - 0.02, zD + 0.02] : [0.05, bby + 0.1, 0.09];
      const loop: V3[] = G ? [[rx + 0.08, huby + 0.055, G.zL + 0.05], [rx - 0.0, huby + 0.07, G.zL + 0.035], [rx - 0.05, huby + 0.04, G.zL + 0.005]] : [];
      // along the down tube (u from the bottom bracket) or just above the top tube (at x)
      const dt = (u: number): V3 => [HB[0] * (1 - u), bby + (HB[1] - bby) * u, 0.06];
      const tt = (x: number, z: number): V3 => [x, ST[1] + ((x - ST[0]) / (HT[0] - ST[0])) * (HT[1] - ST[1]) + 0.04, z];
      const cs = stayPts(B, [0, bby], 0.1);
      const ss = stayPts(B, [ST[0], sy], 0.05);
      const off = (p: V3, dy: number, dz: number): V3 => [p[0], p[1] + dy, p[2] + dz];
      let start: V3[];
      if (B.bar === 'drop') {
        start = [[S[0] - 0.035, S[1] - 0.02, S[2] - 0.005], [C[0] + 0.07, C[1] - 0.012, 0.2], [C[0] + 0.015, C[1] - 0.02, 0.13], [C[0] - 0.03, C[1] - 0.07, 0.07]];
      } else {
        const head: V3 = [bt.pos[0] - bt.axis[0] * bt.len / 2, bt.pos[1], bt.pos[2] - bt.axis[2] * bt.len / 2];
        start = [head, [head[0] + 0.06, head[1] - 0.02, head[2] - 0.08], [hx + 0.08, hy - 0.04, 0.09]];
      }
      const path: V3[] = B.bar === 'drop'
        ? [...start, [HB[0] + 0.02, HB[1] + 0.01, 0.07], [HB[0] * 0.7, dt(0.7)[1], 0.06], dt(0.35), [0.05, bby - 0.07, 0.06], off(cs[1], 0.035, 0.02), off(cs[2], 0.04, 0.025), ...loop, end]
        : B.gears === 'gearbox'
          ? [...start, [HB[0] - 0.08, HB[1] - 0.05, 0.07], dt(0.4), end]
          : [...start, tt(HT[0] - 0.25, 0.08), tt(HT[0] - 0.45, 0.05), tt(-0.05, 0.05), tt(ST[0] + 0.02, 0.06), off(ss[1], 0.03, 0.02), off(ss[2], 0.035, 0.025), ...loop, end];
      this.add('shift_cable', curveGeo(path, 0.006, 96), null, null, { k: 0.6 });
      this.anchor('shift_cable', this.bike, B.bar === 'drop' ? off(cs[1], 0.05, 0.02) : tt(-0.05, 0.08));
      if (G && this.der) {
        // the inner wire from the housing end down to its clamp on the links, placed in setDer
        const wire = this.add('shift_cable', new T.CylinderGeometry(0.0035, 0.0035, 1, 6), null, null, { k: 1.3 });
        this.der.wire = wire;
        this.der.wireTop = [rx - 0.055, huby - 0.022 - (B.barrelAt === 'derailleur' ? bt.len / 2 : 0), G.zL];
      }
    }

    // Chain
    const z0 = B.zs[B.n - 1];
    this.circ = B.gears === 'derailleur'
      ? [
        { x: 0, y: bby, z: 0.22, r: B.rc, s: 1 },
        { x: rx, y: huby, z: z0, r: B.rs[0], s: 1 },
        { x: rx, y: huby - 0.2, z: z0, r: RP, s: -1 },
        { x: rx, y: huby - 0.3, z: z0, r: RP, s: 1 },
      ]
      : [
        { x: 0, y: bby, z: 0.22, r: B.rc, s: 1 },
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
    this.anchor('chain', this.bike, [-0.45, (bby + B.rc + huby + B.rs[mid]) / 2 + 0.03, 0.2]);
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

  /** Hanger, body with the H, L and B screws, parallelogram links, cage and pulleys. */
  private buildDerailleur(): void {
    const B = this.spec;
    const { rx, huby } = B;
    const G = derGeom(B);
    const { zH, zL, Bk } = G;

    // Hanger: a plate from the axle down and back to the derailleur bolt, with a tab the B screw rests on.
    this.part('derailleur_hanger');
    this.add('derailleur_hanger', polyGeo([[rx + 0.03, huby + 0.012], [rx + 0.022, huby - 0.03], [rx - 0.005, huby - 0.07], [rx - 0.035, huby - 0.082], [rx - 0.058, huby - 0.06], [rx - 0.068, huby - 0.03], [rx - 0.05, huby - 0.012], [rx - 0.018, huby + 0.03], [rx + 0.012, huby + 0.035]], zH, 0.009), null, null, { k: 0.8 });
    this.add('derailleur_hanger', new T.BoxGeometry(0.012, 0.022, 0.02), [rx - 0.069, huby - 0.026, zL - 0.004], null, { k: 0.8 });
    this.anchor('derailleur_hanger', this.bike, [rx - 0.035, huby - 0.07, zH + 0.01]);

    // Body (B-knuckle): a head on the hanger bolt, then down to the links' pivots.
    this.part('rear_derailleur');
    this.part('upper_pulley');
    const D = 'rear_derailleur';
    const [hbx, hby] = [G.Hb[0], G.Hb[1]];
    this.add(D, new T.CylinderGeometry(0.014, 0.014, zL - zH + 0.02, 12), [hbx, hby, (zH + zL) / 2 + 0.005], [HP, 0, 0], { k: 1.2 });
    const x0 = G.bodyX - 0.013;
    this.add(D, new T.BoxGeometry(hbx + 0.012 - x0, 0.04, 0.028), [(hbx + 0.012 + x0) / 2, hby + 0.006, zL], null, { k: 0.75 });
    this.add(D, new T.BoxGeometry(0.026, G.top - G.bottom, 0.022), [G.bodyX, (G.top + G.bottom) / 2, zL], null, { k: 0.75 });
    this.add(D, new T.BoxGeometry(Bk[0] - 0.013 - x0, 0.032, 0.022), [(Bk[0] - 0.013 + x0) / 2, Bk[1], zL], null, { k: 0.75 });
    this.add(D, new T.CylinderGeometry(0.006, 0.006, 0.034, 8), [Bk[0], Bk[1], zL], [0, 0, HP], { k: 1.2 });
    const links = [-0.01, 0.01].map(() => this.add(D, new T.BoxGeometry(0.022, 1, 0.005), null, null, { k: 0.95 }));
    const pk = this.add(D, new T.BoxGeometry(0.04, 0.03, 0.024), null, null, { k: 0.75 });
    const pin = this.add(D, new T.CylinderGeometry(0.006, 0.006, 0.034, 8), null, [0, 0, HP], { k: 1.2 });
    const arm = this.add(D, new T.CylinderGeometry(0.008, 0.008, 1, 10), null, null, { k: 0.7 });

    // Cage: two plates with the upper and lower pulley; turns about the upper pulley.
    const cage = new T.Group();
    this.cage = cage;
    this.parts.get(D)!.group.add(cage);
    const pw = B.chainW / 2 + 0.006;
    this.add('upper_pulley', gearGeo(RP, 11, 0.011), null, null, { parent: cage, k: 0.55, flat: true });
    this.add(D, gearGeo(RP, 11, 0.011), [0, -LC, 0], null, { parent: cage, k: 0.55, flat: true });
    this.add(D, slotGeo(0.03, 0.034, LC, 0.004), [0, 0, pw + 0.002], null, { parent: cage, k: 0.95 });
    // the inner plate starts below the upper pulley's axle, so it stays off the next larger sprocket
    this.add(D, slotGeo(0.014, 0.028, LC - 0.024, 0.004), [0, -0.024, -pw - 0.002], null, { parent: cage, k: 0.95 });
    for (const y of [0, -LC]) this.add(D, new T.CylinderGeometry(0.01, 0.01, 2 * pw + 0.012, 10), [0, y, 0], [HP, 0, 0], { parent: cage, k: 1.25 });
    this.anchor('upper_pulley', cage, [0, 0.01, 0.02]);
    this.anchor(D, cage, [0, -LC * 0.55, 0.03]);
    this.der = { G, links, pk, pin, arm, wire: null, wireTop: [0, 0, 0] };

    // Limit screws H (upper) and L on the back of the body, the B screw on top of its head:
    // all with their heads towards the back of the bike, where you turn them.
    this.screw('h_screw', [G.bodyX - 0.012, huby - 0.1, zL], [1, 0, 0]);
    this.screw('l_screw', [G.bodyX - 0.012, huby - 0.14, zL], [1, 0, 0]);
    this.screw('b_screw', [rx - 0.088, huby - 0.026, zL], [1, 0, 0]);

    // Barrel adjuster: on top of the body, or on the trigger shifter
    const bt = barrelTurn(B);
    const spin = this.turnable('barrel_adjuster', bt);
    const br = 0.013;
    this.add('barrel_adjuster', new T.CylinderGeometry(br, br, bt.len * 0.75, 10), [0, -bt.len * 0.125, 0], null, { parent: spin, flat: true });
    for (const y of [-0.3, 0, 0.3]) this.add('barrel_adjuster', new T.CylinderGeometry(br + 0.002, br + 0.002, 0.004, 10), [0, -bt.len * 0.125 + y * bt.len * 0.75, 0], null, { parent: spin, k: 0.8, flat: true });
    this.add('barrel_adjuster', new T.CylinderGeometry(br * 0.55, br * 0.55, bt.len * 0.25, 8), [0, bt.len * 0.375, 0], null, { parent: spin, k: 1.2 });
    this.add('barrel_adjuster', new T.BoxGeometry(0.006, 0.004, br * 2.2), [0, -bt.len / 2, 0], null, { parent: spin, dark: true });
    if (B.barrelAt !== 'derailleur') {
      // a plain cable stop on the derailleur
      this.add(D, new T.CylinderGeometry(0.01, 0.01, 0.024, 10), [rx - 0.055, huby - 0.022, zL], null, { k: 1.1 });
    }
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
    const { zs, rs, n } = this.spec;
    if (z >= zs[0]) return rs[0];
    if (z <= zs[n - 1]) return rs[n - 1];
    for (let i = 0; i < n - 1; i++) {
      if (z <= zs[i] && z >= zs[i + 1]) return rs[i] + (rs[i + 1] - rs[i]) * ((zs[i] - z) / (zs[i] - zs[i + 1]));
    }
    return rs[0];
  }

  /** Where the upper pulley sits for a derailleur position z and a gap: straight below the sprocket. */
  layout(z: number, gap: number): { r: number; a: number; gx: number; gy: number; lx: number; ly: number } {
    const B = this.spec;
    const r = this.rAtZ(z);
    const u = (r - B.rs[0]) / (B.rs[B.n - 1] - B.rs[0] || 1);
    const a = -0.55 + 0.5 * u;
    const gx = B.rx - 0.005;
    const gy = B.huby - r - gap - RP;
    return { r, a, gx, gy, lx: gx + LC * Math.sin(a), ly: gy - LC * Math.cos(a) };
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
      const B = this.spec;
      const L = this.layoutCirc(z, gap);
      this.cage.position.set(L.gx, L.gy, z);
      this.cage.rotation.z = L.a;
      const pv = pivotAt(B, d.G, z);
      const { Bk } = d.G;
      d.links.forEach((m, i) => {
        const dx = i ? 0.01 : -0.01;
        plate(m, [Bk[0] + dx, Bk[1], Bk[2]], [pv[0] + dx, pv[1], pv[2]], [1, 0, 0]);
      });
      d.pk.position.set(...pv);
      d.pin.position.set(...pv);
      const pw = B.chainW / 2 + 0.006;
      seg(d.arm, pv, [L.gx, L.gy, z + pw + 0.008]);
      if (d.wire) {
        const k = 0.35;
        seg(d.wire, d.wireTop, [Bk[0] + (pv[0] - Bk[0]) * k + 0.013, Bk[1] + (pv[1] - Bk[1]) * k, Bk[2] + (pv[2] - Bk[2]) * k]);
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
      tD.set(pt.dx, pt.dy, pt.dz).normalize();
      Q.quaternion.setFromUnitVectors(this.AX, tD);
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

/**
 * Control points of a drive-side stay from `from` (at z0) to the dropout: straight in the frame
 * plane, bending out to the dropout's z where it passes the sprockets (0.45 units from the axle).
 */
function stayPts(B: BikeSpec, from: V2, z0: number): V3[] {
  const { rx, huby, zDrop } = B;
  const dx = from[0] - rx;
  const dy = from[1] - huby;
  const L = Math.hypot(dx, dy);
  const at = (d: number): V2 => [rx + (dx / L) * d, huby + (dy / L) * d];
  const a = at(0.45);
  const b = at(0.26);
  return [[from[0], from[1], z0], [a[0], a[1], z0 + (zDrop - z0) * 0.55], [b[0], b[1], zDrop], [rx, huby, zDrop]];
}
