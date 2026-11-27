// Session E: library parts placed per bike (crank, pedals, saddle, collar, stem, bar, grips), how the flipped bike rests,
// the pedal animation without strobing, and the budgets of the whole bike.

import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { PEDAL, CRANK_SPIN, WHEEL_MAX_STEP, wheelStep } from '../src/stage/anim.js';
import { BikeModel, bikeSpec, GEOMETRY_RANGES, GROUND } from '../src/stage/bike.js';
import { MOUNTS as M } from '../src/stage/mounts.js';
import { mixPose, poseVals, type PoseVals } from '../src/stage/pose.js';
import { PARK_HIDES, PARK_STEER, WALL_GAP, wallDist } from '../src/stage/park.js';
import { wallFor } from '../src/stage/wall.js';
import { RING_T, xfPt } from '../src/stage/spec.js';
import { chainringGeo, sprocketGeo } from '../src/stage/geo.js';

const mat = new T.MeshStandardMaterial();

/** one bike of every kind of cassette: road 8-12, city 5/7-10, MTB 8-13 */
const KINDS = ([['road_gravel', [8, 9, 10, 11, 12]], ['trekking_city', [5, 7, 8, 9, 10]], ['mtb', [8, 9, 10, 11, 12, 13]]] as const)
  .flatMap(([cat, ns]) => ns.map((n) => ({ 'bike.category': cat, 'drive.gear_type': 'derailleur', 'drive.rear_speeds': n })));
/** the three bikes of the budget: road 11, city 8, MTB 12 (what session A recorded before this round) */
const BUDGET = [
  { facts: { 'bike.category': 'road_gravel', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 11, 'bike.handlebar': 'drop' }, meshes: 148 },
  { facts: { 'bike.category': 'trekking_city', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 8, 'bike.handlebar': 'flat' }, meshes: 152 },
  { facts: { 'bike.category': 'mtb', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 12, 'bike.handlebar': 'riser' }, meshes: 161 },
];

/** a bike point in the world, in the given pose values (the holder's turn about z after the bike's turn about x) */
function world(v: PoseVals, p: ArrayLike<number>): [number, number, number] {
  const c = Math.cos(v.rrx);
  const s = Math.sin(v.rrx);
  const x1 = p[0] + v.rx;
  const y1 = c * p[1] - s * p[2] + v.ry;
  const ch = Math.cos(v.hrz);
  const sh = Math.sin(v.hrz);
  return [ch * x1 - sh * y1 + v.hx, sh * x1 + ch * y1 + v.hy, s * p[1] + c * p[2] + v.rz];
}

/** every vertex of the meshes of a part (or of the whole bike) in bike space; the dense library meshes every `stride`-th */
function vertices(m: BikeModel, id: string | null, stride = 2): T.Vector3[] {
  m.bike.updateMatrixWorld(true);
  const out: T.Vector3[] = [];
  const root = id ? m.parts.get(id)!.group : m.bike;
  root.traverse((o: any) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += stride) out.push(new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
  });
  return out;
}

describe('pedal animation without strobing', () => {
  it('the pedals and the crank clip turn slowly, and the wheel is drawn to turn at most 0.12 rad a picture', () => {
    expect(PEDAL).toBe(2.1);
    expect(CRANK_SPIN).toBe(1.3);
    expect(WHEEL_MAX_STEP).toBe(0.12);
    for (const dt of [1 / 60, 1 / 30]) {
      expect(Math.abs(wheelStep(19, dt))).toBeLessThanOrEqual(0.12 + 1e-12);
      expect(wheelStep(19, dt)).toBeGreaterThan(0);
      expect(wheelStep(-19, dt)).toBeLessThan(0);
      expect(wheelStep(0, dt)).toBe(0);
    }
    // slow turns are drawn as they are
    expect(wheelStep(3, 1 / 60)).toBeCloseTo(0.05);
  });

  it('in every gear of every cassette the sprocket block moves under half a tooth a picture, the wheel at most 0.12 rad', () => {
    for (const facts of KINDS) {
      const B = bikeSpec(facts);
      for (const speed of [PEDAL, CRANK_SPIN]) {
        const dt = 1 / 60;
        // the freewheel: the rear wheel turns at crank rate x chainring radius / sprocket radius
        for (let i = 0; i < B.n; i++) {
          const rate = (speed * B.rc) / B.rs[i];
          const blockStep = rate * dt;
          expect(blockStep, `${JSON.stringify(facts)} gear ${i} at ${speed} rad/s`).toBeLessThan(Math.PI / B.cassette[i]);
          for (const d of [1 / 60, 1 / 30]) expect(Math.abs(wheelStep(rate, d))).toBeLessThanOrEqual(WHEEL_MAX_STEP + 1e-12);
        }
        // the chainring itself
        expect(speed * dt).toBeLessThan(Math.PI / B.chainring);
      }
    }
  });
});

describe('library parts, placed per bike', () => {
  it('the pedals stay level while the crank turns and sit on the crank arms\' ends', () => {
    const m = new BikeModel(bikeSpec({ 'bike.category': 'road_gravel' }), mat);
    const arm = Math.hypot(...M.crank.pedalDrive);
    for (const theta of [0, 0.7, 2.1, -1.3, 4]) {
      m.setCrank(theta);
      m.bike.updateMatrixWorld(true);
      expect(m.pedals.length).toBe(2);
      let first = new T.Vector3();
      for (const [i, p] of m.pedals.entries()) {
        const e = new T.Euler().setFromRotationMatrix(p.matrixWorld);
        expect(Math.abs(e.z)).toBeLessThan(1e-6);
        const at = new T.Vector3().setFromMatrixPosition(p.matrixWorld);
        expect(Math.hypot(at.x, at.y - m.spec.bby)).toBeCloseTo(arm, 4);
        if (i === 0) first = at;
        // the pedals are opposite each other about the bottom bracket
        else expect(at.x + first.x).toBeCloseTo(0, 4);
        if (i === 1) expect(at.y + first.y).toBeCloseTo(2 * m.spec.bby, 4);
      }
    }
  });

  it('the chain line is the crank\'s: the chainring lies on the spider, and the cassette is centred on it', () => {
    for (const facts of KINDS.filter((_, i) => i % 4 === 0)) {
      const B = bikeSpec(facts);
      expect(B.chainline).toBeCloseTo(M.crank.ringFaceZ + RING_T / 2, 9);
      const m = new BikeModel(B, mat);
      const ring = m.parts.get('chainring')!.group.children[0] as T.Mesh;
      expect(ring.position.z).toBeCloseTo(B.chainline, 9);
    }
  });

  it('stem, collar and saddle sit where the geometry puts them, also with extreme geometry', () => {
    const keys = Object.keys(GEOMETRY_RANGES);
    const cases: Array<Record<string, unknown>> = [{}];
    for (const end of [0, 1]) cases.push(Object.fromEntries(keys.map((k) => [`geometry.${k}`, GEOMETRY_RANGES[k][end]])));
    for (const [i, g] of cases.entries()) {
      for (const bar of ['drop', 'flat', 'riser']) {
        const B = bikeSpec({ 'bike.category': ['mtb', 'road_gravel', 'trekking_city'][i % 3], 'bike.handlebar': bar, ...g });
        // the stem's foot on the head tube's top, lifted by the spacers along the steering axis
        const ha = Math.atan2(B.HT[1] - B.HB[1], B.HB[0] - B.HT[0]);
        const foot = xfPt(B.xf, [M.stem.axisP[0] + M.stem.axisD[0] * M.stem.footT, M.stem.axisP[1] + M.stem.axisD[1] * M.stem.footT]);
        expect(foot[0]).toBeCloseTo(B.HT[0] - Math.cos(ha) * B.spacer, 9);
        expect(foot[1]).toBeCloseTo(B.HT[1] + Math.sin(ha) * B.spacer, 9);
        expect(B.spacer).toBe(bar === 'riser' ? 0.04 : 0);
        // the stem's axis keeps the library's direction relative to the head tube: it is turned to the head angle
        const dir: [number, number] = [-Math.cos(ha), Math.sin(ha)];
        const tip = xfPt(B.xf, [M.stem.axisP[0] + M.stem.axisD[0] * M.stem.topT, M.stem.axisP[1] + M.stem.axisD[1] * M.stem.topT]);
        const along = ((tip[0] - foot[0]) * dir[0] + (tip[1] - foot[1]) * dir[1]) / (M.stem.topT - M.stem.footT);
        expect(along).toBeCloseTo(1, 4);
        // the saddle's clamp is on the seat tube's axis, above its top by the post's length
        const sx = B.saddleH[0] - B.ST[0];
        const sy = B.saddleH[1] - B.ST[1];
        expect(Math.abs(sx * B.seatD[1] - sy * B.seatD[0])).toBeLessThan(1e-9);
        expect(sx * B.seatD[0] + sy * B.seatD[1]).toBeGreaterThan(0.2);
        // the bar's centre is at the stem's clamp
        expect(B.C).toEqual(xfPt(B.xf, M.stem.clamp));
      }
    }
  });
});

describe('how the bike is held', () => {
  it('flipped, the bike rests on the saddle and the grips (or the hoods), not floating and not sunk', () => {
    for (const { facts } of BUDGET) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const v = poseVals('flipped', m.spec);
      const lowest = (id: string | null) => vertices(m, id, 1).reduce((a, p) => Math.min(a, world(v, [p.x, p.y, p.z])[1]), Infinity);
      // the saddle's highest vertex touches the ground
      expect(lowest('saddle')).toBeGreaterThan(GROUND - 0.002);
      expect(lowest('saddle')).toBeLessThan(GROUND + 0.002);
      // the bar's grips (flat, riser) or hoods (drop) touch it too
      const bar = lowest('handlebar');
      expect(bar).toBeGreaterThan(GROUND - 0.004);
      expect(bar).toBeLessThan(GROUND + (m.spec.bar === 'drop' ? 0.02 : 0.004));
      // and nothing else of the bike is below the ground
      expect(lowest(null)).toBeGreaterThan(GROUND - 0.004);
    }
  });

  it('the work stand clamps the seat post, between the collar and the saddle', () => {
    for (const { facts } of BUDGET) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      const clamp = m.parts.get('stand_clamp')!.group.position;
      // the clamp's centre is on the post's axis, in height between the seat tube's top and the saddle's clamp
      const t = (clamp.y - 0.3 - B.ST[1]) / B.seatD[1];
      expect(t).toBeGreaterThan(0.05);
      expect(t).toBeLessThan((B.saddleH[1] - B.ST[1]) / B.seatD[1] - 0.05);
      expect(clamp.x).toBeCloseTo(B.ST[0] + B.seatD[0] * t, 2);
    }
  });

  // the three budget bikes (drop, flat with a kickstand, riser) and the unknown bike (flat, kickstand, hub gear)
  const PARKED = [...BUDGET.map((b) => b.facts), {}, { 'bike.category': 'trekking_city', 'drive.gear_type': 'hub', 'bike.handlebar': 'riser' }];

  it('parked, the bike leans on the wall with its rear tyre only, and stands on both tyres', () => {
    for (const facts of PARKED) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const line = wallFor(m)!;
      expect(line).not.toBeNull();
      // a wall at an angle, closest at the rear, but not across the bike
      expect(line.angle).toBeGreaterThan(0);
      expect(line.angle).toBeLessThan(0.4);
      const v = poseVals('parked', m.spec);
      m.setSteer(v.steer);
      const pts = (id: string | null) => vertices(m, id, 1).map((p) => world(v, [p.x, p.y, p.z]));
      const near = (id: string | null) => pts(id).reduce((a, p) => Math.min(a, wallDist(line, [p[0], p[2]])), Infinity);
      // the rear tyre touches the wall (its mesh lies on the torus the wall was placed by) and does not go into it
      expect(near('rear_wheel')).toBeGreaterThan(-1e-6);
      expect(near('rear_wheel')).toBeLessThan(0.005);
      // every other part that is drawn stays off it
      for (const id of m.parts.keys()) {
        if (id === 'rear_wheel' || PARK_HIDES.includes(id)) continue;
        expect(near(id), id).toBeGreaterThanOrEqual(WALL_GAP - 1e-9);
      }
      // both tyres still stand on the ground: the lean is about the line they stand on, the turned front wheel dips little
      const lowest = (id: string) => pts(id).reduce((a, p) => Math.min(a, p[1]), Infinity);
      expect(Math.abs(lowest('rear_wheel') - GROUND)).toBeLessThan(0.002);
      expect(Math.abs(lowest('front_wheel') - GROUND)).toBeLessThan(0.006);
      // it leans towards the wall: the saddle moves to -z
      expect(v.rrx).toBeLessThan(0);
    }
  });

  it('parking eases in without lifting the bike, and only the parked pose has a wall and a turned bar', () => {
    const B = bikeSpec({});
    for (const p of ['ground', 'stand', 'hung', 'flipped'] as const) {
      expect(poseVals(p, B).wall).toBe(0);
      expect(poseVals(p, B).steer).toBe(0);
    }
    const g = poseVals('ground', B);
    const pk = poseVals('parked', B);
    expect(pk.wall).toBe(1);
    expect(pk.steer).toBe(PARK_STEER);
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const mid = mixPose(g, pk, k);
      expect(mid.hy).toBe(0);
      expect(mid.wall).toBeCloseTo(k, 12);
    }
  });
});

describe('budgets of the whole bike (05-plan.md)', () => {
  it('a road, a city and an MTB bike draw at most 150k triangles and no more meshes than before the round', () => {
    for (const { facts, meshes } of BUDGET) {
      const m = new BikeModel(bikeSpec(facts), mat);
      let count = 0;
      let tris = 0;
      for (const root of [m.bike, m.standG, m.hookG]) {
        root.traverse((o: any) => {
          if (!o.isMesh) return;
          count++;
          const g = o.geometry as T.BufferGeometry;
          tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        });
      }
      expect(count, JSON.stringify(facts)).toBeLessThanOrEqual(meshes);
      expect(tris, JSON.stringify(facts)).toBeLessThanOrEqual(150_000);
    }
  });
});

describe('look: toothed plates have depth', () => {
  it('sprockets and the chainring carry vertex shade, dark at hole edges and gaps, full on tooth tips', () => {
    for (const g of [sprocketGeo(11, 0.004), sprocketGeo(34, 0.004), chainringGeo(50, 0.0025, 5, 0.048, 0)]) {
      const c = g.getAttribute('color');
      expect(c).toBeTruthy();
      const vals = Array.from({ length: c.count }, (_, i) => c.getX(i));
      expect(Math.min(...vals)).toBeLessThan(0.75);
      expect(Math.max(...vals)).toBeGreaterThan(0.99);
    }
  });
});

describe('look: the chain has pins and shade', () => {
  it('draws outer links with pin holes and every link piece with vertex shade, in two instanced meshes', () => {
    const m = new BikeModel(bikeSpec({ 'bike.category': 'road_gravel', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 11 }), mat);
    for (const mesh of [m.chainInner, m.chainOuter]) {
      const c = mesh.geometry.getAttribute('color');
      expect(c).toBeTruthy();
      const vals = Array.from({ length: c.count }, (_, i) => c.getX(i));
      expect(Math.min(...vals)).toBeLessThan(0.6);
      expect(Math.max(...vals)).toBeGreaterThan(0.69);
    }
    // the outer link has more triangles than the inner one: holes in its plates
    expect(m.chainOuter.geometry.getAttribute('position').count).toBeGreaterThan(m.chainInner.geometry.getAttribute('position').count);
    m.dispose();
  });
});
