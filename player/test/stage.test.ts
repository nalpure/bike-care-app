// The 3D stage without a browser: the registry, the manifest, the bike builder, views and
// animations. WebGL itself is covered by the browser walk (npm run test:e2e).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { dirSign, makeAnim, type AnimCtx } from '../src/stage/anim.js';
import { batteryLine, BikeModel, bikeSpec, distSeg, GAP_OK, GEOMETRY_RANGES, GROUND, type BikeSpec } from '../src/stage/bike.js';
import { buildPath, newPath } from '../src/stage/chain.js';
import { CLIPS, LABEL_SCENES, manifest, modelOf, MOTIONS, NODES, partsOf, previewNode, VIEWS } from '../src/stage/registry.js';
import { viewPose } from '../src/stage/views.js';

const REPO = resolve(import.meta.dirname, '../..');
const mat = new T.MeshStandardMaterial();

/** Points along every edge of every mesh of the given parts, in bike space. */
function meshPoints(m: BikeModel, ids: string[], steps = 6): Array<{ part: string; p: T.Vector3 }> {
  m.bike.updateMatrixWorld(true);
  const out: Array<{ part: string; p: T.Vector3 }> = [];
  const a = new T.Vector3();
  const b = new T.Vector3();
  for (const id of ids) {
    m.parts.get(id)?.group.traverse((o: any) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.partId !== id) return;
      const pos = o.geometry.attributes.position;
      const idx = o.geometry.index;
      const count = idx ? idx.count : pos.count;
      const v = (i: number, t: T.Vector3) => t.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
      for (let i = 0; i + 2 < count; i += 3) {
        for (let e = 0; e < 3; e++) {
          v(i + e, a);
          v(i + ((e + 1) % 3), b);
          for (let k = 0; k <= steps; k++) out.push({ part: id, p: a.clone().lerp(b, k / steps) });
        }
      }
    });
  }
  return out;
}

/** The sprocket a point would cut into, or undefined. Sprocket teeth reach 0.0025 past the pitch circle. */
function hitsSprocket(B: BikeSpec, p: T.Vector3, halfWidth: number, halfHeight: number, skip = -1): number | undefined {
  const d = Math.hypot(p.x - B.rx, p.y - B.huby);
  for (let j = 0; j < B.n; j++) {
    if (j === skip) continue;
    if (Math.abs(p.z - B.zs[j]) < B.sp * 0.25 + halfWidth + 0.001 && d - halfHeight < B.rs[j] + 0.0025 + 0.002) return j;
  }
  return undefined;
}

/** Bikes with a derailleur: every kind and number of speeds the builder knows. */
const DER_BIKES = ['mtb', 'road_gravel', 'trekking_city'].flatMap((cat) => [5, 8, 9, 11, 12, 13].map((n) => ({ 'bike.category': cat, 'drive.gear_type': 'derailleur', 'drive.rear_speeds': n })));

function ctxFor(m: BikeModel, focus: string[] = []): AnimCtx {
  return {
    spec: m.spec, focus, poseBefore: 'ground', pose: 'ground',
    zOf: (i) => m.zOf(i),
    centerOf: (p) => {
      const x = m.parts.get(p);
      return x ? [x.center.x, x.center.y, x.center.z] : undefined;
    },
  };
}

describe('3D registry and manifest', () => {
  it('build/3d-manifest.json is the registry export (run npm run manifest after changing the registry)', () => {
    const file = JSON.parse(readFileSync(join(REPO, 'build/3d-manifest.json'), 'utf8'));
    expect(file).toEqual(manifest());
  });

  it('provides every name of the interim catalog schema/3d-catalog.yaml', () => {
    const cat = YAML.parse(readFileSync(join(REPO, 'schema/3d-catalog.yaml'), 'utf8'));
    const m = manifest();
    expect(cat.nodes.filter((n: string) => !m.nodes.includes(n))).toEqual([]);
    expect(cat.views.filter((n: string) => !m.views.includes(n))).toEqual([]);
    expect(cat.clips.filter((n: string) => !m.clips.includes(n))).toEqual([]);
    expect(cat.motions.filter((n: string) => !m.motions.includes(n))).toEqual([]);
  });

  it('maps only state labels that exist in content/states.yaml', () => {
    const ids = YAML.parse(readFileSync(join(REPO, 'content/states.yaml'), 'utf8')).states.map((s: any) => s.id);
    expect(Object.keys(LABEL_SCENES).filter((l) => !ids.includes(l))).toEqual([]);
  });

  it('names every node for the tap card', () => {
    for (const [k, n] of Object.entries(NODES)) {
      expect(n.label && n.name && n.aliases && n.about, k).toBeTruthy();
    }
  });
});

describe('bike builder', () => {
  it('builds every node on a city e-bike with a derailleur', () => {
    const m = new BikeModel(bikeSpec({ 'bike.category': 'trekking_city', 'bike.ebike': true, 'drive.gear_type': 'derailleur' }), mat);
    const missing = Object.keys(NODES).filter((n) => n !== 'bike' && !partsOf(n).some((p) => m.has(p)));
    expect(missing).toEqual([]);
    for (const n of Object.keys(NODES)) if (n !== 'bike') expect(m.anchors.has(n) || m.anchors.has(partsOf(n)[0]), n).toBe(true);
  });

  it('picks parts by facts', () => {
    expect(bikeSpec({ 'bike.category': 'road_gravel' }).bar).toBe('drop');
    expect(bikeSpec({ 'bike.category': 'road_gravel' }).barrelAt).toBe('derailleur');
    expect(bikeSpec({ 'bike.category': 'mtb' }).forkKind).toBe('susp');
    expect(bikeSpec({ 'bike.category': 'unknown' }).bar).toBe('flat');
    expect(bikeSpec({ 'drive.rear_speeds': 11 }).n).toBe(11);
    expect(bikeSpec({ 'drive.rear_speeds': 'unknown' }).n).toBe(8);
    expect(bikeSpec({ 'drive.gear_type': 'hub_gear' }).n).toBe(1);
    const road = new BikeModel(bikeSpec({ 'bike.category': 'road_gravel' }), mat);
    expect(road.has('kickstand')).toBe(false);
    expect(road.has('motor')).toBe(false);
  });

  it('builds every kind of bike and moves the derailleur and chain without errors', () => {
    for (const cat of ['mtb', 'road_gravel', 'trekking_city', 'cargo', 'unknown']) {
      for (const gt of ['derailleur', 'hub_gear', 'single_speed', 'gearbox', 'unknown']) {
        const m = new BikeModel(bikeSpec({ 'bike.category': cat, 'drive.gear_type': gt, 'drive.rear_speeds': 12 }), mat);
        m.chainShift = 1.234;
        m.setDer(m.zOf(0), GAP_OK);
        m.setDer(m.zOf(m.spec.n - 1), 0.03);
        m.dispose();
      }
    }
  });

  it('keeps the tyres clear of the frame, fork and battery on every kind of bike', () => {
    for (const cat of ['mtb', 'road_gravel', 'trekking_city', 'cargo', 'unknown']) expectTyresClear(bikeSpec({ 'bike.category': cat, 'bike.ebike': true }), cat);
  });

  it('raises the bottom bracket to a typical height for each kind of bike', () => {
    // bottom bracket height above the ground, in mm: road about 270-300, city 280-310, mountain 300-340
    const mm = (B: BikeSpec) => (B.bby - GROUND) * 500;
    expect(mm(bikeSpec({ 'bike.category': 'road_gravel' }))).toBeGreaterThan(270);
    expect(mm(bikeSpec({ 'bike.category': 'trekking_city' }))).toBeGreaterThan(280);
    expect(mm(bikeSpec({ 'bike.category': 'mtb' }))).toBeGreaterThan(300);
    for (const cat of ['mtb', 'road_gravel', 'trekking_city']) expect(mm(bikeSpec({ 'bike.category': cat }))).toBeLessThan(345);
  });

  it('keeps the derailleur, chain and frame off the sprockets in every gear', () => {
    for (const facts of DER_BIKES) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      const label = `${facts['bike.category']} ${facts['drive.rear_speeds']}-speed`;
      for (let i = 0; i < B.n; i++) {
        m.setDer(m.zOf(i), GAP_OK);
        const der = meshPoints(m, ['rear_derailleur', 'upper_pulley', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'barrel_adjuster', 'shift_cable']);
        const bad = der.find(({ p }) => hitsSprocket(B, p, 0, 0) !== undefined);
        expect(bad && `${bad.part} at ${bad.p.toArray().map((v) => v.toFixed(3))}`, `${label}, gear ${i + 1}: derailleur`).toBeUndefined();
        // the chain runs on sprocket i; its links are chainW wide and 0.014 high
        const pts = m.chainPoints();
        for (let k = 1; k < pts.length; k++) {
          const a = new T.Vector3(...pts[k - 1]);
          const b = new T.Vector3(...pts[k]);
          const steps = Math.ceil(a.distanceTo(b) / 0.005);
          for (let s = 0; s <= steps; s++) {
            const p = a.clone().lerp(b, s / steps);
            const j = hitsSprocket(B, p, B.chainW / 2, 0.007, i);
            if (j !== undefined) expect.fail(`${label}, gear ${i + 1}: the chain touches sprocket ${j + 1} at ${p.toArray().map((v) => v.toFixed(3))}`);
          }
        }
      }
      const frame = meshPoints(m, ['frame'], 3).filter(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby) < 0.32);
      expect(frame.find(({ p }) => hitsSprocket(B, p, 0, 0) !== undefined), `${label}: frame`).toBeUndefined();
      m.dispose();
    }
  });

  it('picks the handlebar from bike.handlebar, else from the kind of bike', () => {
    expect(bikeSpec({ 'bike.category': 'road_gravel' }).bar).toBe('drop');
    expect(bikeSpec({ 'bike.category': 'road_gravel', 'bike.handlebar': 'flat' }).bar).toBe('flat');
    expect(bikeSpec({ 'bike.category': 'road_gravel', 'bike.handlebar': 'unknown' }).bar).toBe('drop');
    expect(bikeSpec({ 'bike.category': 'trekking_city', 'bike.handlebar': 'drop' }).bar).toBe('drop');
    expect(bikeSpec({ 'bike.category': 'mtb' }).bar).toBe('riser');
    // combined brake and shift levers have no barrel adjuster; trigger shifters do
    expect(bikeSpec({ 'bike.category': 'trekking_city', 'bike.handlebar': 'drop' }).barrelAt).toBe('derailleur');
    expect(bikeSpec({ 'bike.category': 'road_gravel', 'bike.handlebar': 'flat' }).barrelAt).toBe('shifter');
    for (const bar of ['drop', 'flat', 'riser']) {
      const m = new BikeModel(bikeSpec({ 'bike.handlebar': bar }), mat);
      expect(m.has('brake_lever') && m.has('shifter_rear') && m.has('barrel_adjuster'), bar).toBe(true);
      m.dispose();
    }
  });

  it('reads the frame colour from bike.colour', () => {
    expect(bikeSpec({ 'bike.colour': '#C0392B' }).colour).toBe('#c0392b');
    expect(bikeSpec({ 'bike.colour': 'red' }).colour).toBeNull();
    expect(bikeSpec({}).colour).toBeNull();
  });

  it('fits the frame to plausible geometry facts and ignores the rest', () => {
    const base = bikeSpec({ 'bike.category': 'road_gravel' });
    const fit = bikeSpec({ 'bike.category': 'road_gravel', 'geometry.stack_mm': 560, 'geometry.reach_mm': 390, 'geometry.head_angle_deg': 73, 'geometry.chainstay_mm': 415, 'geometry.bb_drop_mm': 70, 'geometry.wheel_bsd_mm': 622 });
    expect((fit.HT[1] - fit.bby) * 500).toBeCloseTo(560);
    expect(fit.HT[0] * 500).toBeCloseTo(390);
    expect(Math.hypot(fit.rx, fit.huby - fit.bby) * 500).toBeCloseTo(415);
    expect((fit.huby - fit.bby) * 500).toBeCloseTo(70);
    // out of range, or not a number: the default drawing
    const odd = bikeSpec({ 'bike.category': 'road_gravel', 'geometry.stack_mm': 2000, 'geometry.reach_mm': 'long', 'geometry.wheel_bsd_mm': 600, 'geometry.chainstay_mm': 100 });
    expect(odd).toEqual(base);
  });

  it('keeps tyres, derailleur and chain clear with extreme geometry', () => {
    const keys = Object.keys(GEOMETRY_RANGES);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cases: Array<Record<string, unknown>> = [];
    for (const end of [0, 1]) cases.push(Object.fromEntries(keys.map((k) => [`geometry.${k}`, GEOMETRY_RANGES[k][end]])));
    for (let i = 0; i < 40; i++) cases.push(Object.fromEntries(keys.filter(() => rnd() < 0.7).map((k) => [`geometry.${k}`, GEOMETRY_RANGES[k][rnd() < 0.5 ? 0 : 1]])));
    for (const [i, g] of cases.entries()) {
      const facts = { 'bike.category': ['mtb', 'road_gravel', 'trekking_city'][i % 3], 'bike.ebike': true, 'drive.rear_speeds': 12, 'geometry.wheel_bsd_mm': [559, 584, 622][i % 3], ...g };
      const B = bikeSpec(facts);
      expectTyresClear(B, JSON.stringify(facts));
      const m = new BikeModel(B, mat);
      for (const gear of [0, B.n - 1]) {
        m.setDer(m.zOf(gear), GAP_OK);
        const bad = meshPoints(m, ['rear_derailleur', 'upper_pulley', 'frame'], 2).find(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby) < 0.4 && hitsSprocket(B, p, 0, 0) !== undefined);
        expect(bad?.part, JSON.stringify(facts)).toBeUndefined();
      }
      m.dispose();
    }
  });

  it('names a tapped part and its model for the garage preview', () => {
    expect(previewNode('upper_pulley')).toBe('rear_derailleur');
    expect(previewNode('smallest_sprocket')).toBe('cassette');
    expect(previewNode('frame')).toBe('frame');
    expect(modelOf('rear_derailleur', { 'drive.rear_derailleur_model': 'Shimano XT RD-M8100' })).toBe('Shimano XT RD-M8100');
    expect(modelOf('frame', { 'bike.brand': 'Canyon', 'bike.model': 'Endurace', 'bike.line': 'CF 7' })).toBe('Canyon Endurace CF 7');
    expect(modelOf('frame', { 'bike.brand': 'Canyon', 'bike.model': 'unknown' })).toBe('Canyon');
    expect(modelOf('rear_derailleur', {})).toBe('');
    expect(modelOf('saddle', { 'bike.brand': 'Canyon' })).toBe('');
    for (const [k, n] of Object.entries(NODES)) {
      for (const f of [n.model_fact ?? []].flat()) expect(f, k).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it('lays a closed chain path', () => {
    const p = newPath();
    const len = buildPath([{ x: 0, y: 0, z: 0, r: 0.2, s: 1 }, { x: -1, y: 0.3, z: 0, r: 0.1, s: 1 }], p);
    expect(len).toBeGreaterThan(2);
    expect(p.x[p.n - 1]).toBeCloseTo(p.x[0]);
    expect(p.y[p.n - 1]).toBeCloseTo(p.y[0]);
  });
});

/** Tyres clear of the frame, fork and battery, with the tubes' radii and a visible gap. */
function expectTyresClear(B: BikeSpec, label: string): void {
  const front: [number, number] = [B.FX, B.huby];
  const rear: [number, number] = [B.rx, B.huby];
  const dl = Math.hypot(B.HT[0] - B.HB[0], B.HT[1] - B.HB[1]);
  const crown: [number, number] = [B.HB[0] - ((B.HT[0] - B.HB[0]) / dl) * 0.04, B.HB[1] - ((B.HT[1] - B.HB[1]) / dl) * 0.04];
  const [b0, b1] = batteryLine(B);
  expect(distSeg(front, [0, B.bby], B.HB) - 0.034, `${label}: down tube`).toBeGreaterThan(B.rt + 0.01);
  expect(distSeg(front, b0, b1) - 0.05, `${label}: battery`).toBeGreaterThan(B.rt + 0.005);
  expect(Math.hypot(front[0] - crown[0], front[1] - crown[1]) - 0.022, `${label}: fork crown`).toBeGreaterThan(B.rt + 0.01);
  expect(distSeg(rear, [0, B.bby], B.ST) - 0.034, `${label}: seat tube`).toBeGreaterThan(B.rt + 0.01);
  // the front wheel ahead of the cranks and the down tube, the rear wheel behind the seat tube
  expect(B.FX - B.rt, `${label}: front wheel`).toBeGreaterThan(0.2);
}

describe('views and animations', () => {
  const m = new BikeModel(bikeSpec({}), mat);

  it('has a camera pose for every view', () => {
    for (const v of VIEWS) expect(viewPose(v, m.spec), v).toBeDefined();
    expect(viewPose('no_such_view', m.spec)).toBeUndefined();
  });

  it('plays every clip and every motion on every node', () => {
    const anims: any[] = [
      ...CLIPS.flatMap((c) => [{ clip: c, caption: 'x' }, { clip: c, direction: 'unscrew', caption: 'x' }]),
      ...Object.keys(NODES).flatMap((target) => MOTIONS.map((motion) => ({ target, motion, direction: 'in', caption: 'x' }))),
    ];
    for (const a of anims) {
      const an = makeAnim(a, ctxFor(m));
      expect(an, JSON.stringify(a)).toBeDefined();
      for (let t = 0; t <= an!.duration; t += 0.25) {
        const f = an!.frame(t);
        if (f.derZ !== undefined) expect(Number.isFinite(f.derZ)).toBe(true);
      }
    }
  });

  it('returns nothing for an unknown clip, node or motion', () => {
    expect(makeAnim({ clip: 'no-such-clip', caption: 'x' }, ctxFor(m))).toBeUndefined();
    expect(makeAnim({ target: 'no_such_node', motion: 'rotate', caption: 'x' }, ctxFor(m))).toBeUndefined();
    expect(makeAnim({ target: 'crank', motion: 'wiggle', caption: 'x' }, ctxFor(m))).toBeUndefined();
  });

  it('reads turn directions', () => {
    expect(dirSign('screw in')).toBe(1);
    expect(dirSign('tighten')).toBe(1);
    expect(dirSign('towards the spokes')).toBe(1);
    expect(dirSign('unscrew')).toBe(-1);
    expect(dirSign('loosen')).toBe(-1);
    expect(dirSign('backwards')).toBe(-1);
    expect(dirSign(undefined)).toBe(1);
  });

  it('limit-screw-align: unscrewing H brings the pulley out from the spokes into line', () => {
    const an = makeAnim({ clip: 'limit-screw-align', target: 'h_screw', direction: 'unscrew', caption: 'x' }, ctxFor(m))!;
    const start = an.frame(0);
    const end = an.frame(an.duration - 0.1);
    // z grows away from the spokes; the smallest sprocket is the outermost
    expect(start.derZ!).toBeLessThan(m.zOf(0));
    expect(end.derZ!).toBeCloseTo(m.zOf(0));
    expect(start.status).toBe('bad');
    expect(end.status).toBe('good');
  });

  it('a motion on the whole bike goes from how it was held to how it is held now', () => {
    const an = makeAnim({ target: 'bike', motion: 'rotate', caption: 'x' }, { ...ctxFor(m), poseBefore: 'flipped', pose: 'ground' })!;
    expect(an.frame(0).pose).toEqual({ from: 'flipped', to: 'ground', k: 0 });
    expect(an.frame(an.duration).pose?.k).toBe(1);
  });
});
