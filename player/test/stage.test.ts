// The 3D stage without a browser: the registry, the manifest, the bike builder, views and
// animations. WebGL itself is covered by the browser walk (npm run test:e2e).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { dirSign, makeAnim, type AnimCtx } from '../src/stage/anim.js';
import { batteryLine, BikeModel, bikeSpec, distSeg, GAP_BIG, GAP_OK, GAP_SMALL, GEOMETRY_RANGES, GROUND, PITCH, RP, type BikeSpec } from '../src/stage/bike.js';
import { chordLength } from '../src/stage/pins.js';
import { RIG } from '../src/stage/rd-kin.js';
import { RD_RIG } from '../src/stage/rd-rig.js';
import { buildPath, newPath } from '../src/stage/chain.js';
import { CLIPS, GROUP_NODES, LABEL_SCENES, manifest, modelOf, MOTIONS, NODE_PARTS, NODES, partsOf, previewNode, SPLIT_PARTS, VIEWS } from '../src/stage/registry.js';
import { FADED, shownParts, visTargets, type VisCard } from '../src/stage/visibility.js';
import { viewPose } from '../src/stage/views.js';

const REPO = resolve(import.meta.dirname, '../..');
const mat = new T.MeshStandardMaterial();

/**
 * Points along every edge of every mesh of the given parts, in bike space. Library meshes (and the
 * derailleur's shared ones, userData.lib) are dense CAD meshes: their vertices only, every `stride`-th.
 * Pulleys (userData.pulley) are left out with `noPulleys`: the chain runs on them, beside the sprockets.
 */
function meshPoints(m: BikeModel, ids: string[], steps = 6, opt: { stride?: number; noPulleys?: boolean } = {}): Array<{ part: string; p: T.Vector3 }> {
  m.bike.updateMatrixWorld(true);
  const out: Array<{ part: string; p: T.Vector3 }> = [];
  const a = new T.Vector3();
  const b = new T.Vector3();
  for (const id of ids) {
    m.parts.get(id)?.group.traverse((o: any) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.partId !== id) return;
      if (opt.noPulleys && o.userData.pulley) return;
      const pos = o.geometry.attributes.position;
      if (o.geometry.userData.lib) {
        for (let i = 0; i < pos.count; i += opt.stride ?? 1) out.push({ part: id, p: new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld) });
        return;
      }
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
    if (Math.abs(p.z - B.zs[j]) < B.sprT / 2 + halfWidth && d - halfHeight < B.rs[j] + 0.0025 + 0.002) return j;
  }
  return undefined;
}

/** Bikes with a derailleur: every kind and number of speeds the builder knows. */
/** Bikes with a derailleur: every cassette in spec.ts's table, and the spread ones (5 and 13 speeds). */
const DER_BIKES = ([['road_gravel', [8, 9, 10, 11, 12]], ['trekking_city', [5, 7, 8, 9, 10]], ['mtb', [8, 9, 10, 11, 12, 13]]] as const)
  .flatMap(([cat, ns]) => ns.map((n) => ({ 'bike.category': cat, 'drive.gear_type': 'derailleur', 'drive.rear_speeds': n })));

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

function card(m: BikeModel, focus: string[], show: string[] | null, more: Partial<VisCard> = {}): VisCard {
  const hot = new Set(focus.flatMap((n) => partsOf(n)).filter((p) => m.has(p)));
  return {
    ids: [...m.parts.keys()], hot, shown: show ? shownParts(hot, show, partsOf, (p) => m.has(p)) : null, hidden: new Set(),
    context: () => false, exploring: false, showAll: false, selected: null, ...more,
  };
}

describe('which parts a card draws (visibility.ts)', () => {
  const m = new BikeModel(bikeSpec({ 'bike.category': 'road_gravel', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 11 }), mat);

  it('with show: focus and show parts are drawn, every other part has target 0 (not drawn), only focus is marked', () => {
    const { targets, frameGone } = visTargets(card(m, ['chain'], ['drivetrain']));
    const drawn = [...targets].filter(([, t]) => t.vis === 1).map(([id]) => id).sort();
    expect(drawn).toEqual(partsOf('drivetrain').filter((p) => m.has(p)).sort());
    for (const id of ['frame', 'frame_dropout', 'rear_wheel', 'rear_hub', 'front_wheel', 'fork', 'saddle', 'seat_post', 'handlebar', 'brake_lever', 'shift_cable', 'shifter_rear', 'stand_clamp']) {
      expect(targets.get(id)!.vis, id).toBe(0);
    }
    for (const [id, t] of targets) expect(t.hot, id).toBe(id === 'chain' ? 1 : 0);
    expect(frameGone).toBe(true);
    // nothing is faded on such a card: a part is in or out
    for (const t of targets.values()) expect([0, 1]).toContain(t.vis);
  });

  it('with show: the rear end shows stay ends and hub, and a focus part outside show is drawn too', () => {
    const { targets } = visTargets(card(m, ['smallest_sprocket'], ['rear_end']));
    expect([...targets].filter(([, t]) => t.vis === 1).map(([id]) => id).sort()).toEqual(['frame_dropout', 'rear_hub', 'smallest_sprocket']);
  });

  it('the stand clamp is hidden with the frame, shown with it', () => {
    expect(visTargets(card(m, ['chain'], ['stand_clamp'])).targets.get('stand_clamp')!.vis).toBe(0);
    const withFrame = visTargets(card(m, ['chain'], ['frame', 'stand_clamp']));
    expect(withFrame.frameGone).toBe(false);
    expect(withFrame.targets.get('stand_clamp')!.vis).toBe(1);
    expect(withFrame.targets.get('frame_dropout')!.vis).toBe(1);
  });

  it('without show: the context stays and the rest is faded, as before', () => {
    const { targets, frameGone } = visTargets(card(m, ['chain'], null, { context: (id) => id === 'frame' || id === 'cassette' }));
    expect(targets.get('chain')!.vis).toBe(1);
    expect(targets.get('frame')!.vis).toBe(1);
    expect(targets.get('cassette')!.vis).toBe(1);
    expect(targets.get('saddle')!.vis).toBe(FADED);
    expect(frameGone).toBe(false);
  });

  it('explore mode: show all draws everything; the step focus keeps the card rule', () => {
    const all = visTargets(card(m, ['chain'], ['drivetrain'], { exploring: true, showAll: true }));
    for (const t of all.targets.values()) expect(t.vis).toBe(1);
    expect(all.frameGone).toBe(false);
    const step = visTargets(card(m, ['chain'], ['drivetrain'], { exploring: true, showAll: false }));
    expect(step.targets.get('saddle')!.vis).toBe(0);
    expect(step.targets.get('chain')!.vis).toBe(1);
  });

  it('a part that a state label hides stays hidden', () => {
    const { targets } = visTargets(card(m, ['chain'], ['drivetrain'], { hidden: new Set(['chain']), exploring: true, showAll: true }));
    expect(targets.get('chain')!.vis).toBe(0);
  });
});

describe('3D registry and manifest', () => {
  it('build/3d-manifest.json is the registry export (run npm run manifest after changing the registry)', () => {
    const file = JSON.parse(readFileSync(join(REPO, 'build/3d-manifest.json'), 'utf8'));
    expect(file).toEqual(manifest());
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

  it('groups the drivetrain and the rear end, and builds the parts cut out of the frame and the rear wheel', () => {
    const m = new BikeModel(bikeSpec({ 'bike.category': 'road_gravel', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 11 }), mat);
    const B = m.spec;
    // drivetrain: the chain's whole path, and not the cable, the shifter or the wheels
    expect(partsOf('drivetrain')).toEqual(expect.arrayContaining(['chainring', 'crank', 'chain', 'cassette', 'rear_derailleur', 'upper_pulley', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'barrel_adjuster']));
    for (const no of ['shift_cable', 'shifter_rear', 'rear_wheel', 'front_wheel', 'frame']) expect(partsOf('drivetrain'), no).not.toContain(no);
    for (const p of partsOf('drivetrain')) expect(m.has(p), p).toBe(true);
    // the split parts: frame and rear_wheel still stand for the whole
    for (const [part, whole] of Object.entries(SPLIT_PARTS)) {
      expect(m.has(part), part).toBe(true);
      expect(partsOf(whole), whole).toContain(part);
      expect(NODES[part], `${part} is a part, not a node`).toBeUndefined();
      expect(previewNode(part)).toBe(whole);
    }
    expect(partsOf('frame')).toEqual(['frame', 'frame_dropout']);
    expect(partsOf('rear_wheel')).toEqual(['rear_wheel', 'rear_hub']);
    expect(partsOf('rear_end')).toEqual(['frame_dropout', 'rear_hub']);
    expect(previewNode('chain')).toBe('chain');
    for (const g of GROUP_NODES) expect(NODE_PARTS[g], g).toBeDefined();
    // the dropout end: only the last stretch of the stays (13 cm = 0.26) and the plates, round the axle
    const end = meshPoints(m, ['frame_dropout'], 1);
    expect(end.length).toBeGreaterThan(100);
    for (const { p } of end) expect(Math.hypot(p.x - B.rx, p.y - B.huby), 'dropout part reaches too far').toBeLessThan(0.3);
    // ... and the rest of the frame still holds the long part of the stays
    const rest = meshPoints(m, ['frame'], 1).filter(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby) > 0.35 && p.x < B.bby);
    expect(rest.length).toBeGreaterThan(100);
    // the hub holds the axle and the freehub body, the wheel keeps rim, tyre and spokes
    const hub = meshPoints(m, ['rear_hub'], 1);
    expect(Math.max(...hub.map(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby)))).toBeLessThan(0.08);
    expect(Math.max(...meshPoints(m, ['rear_wheel'], 1).map(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby)))).toBeGreaterThan(B.rt - 0.05);
    // a motion on the whole node moves all its pieces about one centre
    expect(m.parts.get('frame_dropout')!.center.toArray()).toEqual(m.parts.get('frame')!.center.toArray());
    expect(m.parts.get('rear_hub')!.center.toArray()).toEqual(m.parts.get('rear_wheel')!.center.toArray());
    m.dispose();
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

  it('draws the common cassette for each kind of bike and number of speeds', () => {
    const rows: Array<[string, number, number, number]> = [
      ['road_gravel', 8, 11, 28], ['road_gravel', 9, 11, 28], ['road_gravel', 10, 11, 32], ['road_gravel', 11, 11, 32], ['road_gravel', 12, 11, 34],
      ['trekking_city', 7, 14, 28], ['trekking_city', 8, 11, 32], ['trekking_city', 9, 11, 34], ['trekking_city', 10, 11, 36],
      ['mtb', 8, 11, 32], ['mtb', 9, 11, 34], ['mtb', 10, 11, 36], ['mtb', 11, 11, 42], ['mtb', 12, 10, 51],
    ];
    for (const [cat, n, first, last] of rows) {
      const c = bikeSpec({ 'bike.category': cat, 'drive.rear_speeds': n }).cassette;
      expect([c.length, c[0], c[n - 1]], `${cat} ${n}`).toEqual([n, first, last]);
      for (let i = 1; i < n; i++) expect(c[i], `${cat} ${n}`).toBeGreaterThan(c[i - 1]);
    }
    // other speed counts: the nearest row's first and last tooth, evenly spread
    const five = bikeSpec({ 'bike.category': 'trekking_city', 'drive.rear_speeds': 5 }).cassette;
    expect([five.length, five[0], five[4]]).toEqual([5, 14, 28]);
    const thirteen = bikeSpec({ 'bike.category': 'mtb', 'drive.rear_speeds': 13 }).cassette;
    expect([thirteen.length, thirteen[0], thirteen[12]]).toEqual([13, 10, 51]);
    // a range in the cassette model: the same speeds, stretched to those teeth
    const model = bikeSpec({ 'bike.category': 'road_gravel', 'drive.rear_speeds': 11, 'drive.cassette_model': 'Shimano CS-HG700 11–34' }).cassette;
    expect([model.length, model[0], model[10]]).toEqual([11, 11, 34]);
    expect(bikeSpec({ 'bike.category': 'road_gravel', 'drive.rear_speeds': 11, 'drive.cassette_model': 'Shimano 105 CS-R7000' }).cassette).toEqual(bikeSpec({ 'bike.category': 'road_gravel', 'drive.rear_speeds': 11 }).cassette);
    expect(bikeSpec({ 'bike.category': 'road_gravel', 'drive.rear_speeds': 11, 'drive.cassette_model': 'x 11-12' }).cassette[10]).toBe(32);
  });

  it('spaces the sprockets as on a real cassette and sizes the chain by the speeds', () => {
    const real: Record<number, number> = { 7: 5, 8: 4.8, 9: 4.35, 10: 3.95, 11: 3.74, 12: 3.5 };
    const chain: Record<number, number> = { 7: 7.3, 8: 7.3, 9: 6.6, 10: 5.9, 11: 5.5, 12: 5.3, 13: 5.3 };
    for (const n of [7, 8, 9, 10, 11, 12, 13]) {
      const B = bikeSpec({ 'bike.category': n === 7 ? 'trekking_city' : 'mtb', 'drive.rear_speeds': n });
      expect(B.sp * 500, `${n} speeds`).toBeCloseTo(real[n] ?? 3.3, 6);
      for (let i = 1; i < B.n; i++) expect(B.zs[i - 1] - B.zs[i]).toBeCloseTo(B.sp, 9);
      expect(B.chainW * 500, `${n} speeds`).toBeCloseTo(chain[n], 6);
      // the chain on one sprocket does not touch the next one
      expect(B.chainW / 2 + B.sprT / 2).toBeLessThan(B.sp);
    }
  });

  it('sets every pin on a wheel in a tooth gap, one pitch from the next, in any gear and at any chain position', () => {
    const bikes = [
      { 'bike.category': 'road_gravel', 'drive.rear_speeds': 11 },
      { 'bike.category': 'trekking_city', 'drive.rear_speeds': 8 },
      { 'bike.category': 'mtb', 'drive.rear_speeds': 12 },
    ];
    const mod = (v: number, d: number) => ((v % d) + d) % d;
    for (const facts of bikes) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      for (const gear of [0, Math.floor(B.n / 2), B.n - 1]) {
        for (const shift of [0, 0.0377, 0.31, -1.234, 12.5]) {
          m.chainShift = shift;
          m.setDer(m.zOf(gear), GAP_OK);
          const P = m.pins;
          const label = `${facts['bike.category']} gear ${gear + 1}, shift ${shift}`;
          let onRing = 0;
          let onSprocket = 0;
          for (let k = 0; k < m.links; k++) {
            // tooth gap centres: the wheel's angle plus whole teeth; the sprocket block and the chainring turn with the chain
            const w = P.wheel[k];
            if (w !== 0 && w !== 1) continue;
            const ring = w === 0;
            const a = Math.atan2(P.y[k] - (ring ? B.bby : B.huby), P.x[k] - (ring ? 0 : B.rx));
            const step = (2 * Math.PI) / (ring ? B.chainring : B.cassette[gear]);
            const d = mod(a - (ring ? m.crankset.rotation.z : m.cassetteG.rotation.z), step);
            const off = Math.min(d, step - d) * (ring ? B.rc : B.rs[gear]) * 500;
            expect(off, `${label}: pin ${k} on the ${ring ? 'chainring' : 'sprocket'}`).toBeLessThan(0.3);
            if (ring) onRing++;
            else onSprocket++;
            // the next pin, if it is on the same wheel, is one pitch away
            const j = (k + 1) % m.links;
            if (P.wheel[j] === w) expect(Math.abs(Math.hypot(P.x[j] - P.x[k], P.y[j] - P.y[k], P.z[j] - P.z[k]) - PITCH) * 500, `${label}: pitch`).toBeLessThan(0.05);
          }
          expect(onRing, `${label}: pins on the chainring`).toBeGreaterThan(8);
          expect(onSprocket, `${label}: pins on the sprocket`).toBeGreaterThan(2);
        }
      }
      m.dispose();
    }
  });

  it('spins the derailleur pulleys with the chain, a tooth gap under every pin on them', () => {
    const m = new BikeModel(bikeSpec({ 'bike.category': 'mtb', 'drive.rear_speeds': 12 }), mat);
    const B = m.spec;
    const d = m.der!;
    const mod = (v: number, q: number) => ((v % q) + q) % q;
    const a = (2 * Math.PI) / RD_RIG.pulleys.upper.teeth;
    const spun = { u: [] as number[], l: [] as number[] };
    for (const gear of [0, 6, B.n - 1]) {
      // on the 51-tooth sprocket the chain wraps the upper pulley by only 28 degrees, less than a tooth: count over all steps
      const on = { upper: 0, lower: 0 };
      for (let i = 0; i < 12; i++) {
        m.chainShift = -i * 0.003;
        m.setDer(m.zOf(gear), GAP_OK);
        for (const [which, wheel, frame] of [['upper', 2, d.pulleyU], ['lower', 3, d.pulleyL]] as const) {
          const c = new T.Vector3(...RD_RIG.pulleys[which].c);
          const ax = new T.Vector3(...RD_RIG.pulleys[which].d).normalize();
          const e1 = new T.Vector3(1, 0, 0).addScaledVector(ax, -ax.x).normalize();
          const e2 = new T.Vector3().crossVectors(ax, e1);
          // from bike space back to the pulley's own (library) frame: the ring's gap k is at k * a from e1
          const inv = d.cage.matrix.clone().multiply(frame.matrix).invert();

          for (let k = 0; k < m.links; k++) {
            if (m.pins.wheel[k] !== wheel) continue;
            const v = new T.Vector3(m.pins.x[k], m.pins.y[k], m.pins.z[k]).applyMatrix4(inv).sub(c);
            const off = mod(Math.atan2(v.dot(e2), v.dot(e1)), a);
            expect(Math.min(off, a - off) * RP * 500, `gear ${gear + 1}, step ${i}: pin ${k} on the ${which} pulley`).toBeLessThan(0.3);
            on[which]++;
          }
        }
        if (gear === 6) {
          spun.u.push(d.spin.u);
          spun.l.push(d.spin.l);
        }
      }
      expect(on.upper, `gear ${gear + 1}: pins on the upper pulley`).toBeGreaterThan(0);
      expect(on.lower, `gear ${gear + 1}: pins on the lower pulley`).toBeGreaterThan(11);
    }
    // pedalling forward (chainShift falling) turns the upper pulley one way and the lower the other, steadily
    for (let i = 1; i < spun.u.length; i++) {
      expect(spun.u[i]).toBeGreaterThan(spun.u[i - 1]);
      expect(spun.l[i]).toBeLessThan(spun.l[i - 1]);
    }
    m.dispose();
  });

  it('moves the chain smoothly and turns the sprockets the way the chain goes, however fast', () => {
    const m = new BikeModel(bikeSpec({ 'bike.category': 'road_gravel', 'drive.rear_speeds': 11 }), mat);
    const B = m.spec;
    for (const gear of [0, 7]) {
      // pedalling forward at 4.2 rad/s (more than half a tooth of the smallest sprocket per frame at 60 fps) and at 1 mm of chain per step
      for (const step of [4.2 * B.rc / 60, 0.002]) {
        m.chainShift = 0;
        m.cassetteSpin = 0;
        m.cassetteShift = 0;
        m.setDer(m.zOf(gear), GAP_OK);
        let prevSpin = m.cassetteG.rotation.z;
        let prev: number[][] = [];
        const take = () => Array.from({ length: m.links }, (_, k) => [m.pins.x[k], m.pins.y[k], m.pins.z[k]]);
        for (let i = 1; i <= 90; i++) {
          m.chainShift = -i * step;
          m.setDer(m.zOf(gear), GAP_OK);
          expect(m.cassetteG.rotation.z, `gear ${gear + 1} frame ${i}: sprockets turn forward`).toBeLessThan(prevSpin);
          prevSpin = m.cassetteG.rotation.z;
          const cur = take();
          if (prev.length && step < 0.003) {
            // no pin jumps: each one is within about the step of a pin of the frame before
            for (const p of cur) {
              const d = Math.min(...prev.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])));
              expect(d, `gear ${gear + 1} frame ${i}: a pin jumped`).toBeLessThan(step * 1.5);
            }
          }
          prev = cur;
        }
        // the block turned as far as the chain travelled round the sprocket, within a tooth
        expect(Math.abs(-prevSpin - (90 * step) / B.rs[gear]), `gear ${gear + 1}: the block turns with the chain`).toBeLessThan((2 * Math.PI) / B.cassette[gear]);
      }
    }
    m.dispose();
  });

  it('keeps the drivetrain within its triangle budget and draws the chain in at most 4 calls', () => {
    const tris = (o: T.Object3D) => {
      let n = 0;
      o.traverse((c: any) => {
        if (c.isMesh) n += ((c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count) / 3) * (c.isInstancedMesh ? c.count : 1);
      });
      return n;
    };
    for (const facts of [{ 'bike.category': 'road_gravel', 'drive.rear_speeds': 11 }, { 'bike.category': 'mtb', 'drive.rear_speeds': 12 }, { 'bike.category': 'trekking_city', 'drive.rear_speeds': 8 }]) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const label = JSON.stringify(facts);
      expect(tris(m.cassetteG), `${label}: cassette`).toBeLessThanOrEqual(15000);
      expect(tris(m.parts.get('chainring')!.group), `${label}: chainring`).toBeLessThanOrEqual(3000);
      // the longest chain: every link its capacity
      m.chainInner.count = Math.ceil(m.N / 2);
      m.chainOuter.count = Math.floor(m.N / 2);
      expect(tris(m.parts.get('chain')!.group), `${label}: chain`).toBeLessThanOrEqual(25000);
      let calls = 0;
      m.parts.get('chain')!.group.traverse((c: any) => { if (c.isMesh) calls++; });
      expect(calls, `${label}: chain meshes`).toBeLessThanOrEqual(4);
      m.dispose();
    }
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
    // every derailleur piece but the pulleys (the chain runs on them) at least 1 mm from every sprocket's
    // tip circle (hitsSprocket's margin), in every gear of every cassette
    const DER = ['rear_derailleur', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'barrel_adjuster', 'shift_cable'];
    for (const facts of DER_BIKES) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      const label = `${facts['bike.category']} ${facts['drive.rear_speeds']}-speed`;
      for (let i = 0; i < B.n; i++) {
        m.setDer(m.zOf(i), GAP_OK);
        const der = meshPoints(m, DER, 3, { stride: 2, noPulleys: true });
        expect(der.length, label).toBeGreaterThan(5000);
        const bad = der.find(({ p }) => hitsSprocket(B, p, 0, 0) !== undefined);
        expect(bad && `${bad.part} at ${bad.p.toArray().map((v) => v.toFixed(3))}`, `${label}, gear ${i + 1}: derailleur`).toBeUndefined();
        // the chain runs on sprocket i; its plates are chainW wide and 0.016 high
        const pts = m.chainPoints();
        for (let k = 1; k < pts.length; k++) {
          const a = new T.Vector3(...pts[k - 1]);
          const b = new T.Vector3(...pts[k]);
          const steps = Math.ceil(a.distanceTo(b) / 0.005);
          for (let s = 0; s <= steps; s++) {
            const p = a.clone().lerp(b, s / steps);
            const j = hitsSprocket(B, p, B.chainW / 2, 0.008, i);
            if (j !== undefined) expect.fail(`${label}, gear ${i + 1}: the chain touches sprocket ${j + 1} at ${p.toArray().map((v) => v.toFixed(3))}`);
          }
        }
      }
      const frame = meshPoints(m, partsOf('frame'), 3).filter(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby) < 0.32);
      expect(frame.find(({ p }) => hitsSprocket(B, p, 0, 0) !== undefined), `${label}: frame`).toBeUndefined();
      m.dispose();
    }
  }, 30000);

  it('lines the upper pulley up with every sprocket, sets the gap and keeps the chain length, for every cassette', () => {
    const mm = (v: number) => v * 500;
    for (const facts of DER_BIKES) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      const d = m.der!;
      const label = `${facts['bike.category']} ${facts['drive.rear_speeds']}-speed ${B.cassette[0]}-${B.cassette[B.n - 1]}`;
      // where the upper pulley is drawn: its centre through the cage frame and its spin
      const drawn = () => RIG.Up.clone().applyMatrix4(d.cage.matrix);
      const gapNow = (i: number) => {
        const u = drawn();
        return Math.hypot(u.x - B.rx, u.y - B.huby) - B.rs[i] - RP;
      };
      // Plausible gaps on the other sprockets, measured on this derailleur: 3 to 20 mm up to a
      // 36-tooth sprocket; on wider cassettes (a long hanger, see rd-fit.ts) up to 45 mm on the
      // smallest ones, as a road derailleur sits far below small sprockets on a wide cassette.
      const maxGap = B.cassette[B.n - 1] > 36 ? 45 : 20;
      const zs = B.zs.flatMap((z, i) => (i ? [(B.zs[i - 1] + z) / 2, z] : [z]));
      for (const z of zs) {
        m.setDer(z, GAP_OK);
        const i = B.zs.indexOf(z);
        const where = i >= 0 ? `gear ${i + 1}` : `between gears at ${mm(z).toFixed(1)}`;
        // the chain has its one length everywhere, taut around every wheel
        expect(m.links, `${label}, ${where}: links`).toBe(d.fit.links);
        expect(mm(Math.abs(chordLength(m.path, PITCH) - d.fit.links * PITCH)), `${label}, ${where}: chain length`).toBeLessThan(0.1);
        if (i < 0) continue;
        expect(mm(Math.abs(drawn().z - z)), `${label}, ${where}: upper pulley in line`).toBeLessThan(0.2);
        const gap = mm(gapNow(i));
        if (i === B.n - 1) expect(Math.abs(gap - mm(GAP_OK)), `${label}: gap on the largest sprocket`).toBeLessThan(0.5);
        else expect(gap, `${label}, ${where}: gap`).toBeGreaterThan(2);
        expect(gap, `${label}, ${where}: gap`).toBeLessThan(maxGap);
      }
      // turning the B screw in opens the gap, steadily: the screw goes further in as the gap grows
      let prev = { gap: -1, s: -Infinity };
      for (let k = 0; k <= 8; k++) {
        const target = GAP_SMALL + ((GAP_BIG - GAP_SMALL) * k) / 8;
        m.setDer(m.zOf(B.n - 1), target);
        const gap = gapNow(B.n - 1);
        const s = d.bScrew.group.position.clone().sub(d.bScrew.base).dot(d.bScrew.d);
        expect(mm(Math.abs(gap - target)), `${label}: gap ${mm(target).toFixed(1)} mm`).toBeLessThan(0.5);
        expect(gap, `${label}: the gap opens`).toBeGreaterThan(prev.gap);
        expect(s, `${label}: the B screw goes in`).toBeGreaterThan(prev.s);
        prev = { gap, s };
      }
      m.dispose();
    }
  }, 30000);

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
        const bad = meshPoints(m, ['rear_derailleur', ...partsOf('frame')], 2, { stride: 3, noPulleys: true }).find(({ p }) => Math.hypot(p.x - B.rx, p.y - B.huby) < 0.4 && hitsSprocket(B, p, 0, 0) !== undefined);
        expect(bad?.part, JSON.stringify(facts)).toBeUndefined();
      }
      m.dispose();
    }
  }, 20000);

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
    expect(dirSign('clockwise')).toBe(1);
    expect(dirSign('counterclockwise')).toBe(-1);
    expect(dirSign('away_from_spokes')).toBe(-1);
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
