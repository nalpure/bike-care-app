// The generated bike, ported from the prototype (toBike, buildBike, buildStand, updateDer).
// bikeSpec() turns the bike's facts into dimensions; BikeModel builds the meshes, one part per
// registry node, and moves the derailleur, the chain and the cranks.
//
// Units: 1 scene unit = 0.5 m. x points to the front wheel, y up, z to the drive side.

import * as T from 'three';
import { buildPath, newPath, pointAt, type Circle } from './chain.js';

export const TAU = Math.PI * 2;
export const HP = Math.PI / 2;
export const PITCH = 0.0254;
export const rOf = (teeth: number) => PITCH / (2 * Math.sin(Math.PI / teeth));
export const HUBY = 0.7;
export const RX = -0.9;
export const RT = 0.73;
export const LIFT = 0.3;
export const GROUND = -0.03;
/** gap between the upper pulley and the sprocket: right, too big, too small */
export const GAP_OK = 0.011;
export const GAP_BIG = 0.036;
export const GAP_SMALL = 0.004;
/** pulley radius and cage length */
export const RP = 0.04;
export const LC = 0.13;
/** bottom bracket height */
export const BBY = 0.35;
/** steering axis: 72° head angle */
const HEAD_COS = Math.cos((72 * Math.PI) / 180);
const HEAD_SIN = Math.sin((72 * Math.PI) / 180);

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
  FX: number;
  cassette: number[];
  chainring: number;
  tt: number;
  n: number;
  sp: number;
  zs: number[];
  rs: number[];
  rc: number;
  chainW: number;
  ST: V2;
  HT: V2;
  HB: V2;
  saddleY: number;
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

const known = (v: unknown) => v !== undefined && v !== null && v !== 'unknown';

/**
 * Dimensions from the bike's facts. Unknown facts give a generic city bike with a rear
 * derailleur and 8 sprockets, the most common case in the target market.
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
  const cassette = cassetteFor(kind, speeds);
  const n = cassette.length;
  const sp = n > 1 ? 0.16 / (n - 1) : 0.03;
  const ST: V2 = road ? [-0.2, 1.5] : [-0.22, 1.5];
  // Front end: the fork follows a 72° steering axis and is long enough for the wheel, and the
  // front wheel sits far enough forward that the tyre clears the down tube and the fork crown.
  // (The prototype's shorter front end let the wheel cut through both.) Road bikes get a shorter
  // head tube, so their bars sit lower. player/test/stage.test.ts checks the clearances.
  const HB: V2 = [1.05, 1.56];
  const headLen = road ? 0.15 : 0.22;
  const HT: V2 = [HB[0] - headLen * HEAD_COS, HB[1] + headLen * HEAD_SIN];
  const bar: BikeSpec['bar'] = road ? 'drop' : mtb ? 'riser' : 'flat';
  const [hx, hy] = HT;
  const C: V2 = [hx + 0.14, hy + 0.03];
  const S: V3 = bar === 'drop' ? [C[0] + 0.1, C[1] - 0.03, 0.21] : bar === 'riser' ? [hx - 0.04, hy + 0.125, 0.25] : [hx - 0.04, hy + 0.085, 0.27];
  const barTop: V2 = bar === 'drop' ? [S[0] - 0.05, S[1] + 0.04] : bar === 'riser' ? [hx - 0.04, hy + 0.18] : [hx - 0.04, hy + 0.14];
  return {
    kind, bar, gears,
    forkKind: mtb ? 'susp' : 'rigid',
    barrelAt: road ? 'derailleur' : 'shifter',
    motor: ebike === true || ebike === 'true',
    kickstand: kind === 'city',
    FX: 1.33,
    cassette,
    chainring: road ? 50 : mtb ? 32 : 44,
    tt: road ? 0.028 : mtb ? 0.07 : 0.045,
    n, sp,
    zs: cassette.map((_, i) => (n > 1 ? 0.32 - i * sp : 0.22)),
    rs: cassette.map(rOf),
    rc: rOf(road ? 50 : mtb ? 32 : 44),
    chainW: Math.min(0.02, sp * 0.7),
    ST, HT, HB,
    saddleY: road ? 1.8 : 1.76,
    C, S, barTop,
  };
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

function curveGeo(pts: V3[], r: number): T.BufferGeometry {
  return new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p))), 48, r, 8, false);
}

const tA = new T.Vector3();
const tB = new T.Vector3();
const tD = new T.Vector3();
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

  private armA: T.Mesh | null = null;
  private armB: T.Mesh | null = null;
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
    this.setDer(this.derZ, this.gap);
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

  // ---------------------------------------------------------------- build

  private build(): void {
    const B = this.spec;
    const road = B.kind === 'road';
    const { ST, HT, HB, C, S } = B;
    const [hx, hy] = HT;
    const FX = B.FX;

    // Wheels: built around their hubs so they can turn.
    const wheel = (id: string, hub: T.Group, cx: number) => {
      hub.position.set(cx, HUBY, 0);
      this.bike.add(hub);
      this.part(id, hub);
      const rm = RT - B.tt;
      const rim = RT - 2 * B.tt - 0.012;
      this.add(id, new T.TorusGeometry(rm, B.tt, 12, 56), null, null, { k: 0.45 });
      this.add(id, new T.TorusGeometry(rim, 0.02, 8, 56), null, null, { k: 1, tint: 'rims' });
      // axle; a hub gear also gets its thick hub shell
      this.add(id, new T.CylinderGeometry(0.032, 0.032, 0.5, 16), [0, 0, 0.12], [HP, 0, 0]);
      if (id === 'rear_wheel' && B.gears === 'hub') this.add(id, new T.CylinderGeometry(0.075, 0.075, 0.13, 20), null, [HP, 0, 0], { k: 0.8 });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU;
        this.add(id, tubeGeo([0, 0, i % 2 ? 0.03 : -0.03], [(rim - 0.01) * Math.cos(a), (rim - 0.01) * Math.sin(a), 0], 0.004), null, null, { k: 1.2 });
      }
      this.anchor(id, this.bike, [cx, HUBY + RT * 0.72, 0.05]);
    };
    wheel('rear_wheel', this.rearHub, RX);
    wheel('front_wheel', this.frontHub, FX);

    // Frame
    this.part('frame');
    const ft = (a: V3, b: V3, r: number) => this.add('frame', tubeGeo(a, b, r), null, null, { tint: 'frame' });
    const fr = B.kind === 'mountain' ? 0.03 : road ? 0.02 : 0.024;
    const dtR = fr + 0.004;
    const sy = ST[1] - (road ? 0.05 : 0);
    ft([0, BBY, 0], [ST[0], ST[1], 0], fr + (road ? 0.004 : 0));
    ft([ST[0], ST[1], 0], [HT[0], HT[1], 0], fr - 0.002);
    ft([HT[0], HT[1], 0], [HB[0], HB[1], 0], 0.03);
    ft([0, BBY, 0], [HB[0], HB[1], 0], fr + 0.004);
    ft([0, BBY, 0.1], [RX, HUBY, 0.1], 0.016);
    ft([ST[0], sy, 0.05], [RX, HUBY, 0.1], 0.012);
    ft([0, BBY, -0.1], [RX, HUBY, -0.1], 0.016);
    ft([ST[0], sy, -0.05], [RX, HUBY, -0.1], 0.012);
    this.add('frame', new T.CylinderGeometry(0.045, 0.045, 0.2, 18), [0, BBY, 0], [HP, 0, 0], { tint: 'frame' });
    this.makeDecal([0, BBY], HB, dtR);
    this.anchor('frame', this.bike, [HB[0] / 2, (BBY + HB[1]) / 2, 0.03]);

    if (B.motor) {
      this.part('motor');
      this.add('motor', new T.BoxGeometry(0.2, 0.2, 0.22), [0.0, BBY + 0.01, 0], null, { k: 0.6 });
      this.add('motor', tubeGeo([HB[0] - 0.12, HB[1] - 0.06, 0], [0.12, 0.5, 0], 0.05), null, null, { k: 0.55 });
    }

    // Seat post and saddle
    this.part('seat_post');
    this.add('seat_post', tubeGeo([ST[0], ST[1], 0], [ST[0] - 0.04, B.saddleY - 0.04, 0], 0.015), null, null, { k: 1.1 });
    this.part('saddle');
    this.add('saddle', new T.BoxGeometry(0.34, 0.05, 0.12), [-0.3, B.saddleY, 0], null, { k: 0.5 });
    this.add('saddle', new T.BoxGeometry(0.14, 0.035, 0.06), [-0.08, B.saddleY - 0.005, 0], null, { k: 0.5 });
    this.anchor('saddle', this.bike, [-0.3, B.saddleY + 0.04, 0]);

    // Fork
    this.part('fork');
    {
      const dl = Math.hypot(hx - HB[0], hy - HB[1]);
      const Cr: V2 = [HB[0] - ((hx - HB[0]) / dl) * 0.04, HB[1] - ((hy - HB[1]) / dl) * 0.04];
      if (B.forkKind === 'susp') {
        const fz = 0.095;
        const M: V2 = [FX + (Cr[0] - FX) * 0.5, HUBY + (Cr[1] - HUBY) * 0.5];
        for (const sd of [1, -1]) {
          this.add('fork', tubeGeo([FX, HUBY, sd * fz], [M[0], M[1], sd * fz], 0.024), null, null, { k: 0.9 });
          this.add('fork', tubeGeo([M[0], M[1], sd * fz], [Cr[0], Cr[1], sd * fz], 0.019), null, null, { k: 1.3 });
        }
        this.add('fork', tubeGeo([Cr[0], Cr[1], -fz - 0.01], [Cr[0], Cr[1], fz + 0.01], 0.022));
      } else {
        for (const z of [0.06, -0.06]) this.add('fork', tubeGeo([HB[0], HB[1], z], [FX, HUBY, z], 0.016));
      }
      this.add('fork', tubeGeo([Cr[0], Cr[1], 0], [HB[0], HB[1], 0], 0.02));
    }

    // Handlebar and shifter
    this.part('handlebar');
    const hasShifter = B.gears !== 'single';
    if (hasShifter) this.part('shifter_rear');
    if (B.bar === 'flat') {
      const b1: V2 = [hx - 0.04, hy + 0.12];
      this.add('handlebar', tubeGeo([hx, hy, 0], [b1[0], b1[1], 0], 0.018));
      this.add('handlebar', tubeGeo([b1[0], b1[1], -0.4], [b1[0], b1[1], 0.4], 0.015));
      this.add('handlebar', tubeGeo([b1[0], b1[1], 0.3], [b1[0], b1[1], 0.4], 0.021), null, null, { k: 0.45 });
      this.add('handlebar', tubeGeo([b1[0], b1[1], -0.4], [b1[0], b1[1], -0.3], 0.021), null, null, { k: 0.45 });
      if (hasShifter) this.add('shifter_rear', new T.BoxGeometry(0.1, 0.045, 0.06), [S[0], S[1], S[2]], null, { k: 0.7 });
    } else if (B.bar === 'riser') {
      this.add('handlebar', tubeGeo([hx, hy, 0], [hx - 0.02, hy + 0.08, 0], 0.02));
      for (const sd of [1, -1]) {
        this.add('handlebar', tubeGeo([hx - 0.02, hy + 0.08, 0], [hx - 0.02, hy + 0.08, sd * 0.14], 0.016));
        this.add('handlebar', tubeGeo([hx - 0.02, hy + 0.08, sd * 0.14], [hx - 0.04, hy + 0.16, sd * 0.3], 0.015));
        this.add('handlebar', tubeGeo([hx - 0.04, hy + 0.16, sd * 0.3], [hx - 0.04, hy + 0.16, sd * 0.4], 0.022), null, null, { k: 0.45 });
      }
      if (hasShifter) this.add('shifter_rear', new T.BoxGeometry(0.1, 0.045, 0.06), [S[0], S[1], S[2]], null, { k: 0.7 });
    } else {
      this.add('handlebar', tubeGeo([HT[0], HT[1], 0], [C[0], C[1], 0], 0.02));
      for (const sd of [1, -1]) {
        const z = sd * 0.21;
        this.add('handlebar', tubeGeo([C[0], C[1], 0], [C[0], C[1], z], 0.014));
        this.add('handlebar', curveGeo([[C[0], C[1], z], [C[0] + 0.1, C[1] + 0.01, z], [C[0] + 0.18, C[1] - 0.08, z], [C[0] + 0.16, C[1] - 0.19, z], [C[0] + 0.05, C[1] - 0.23, z]], 0.013));
      }
      if (hasShifter) {
        this.add('shifter_rear', new T.BoxGeometry(0.12, 0.065, 0.05), [S[0], S[1], S[2]], null, { k: 0.7 });
        this.add('shifter_rear', tubeGeo([S[0] + 0.03, S[1] - 0.03, S[2]], [S[0] + 0.09, S[1] - 0.14, S[2]], 0.008), null, null, { k: 0.5 });
      }
    }
    if (hasShifter) this.anchor('shifter_rear', this.bike, [S[0], S[1] + 0.05, S[2]]);

    // Kickstand, on the left, folded down
    if (B.kickstand) {
      this.part('kickstand');
      this.add('kickstand', new T.BoxGeometry(0.06, 0.03, 0.05), [-0.42, 0.47, -0.1], null, { k: 0.7 });
      this.add('kickstand', tubeGeo([-0.42, 0.46, -0.11], [-0.56, GROUND + 0.02, -0.34], 0.012), null, null, { k: 0.7 });
      this.add('kickstand', new T.BoxGeometry(0.07, 0.012, 0.04), [-0.56, GROUND + 0.012, -0.34], null, { k: 0.5 });
    }

    // Crankset: chainring, cranks and pedals turn together around the bottom bracket.
    this.crankset.position.set(0, BBY, 0);
    this.bike.add(this.crankset);
    this.part('chainring', this.crankset);
    this.add('chainring', new T.CylinderGeometry(B.rc, B.rc, 0.02, Math.min(B.chainring, 60)), [0, 0, 0.22], [HP, 0, 0], { flat: true });
    this.add('chainring', new T.CylinderGeometry(B.rc * 0.55, B.rc * 0.55, 0.024, 5), [0, 0, 0.23], [HP, 0, 0], { k: 0.7, flat: true });
    this.anchor('chainring', this.bike, [0, BBY + B.rc + 0.01, 0.22]);
    this.part('crank', this.crankset);
    this.add('crank', tubeGeo([0, 0, 0.27], [0.12, -0.25, 0.29], 0.02));
    this.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [0.12, -0.25, 0.34], null, { k: 0.5 });
    this.add('crank', tubeGeo([0, 0, -0.12], [-0.12, 0.25, -0.14], 0.02));
    this.add('crank', new T.BoxGeometry(0.1, 0.025, 0.08), [-0.12, 0.25, -0.19], null, { k: 0.5 });
    this.add('crank', new T.CylinderGeometry(0.02, 0.02, 0.42, 10), [0, 0, 0.08], [HP, 0, 0]);
    this.anchor('crank', this.crankset, [0.12, -0.25, 0.34]);

    // Sprockets turn with the rear wheel.
    const sprocketPart = (i: number) => (B.n === 1 ? 'cassette' : i === 0 ? 'smallest_sprocket' : i === B.n - 1 ? 'largest_sprocket' : 'cassette');
    for (const id of new Set(B.cassette.map((_, i) => sprocketPart(i)))) this.part(id, this.rearHub);
    B.cassette.forEach((t, i) => this.add(sprocketPart(i), new T.CylinderGeometry(B.rs[i], B.rs[i], B.sp * 0.5, Math.min(t, 48)), [0, 0, B.zs[i]], [HP, 0, 0], { k: 0.9, flat: true }));
    const mid = Math.floor(B.n / 2);
    if (B.n > 1) {
      this.anchor('smallest_sprocket', this.bike, [RX, HUBY + B.rs[0] + 0.015, B.zs[0]]);
      this.anchor('largest_sprocket', this.bike, [RX, HUBY + B.rs[B.n - 1] + 0.015, B.zs[B.n - 1]]);
    }
    this.anchor('cassette', this.bike, [RX, HUBY + B.rs[mid] + 0.015, B.zs[mid]]);

    if (B.gears === 'gearbox') this.add('frame', new T.BoxGeometry(0.22, 0.2, 0.16), [0, BBY, 0], null, { k: 0.6 });

    // Rear derailleur
    if (B.gears === 'derailleur') {
      this.part('derailleur_hanger');
      this.add('derailleur_hanger', new T.BoxGeometry(0.05, 0.1, 0.014), [RX - 0.015, 0.675, 0.108], [0, 0, -0.25], { k: 0.8 });
      this.part('rear_derailleur');
      this.part('upper_pulley');
      this.add('rear_derailleur', new T.BoxGeometry(0.05, 0.12, 0.06), [RX - 0.03, 0.64, 0.1]);
      this.armA = this.add('rear_derailleur', new T.BoxGeometry(0.016, 1, 0.016), null, null, { k: 0.85 });
      this.armB = this.add('rear_derailleur', new T.BoxGeometry(0.016, 1, 0.016), null, null, { k: 0.85 });
      const cage = new T.Group();
      this.cage = cage;
      this.parts.get('rear_derailleur')!.group.add(cage);
      const pw = B.chainW / 2 + 0.006;
      this.add('upper_pulley', new T.CylinderGeometry(RP, RP, 0.014, 16), [0, 0, 0], [HP, 0, 0], { parent: cage, k: 0.7, flat: true });
      this.add('rear_derailleur', new T.CylinderGeometry(RP, RP, 0.012, 16), [0, -LC, 0], [HP, 0, 0], { parent: cage, k: 0.7, flat: true });
      this.add('rear_derailleur', tubeGeo([0, 0, pw], [0, -LC, pw], 0.008), null, null, { parent: cage });
      this.add('rear_derailleur', tubeGeo([0, 0, -pw], [0, -LC, -pw], 0.008), null, null, { parent: cage });
      this.anchor('upper_pulley', cage, [0, 0.01, 0.02]);
      this.anchor('rear_derailleur', cage, [0, -LC * 0.55, 0.03]);
      this.anchor('derailleur_hanger', this.bike, [RX - 0.015, 0.71, 0.11]);

      const screw = (id: string, px: number, py: number) => {
        const p = this.part(id, this.bike, [px, py, 0.1]);
        this.add(id, new T.CylinderGeometry(0.015, 0.015, 0.03, 14), [-0.01, 0, 0], [0, 0, HP]);
        this.add(id, new T.BoxGeometry(0.004, 0.006, 0.026), [-0.026, 0, 0], null, { dark: true });
        this.anchors.set(id, p.group);
      };
      screw('h_screw', RX - 0.06, 0.67);
      screw('l_screw', RX - 0.06, 0.61);
      screw('b_screw', RX + 0.058, 0.655);

      const barrel = this.part('barrel_adjuster');
      if (B.barrelAt === 'shifter') {
        barrel.group.position.set(S[0] - 0.075, S[1], S[2]);
        this.add('barrel_adjuster', new T.CylinderGeometry(0.02, 0.02, 0.05, 8), null, [0, 0, HP], { flat: true });
        this.add('barrel_adjuster', new T.BoxGeometry(0.01, 0.006, 0.008), [0, 0.02, 0], null, { dark: true });
      } else {
        barrel.group.position.set(RX - 0.03, 0.725, 0.1);
        this.add('barrel_adjuster', new T.CylinderGeometry(0.016, 0.016, 0.04, 8), null, null, { flat: true });
        this.add('barrel_adjuster', new T.BoxGeometry(0.008, 0.008, 0.006), [0.015, 0.012, 0], null, { dark: true });
      }
      barrel.basePos.copy(barrel.group.position);
      this.anchors.set('barrel_adjuster', barrel.group);
    }

    // Gear cable from the shifter to the derailleur (or the hub, or the gearbox)
    if (hasShifter) {
      this.part('shift_cable');
      const end: V3 = B.gears === 'derailleur'
        ? (B.barrelAt === 'shifter' ? [RX - 0.03, 0.705, 0.1] : [RX - 0.03, 0.75, 0.1])
        : B.gears === 'hub' ? [RX + 0.06, HUBY + 0.02, 0.1] : [0.05, BBY + 0.1, 0.09];
      // along the down tube (u from the bottom bracket) or just above the top tube (at x)
      const dt = (u: number): V3 => [HB[0] * (1 - u), BBY + (HB[1] - BBY) * u, 0.06];
      const tt = (x: number, z: number): V3 => [x, ST[1] + ((x - ST[0]) / (HT[0] - ST[0])) * (HT[1] - ST[1]) + 0.04, z];
      const path: V3[] = B.bar === 'drop'
        ? [[S[0] - 0.02, S[1] - 0.03, S[2]], [C[0] - 0.02, C[1] - 0.1, 0.17], [HB[0] - 0.03, HB[1] + 0.0, 0.08], [HB[0] * 0.7, dt(0.7)[1], 0.06], dt(0.35), [0.05, 0.42, 0.06], [-0.4, 0.52, 0.12], [RX + 0.12, 0.62, 0.12], end]
        : B.gears === 'gearbox'
          ? [[S[0] - 0.1, S[1], S[2]], tt(HT[0] - 0.25, 0.12), [HB[0] - 0.08, HB[1] - 0.05, 0.07], dt(0.4), end]
          : [[S[0] - 0.1, S[1], S[2]], tt(HT[0] - 0.25, 0.12), tt(HT[0] - 0.45, 0.05), tt(-0.1, 0.05), tt(-0.22, 0.06), [-0.56, 1.12, 0.1], [RX + 0.03, 0.82, 0.12], end];
      this.add('shift_cable', curveGeo(path, 0.006), null, null, { k: 0.6 });
      this.anchor('shift_cable', this.bike, B.bar === 'drop' ? [-0.4, 0.55, 0.12] : [-0.4, 1.36, 0.08]);
    }

    // Chain
    const z0 = B.zs[B.n - 1];
    this.circ = B.gears === 'derailleur'
      ? [
        { x: 0, y: BBY, z: 0.22, r: B.rc, s: 1 },
        { x: RX, y: HUBY, z: z0, r: B.rs[0], s: 1 },
        { x: RX, y: 0.5, z: z0, r: RP, s: -1 },
        { x: RX, y: 0.4, z: z0, r: RP, s: 1 },
      ]
      : [
        { x: 0, y: BBY, z: 0.22, r: B.rc, s: 1 },
        { x: RX, y: HUBY, z: B.zs[0], r: B.rs[0], s: 1 },
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
    this.anchor('chain', this.bike, [-0.45, (BBY + B.rc + HUBY + B.rs[mid]) / 2 + 0.03, 0.2]);
  }

  private buildStand(): void {
    const B = this.spec;
    const cx = B.ST[0] - 0.03;
    const cz = -0.34;
    const cy = 1.62 + LIFT;
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
    return new T.Vector3(-0.17, this.spec.saddleY - 0.03, 0);
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

  /** Where the upper pulley sits for a derailleur position z and a gap. */
  layout(z: number, gap: number): { r: number; a: number; gx: number; gy: number; lx: number; ly: number } {
    const B = this.spec;
    const r = this.rAtZ(z);
    const u = (r - B.rs[0]) / (B.rs[B.n - 1] - B.rs[0] || 1);
    const a = -0.55 + 0.5 * u;
    const gx = RX - 0.005;
    const gy = HUBY - r - gap - RP;
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
    if (this.cage && this.armA && this.armB) {
      const L = this.layoutCirc(z, gap);
      this.cage.position.set(L.gx, L.gy, z);
      this.cage.rotation.z = L.a;
      seg(this.armA, [RX - 0.03, 0.585, 0.1], [L.gx, L.gy + 0.022, z]);
      seg(this.armB, [RX - 0.03, 0.625, 0.1], [L.gx, L.gy + 0.052, z]);
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
