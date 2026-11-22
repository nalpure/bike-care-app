// The generated bike: BikeModel builds the meshes, one part per registry node (frame, wheels,
// fork, stand, hook, name decal), and moves the derailleur, the chain and the cranks (setDer).
// bikeSpec() (spec.ts) turns the bike's facts into dimensions. The rest is split by area:
// drivetrain.ts (chainring, cranks, sprockets, chain), derailleur.ts, cockpit.ts, geo.ts.
// This file re-exports every name it exported before the split.
//
// Units: 1 scene unit = 0.5 m. x points to the front wheel, y up, z to the drive side.
// The drivetrain is drawn at its real size: sprocket spacing, sprocket and chain width, teeth and
// links (see the rules in bikeSpec).

import * as T from 'three';
import { buildCockpit, buildShiftCable } from './cockpit.js';
import { buildChain, buildCrankset, layChain, rAt } from './drivetrain.js';
import { buildDerailleur, derLayout, moveDerailleur, spinPulleys, type DerParts, type Turn } from './derailleur.js';
import { curveGeoSplit, disposeTree, hullShape, slabGeo, tubeGeo, UP } from './geo.js';
import { libGeo } from './library.js';
import { MOUNTS as M } from './mounts.js';
import { batteryLine, GAP_OK, GROUND, HP, LIFT, stayPts, stayZ, TAU, type BikeSpec, type V2, type V3 } from './spec.js';
import { SPLIT_PARTS } from './registry.js';
import { newPath, type Circle } from './chain.js';
import type { Pins } from './pins.js';

export * from './spec.js';
export { disposeTree, seg } from './geo.js';
export { barrelTurn, fitFor, lowerPulley, upperPulley, type Turn } from './derailleur.js';
export { rAt } from './drivetrain.js';

// ------------------------------------------------------------------ parts

export interface Part {
  id: string;
  group: T.Group;
  mats: T.MeshStandardMaterial[];
  /** outline materials (dark edges that give small parts their shape) */
  lines: T.LineBasicMaterial[];
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

/** How far from the rear axle the stays belong to the part `frame_dropout`: 13 cm (1 unit = 0.5 m). */
const STAY_END = 0.26;

/** Context groups: focus on one part keeps the others of its group visible. */
const CTX: Record<string, string[]> = {
  frame: ['frame'],
  frame_dropout: ['frame'],
  fork: ['front', 'frame'],
  front_wheel: ['front'],
  rear_wheel: ['drive', 'rear'],
  rear_hub: ['drive', 'rear'],
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

/** Parts drawn with outlines: the small mechanical ones a step points at. */
const OUTLINED = new Set(['rear_derailleur', 'upper_pulley', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'barrel_adjuster', 'shifter_rear', 'brake_lever', 'crank', 'chainring', 'cassette', 'smallest_sprocket', 'largest_sprocket', 'kickstand', 'stand_clamp']);


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
  /** the pedals' hanging groups (on the crank's ends): setCrank turns them back so they stay level */
  readonly pedals: T.Group[] = [];
  readonly rearHub = new T.Group();
  readonly frontHub = new T.Group();
  cage: T.Group | null = null;
  /** the rope of the hook, a unit-height mesh placed each frame */
  rope!: T.Mesh;
  /** the derailleur's current z and gap, the chain's travel along its path */
  derZ: number;
  gap = GAP_OK;
  chainShift = 0;

  /** @internal builder state */
  der: DerParts | null = null;
  /** @internal builder state */
  chainInner!: T.InstancedMesh;
  /** @internal builder state */
  chainOuter!: T.InstancedMesh;
  /** @internal builder state */
  pins!: Pins;
  /** @internal builder state */
  readonly cassetteG = new T.Group();
  /** @internal builder state */
  circ: Circle[] = [];
  /** @internal builder state */
  path = newPath();
  /** @internal builder state */
  N = 0;
  /** the links laid now (at most N) */
  links = 0;
  /** the sprocket block's unwrapped angle, and the chainShift it belongs to (layChain keeps it turning the right way) */
  cassetteSpin = 0;
  cassetteShift = 0;
  private decal: { cv: HTMLCanvasElement; tex: T.CanvasTexture; mat: T.MeshBasicMaterial; key: string } | null = null;
  /** @internal builder state */
  Q = new T.Object3D();
  /** @internal builder state */
  pt = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };

  constructor(readonly spec: BikeSpec, readonly standMat: T.Material) {
    this.derZ = spec.zs[Math.floor(spec.n / 2)];
    this.build();
    this.buildStand();
    this.buildHook();
    this.setDer(this.derZ, this.gap);
    this.bike.updateMatrixWorld(true);
    this.standG.updateMatrixWorld(true);
    // A part cut out of another (SPLIT_PARTS) shares the centre of the whole, so that a motion on the
    // whole node moves all its pieces about the same point, as before the cut.
    const whole = new Map<string, T.Box3>();
    for (const p of this.parts.values()) {
      const root = SPLIT_PARTS[p.id] ?? p.id;
      whole.set(root, (whole.get(root) ?? new T.Box3()).union(new T.Box3().setFromObject(p.group)));
    }
    for (const p of this.parts.values()) {
      // A part whose meshes live elsewhere (the upper pulley sits in the cage) has an empty box;
      // it has its own anchor and is never moved by a generic motion.
      const box = whole.get(SPLIT_PARTS[p.id] ?? p.id)!;
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

  /** Turns the crank to theta (about the bottom bracket); the pedals turn the other way and stay level. */
  setCrank(theta: number): void {
    this.crankset.rotation.z = theta;
    for (const p of this.pedals) p.rotation.z = -theta;
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

  /** @internal builder helper */
  part(id: string, parent: T.Object3D = this.bike, pos?: V3): Part {
    const g = new T.Group();
    if (pos) g.position.set(...pos);
    parent.add(g);
    const p: Part = { id, group: g, mats: [], lines: [], ctx: CTX[id] ?? [], vis: 1, visT: 1, hot: 0, hotT: 0, fade: 1, basePos: g.position.clone(), center: new T.Vector3() };
    this.parts.set(id, p);
    return p;
  }

  /** @internal builder helper */
  add(id: string, geo: T.BufferGeometry, pos?: V3 | null, rot?: V3 | null, opt: MatOpt = {}): T.Mesh {
    const m = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.15, transparent: true, flatShading: !!opt.flat, vertexColors: !!geo.getAttribute('color') });
    m.userData.k = opt.k ?? 1;
    m.userData.dark = !!opt.dark;
    m.userData.tint = opt.tint ?? null;
    const mesh = new T.Mesh(geo, m);
    mesh.userData.partId = id;
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    (opt.parent ?? this.parts.get(id)!.group).add(mesh);
    const part = this.parts.get(id)!;
    part.mats.push(m);
    if (OUTLINED.has(id) && !opt.dark) {
      // dark edges where faces meet at a sharp angle: they show the shape when the colour is even.
      // 35 deg is also the crease angle of the library meshes; their edge counts barely change from 35 to 75 deg
      // (about 200-650 segments a piece), so there is no noise to tune away.
      if (!part.lines.length) part.lines.push(new T.LineBasicMaterial({ color: 0x2a323a, transparent: true }));
      const edges = new T.LineSegments(new T.EdgesGeometry(geo, 35), part.lines[0]);
      edges.raycast = () => {};
      mesh.add(edges);
    }
    return mesh;
  }

  /** @internal builder helper */
  anchor(node: string, parent: T.Object3D, at: V3): void {
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
  /** @internal builder helper */
  turnable(id: string, t: Turn, parent: T.Object3D = this.bike): T.Object3D {
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

  // ---------------------------------------------------------------- build

  private build(): void {
    const B = this.spec;
    const road = B.kind === 'road';
    const { ST, HT, HB, rx, huby, bby, zDrop: zD } = B;
    const [hx, hy] = HT;
    const FX = B.FX;

    // Wheels: built around their hubs so they can turn.
    const wheel = (id: string, hub: T.Group, cx: number) => {
      hub.position.set(cx, huby, 0);
      this.bike.add(hub);
      this.part(id, hub);
      // the rear hub is a part of its own (node rear_end); it turns with the wheel
      const rear = id === 'rear_wheel';
      const hubId = rear ? 'rear_hub' : id;
      if (rear) this.part(hubId, hub);
      const rm = B.rt - B.tt;
      const rim = B.rt - 2 * B.tt - 0.012;
      this.add(id, new T.TorusGeometry(rm, B.tt, 12, 56), null, null, { k: 0.45 });
      this.add(id, new T.TorusGeometry(rim, 0.02, 8, 56), null, null, { k: 1, tint: 'rims' });
      // axle from dropout to dropout, and the hub shell between the spoke flanges (inside the sprockets)
      const za = rear ? zD + 0.02 : 0.1;
      this.add(hubId, new T.CylinderGeometry(0.011, 0.011, 2 * za, 10), null, [HP, 0, 0], { k: 1.2 });
      const s1 = rear ? B.zs[B.n - 1] - 0.012 : 0.05;
      this.add(hubId, new T.CylinderGeometry(0.026, 0.026, s1 + 0.05, 16), [0, 0, (s1 - 0.05) / 2], [HP, 0, 0], { k: 0.9 });
      for (const fz of [0.03, -0.03]) this.add(hubId, new T.CylinderGeometry(0.034, 0.034, 0.006, 16), [0, 0, fz], [HP, 0, 0], { k: 0.9 });
      if (rear && B.gears === 'hub') this.add(hubId, new T.CylinderGeometry(0.075, 0.075, 0.13, 20), null, [HP, 0, 0], { k: 0.8 });
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
    // the dropout end of the stays and the dropout plates are a part of their own (node rear_end)
    this.part('frame_dropout');
    const ft = (a: V3, b: V3, r: number) => this.add('frame', tubeGeo(a, b, r), null, null, { tint: 'frame' });
    const fr = B.kind === 'mountain' ? 0.03 : road ? 0.02 : 0.024;
    const dtR = fr + 0.004;
    // the seat tube is as wide as the library collar's bore (a fixed size, like every library part)
    ft([0, bby, 0], [ST[0], ST[1], 0], M.seat.boreR);
    ft([ST[0], ST[1], 0], [HT[0], HT[1], 0], fr - 0.002);
    // head tube: 40 mm across, wide enough for the library stem's foot (a drawing value)
    ft([HT[0], HT[1], 0], [HB[0], HB[1], 0], 0.04);
    ft([0, bby, 0], [HB[0], HB[1], 0], fr + 0.004);
    // rear triangle on both sides; the dropouts sit just outside the sprockets
    for (const sd of [1, -1] as const) {
      for (const [which, r, seg] of [['chain', 0.016, 48], ['seat', 0.012, 40]] as const) {
        const [rest, end] = curveGeoSplit(stayPts(B, which, sd), r, seg, [rx, huby], STAY_END);
        if (rest) this.add('frame', rest, null, null, { tint: 'frame' });
        if (end) this.add('frame_dropout', end, null, null, { tint: 'frame' });
      }
      // dropout plate; on the drive side the hanger sits on its outside
      const dz = sd > 0 ? zD - 0.0095 : -zD;
      this.add('frame_dropout', slabGeo(hullShape([[rx, huby, 0.03], [rx + 0.045, huby - 0.012, 0.02], [rx + 0.02, huby + 0.04, 0.018]]), dz - 0.004, dz + 0.004, 0.002), null, null, { tint: 'frame' });
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

    // Seat post along the seat tube with the library collar on its top, and the library saddle on the post's end
    // (the saddle's own clamp barrel; level, not turned with the seat angle).
    this.part('seat_post');
    const [sx, sy] = B.saddleH;
    this.add('seat_post', tubeGeo([ST[0], ST[1], 0], [sx, sy, 0], M.seat.postR), null, null, { k: 1.1 });
    {
      const top = [M.seat.axisP[0] + M.seat.axisD[0] * M.seat.collarTop, M.seat.axisP[1] + M.seat.axisD[1] * M.seat.collarTop];
      const turn = Math.atan2(B.seatD[1], B.seatD[0]) - Math.atan2(M.seat.axisD[1], M.seat.axisD[0]);
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      this.add('seat_post', libGeo('seat_collar'), [ST[0] - (c * top[0] - s * top[1]), ST[1] - (s * top[0] + c * top[1]), 0], [0, 0, turn], { k: 0.8 });
    }
    this.part('saddle');
    this.add('saddle', libGeo('saddle'), [sx - M.saddle.head[0], sy - M.saddle.head[1], 0], null, { dark: true });
    this.anchor('saddle', this.bike, [sx + 0.1, sy + M.saddle.topY - M.saddle.head[1] + 0.01, 0]);

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

    buildCockpit(this);

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

    buildCrankset(this);

    if (B.gears === 'gearbox') this.add('frame', new T.BoxGeometry(0.22, 0.2, 0.16), [0, bby, 0], null, { k: 0.6 });

    const hasShifter = B.gears !== 'single';
    if (hasShifter) this.part('shift_cable');
    if (B.gears === 'derailleur') buildDerailleur(this);
    if (hasShifter) buildShiftCable(this);
    buildChain(this);
  }

  private buildStand(): void {
    const B = this.spec;
    // the clamp holds the post, 0.12 above the seat tube's top
    const cx = B.ST[0] + (B.seatD[0] / B.seatD[1]) * 0.12;
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
    const [hx, hy] = this.spec.saddleH;
    return new T.Vector3(hx + M.saddle.hook[0] - M.saddle.head[0], hy + M.saddle.hook[1] - M.saddle.head[1], 0);
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

  /** Where the pulleys sit for a derailleur position z and a gap (rd-fit.ts), with the sprocket radius there and the derailleur's state. */
  layout(z: number, gap: number): ReturnType<typeof derLayout> {
    return derLayout(this.spec, z, gap);
  }

  /** Moves the derailleur to z with the given gap, lays the chain along the new path and spins the pulleys with it. */
  setDer(z: number, gap: number): void {
    this.derZ = z;
    this.gap = gap;
    moveDerailleur(this, z, gap);
    layChain(this);
    spinPulleys(this);
  }

  /** z of the derailleur for sprocket i. */
  zOf(i: number): number {
    const { zs, n } = this.spec;
    return zs[Math.max(0, Math.min(n - 1, i))];
  }
}
