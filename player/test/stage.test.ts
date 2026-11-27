// The 3D stage without a browser: the registry, the manifest, the bike builder, views and
// animations. WebGL itself is covered by the browser walk (npm run test:e2e).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { dirSign, makeAnim, partStatus, placeMoved, TOUR, type AnimCtx } from '../src/stage/anim.js';
import { BARREL_HOLDERS, barrelPick, frontPlace, pickedParts, turnKey, turnPart } from '../src/stage/barrel.js';
import { barrelTurn, inlineRun } from '../src/stage/derailleur.js';
import { batteryLine, BikeModel, bikeSpec, distSeg, GAP_BIG, GAP_OK, GAP_SMALL, GEOMETRY_RANGES, GROUND, PITCH, RP, STEER_PARTS, type BikeSpec } from '../src/stage/bike.js';
import { chordLength } from '../src/stage/pins.js';
import { RIG } from '../src/stage/rd-kin.js';
import { RD_RIG } from '../src/stage/rd-rig.js';
import { buildPath, newPath } from '../src/stage/chain.js';
import { CLIPS, GROUP_NODES, HELD_PARTS, LABEL_SCENES, manifest, modelOf, MOTIONS, NODE_PARTS, NODES, partsOf, previewNode, SPLIT_PARTS, VIEWS } from '../src/stage/registry.js';
import { addHeld, FADED, shownParts, visTargets, type VisCard } from '../src/stage/visibility.js';
import { barrelClose, fitPose, FIT_VIEWS, viewPose } from '../src/stage/views.js';

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

function ctxFor(m: BikeModel, focus: string[] = [], fact?: string): AnimCtx {
  return {
    spec: m.spec, focus, poseBefore: 'ground', pose: 'ground',
    barrel: barrelPick(m.spec.bar, fact), route: m.cableRoute,
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

describe('framing what a card draws (fitPose)', () => {
  const B = bikeSpec({ 'bike.category': 'road_gravel', 'drive.gear_type': 'derailleur', 'drive.rear_speeds': 11 });
  const vp = viewPose('drive_side', B)!;
  const tanV = Math.tan((17.5 * Math.PI) / 180);

  /** where points land on the picture: x / tanH and y / tanV, -1 to 1 inside */
  function onScreen(pose: { p: number[]; t: number[] }, pts: Array<[number, number, number]>, aspect: number) {
    const cam = new T.PerspectiveCamera(2 * 17.5, aspect, 0.1, 100);
    cam.position.set(...(pose.p as [number, number, number]));
    cam.lookAt(...(pose.t as [number, number, number]));
    cam.updateMatrixWorld(true);
    const xs = pts.map((p) => new T.Vector3(...p).project(cam));
    return { minX: Math.min(...xs.map((v) => v.x)), maxX: Math.max(...xs.map((v) => v.x)), minY: Math.min(...xs.map((v) => v.y)), maxY: Math.max(...xs.map((v) => v.y)) };
  }

  it('centres the points, fills the picture on one side and keeps them all inside', () => {
    const pts: Array<[number, number, number]> = [[-0.9, 0.3, 0.1], [-0.9, 0.0, -0.1], [0.4, 0.5, 0.1], [0.4, -0.2, -0.1], [-0.2, 0.9, 0], [-0.2, -0.4, 0]];
    for (const aspect of [0.9, 1.78]) {
      const s = onScreen(fitPose(vp, pts, tanV, aspect), pts, aspect);
      expect(s.minX, `aspect ${aspect}`).toBeGreaterThan(-1);
      expect(s.maxX).toBeLessThan(1);
      expect(s.minY).toBeGreaterThan(-1);
      expect(s.maxY).toBeLessThan(1);
      // centred
      expect(Math.abs(s.minX + s.maxX)).toBeLessThan(0.03);
      expect(Math.abs(s.minY + s.maxY)).toBeLessThan(0.03);
      // filling: the larger side takes at least 80 % of the picture
      expect(Math.max(s.maxX - s.minX, s.maxY - s.minY)).toBeGreaterThan(1.6);
    }
  });

  it('keeps the view direction and does nothing without points', () => {
    expect(fitPose(vp, [], tanV, 1)).toBe(vp);
    const f = fitPose(vp, [[0, 0, 0], [0.3, 0.2, 0]], tanV, 1);
    const dir = (a: number[], b: number[]) => { const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const l = Math.hypot(...d); return d.map((x) => x / l); };
    const d0 = dir(vp.p, vp.t);
    const d1 = dir(f.p, f.t);
    for (let i = 0; i < 3; i++) expect(d1[i]).toBeCloseTo(d0[i], 6);
  });

  it('only wide views are framed', () => {
    expect(FIT_VIEWS).toEqual(['drive_side']);
  });
});

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
    expect(partsOf('drivetrain')).toEqual(expect.arrayContaining(['chainring', 'crank', 'chain', 'cassette', 'rear_derailleur', 'upper_pulley', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'rear_barrel']));
    for (const no of ['shift_cable', 'shifter_rear', 'rear_wheel', 'front_wheel', 'frame', 'front_barrel']) expect(partsOf('drivetrain'), no).not.toContain(no);
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
    const DER = ['rear_derailleur', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'rear_barrel', 'shift_cable'];
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
    // combined brake and shift levers have no barrel adjuster (it sits in the cable); trigger shifters do
    expect(frontPlace(bikeSpec({ 'bike.category': 'trekking_city', 'bike.handlebar': 'drop' }).bar)).toBe('inline');
    expect(frontPlace(bikeSpec({ 'bike.category': 'road_gravel', 'bike.handlebar': 'flat' }).bar)).toBe('shifter');
    for (const bar of ['drop', 'flat', 'riser']) {
      const m = new BikeModel(bikeSpec({ 'bike.handlebar': bar }), mat);
      expect(m.has('brake_lever') && m.has('shifter_rear') && m.has('rear_barrel') && m.has('front_barrel'), bar).toBe(true);
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

describe('barrel adjusters (barrel.ts)', () => {
  const BARS = [
    { bar: 'drop', facts: { 'bike.category': 'road_gravel', 'bike.handlebar': 'drop', 'drive.gear_type': 'derailleur' } },
    { bar: 'flat', facts: { 'bike.category': 'trekking_city', 'bike.handlebar': 'flat', 'drive.gear_type': 'derailleur' } },
    { bar: 'riser', facts: { 'bike.category': 'mtb', 'bike.handlebar': 'riser', 'drive.gear_type': 'derailleur' } },
  ] as const;
  const sub = (a: ArrayLike<number>, b: ArrayLike<number>) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** distance from p to a polyline */
  const toLine = (p: ArrayLike<number>, line: ArrayLike<number>[]) => Math.min(...line.slice(1).map((b, i) => {
    const a = line[i];
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
    return Math.hypot(...sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
  }));

  it('draws two barrels on every bar type: at the derailleur, and on the shifter (flat, riser) or in the cable behind a drop bar', () => {
    for (const { bar, facts } of BARS) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      expect(B.bar).toBe(bar);
      expect(m.has('rear_barrel') && m.has('front_barrel'), bar).toBe(true);
      expect(frontPlace(B.bar)).toBe(bar === 'drop' ? 'inline' : 'shifter');
      const front = barrelTurn(B, 'front_barrel');
      // both sit on the cable as it is drawn
      expect(toLine(front.pos, m.cableRoute), `${bar}: front barrel off the cable`).toBeLessThan(0.025);
      if (bar === 'drop') {
        const { a, b } = inlineRun(B);
        expect(front.pos[0]).toBeCloseTo((a[0] + b[0]) / 2);
        // behind the bar: not at the hood (S) but by the stem's clamp
        expect(Math.hypot(front.pos[0] - B.S[0], front.pos[1] - B.S[1], front.pos[2] - B.S[2])).toBeGreaterThan(0.15);
        expect(Math.hypot(front.pos[0] - B.C[0], front.pos[1] - B.C[1])).toBeLessThan(0.12);
      } else {
        expect(Math.hypot(front.pos[0] - B.S[0], front.pos[1] - B.S[1], front.pos[2] - B.S[2]), `${bar}: on the shifter`).toBeLessThan(0.06);
      }
      // the plain cable stop is gone: the derailleur's barrel is its own part, the turnable one
      expect(m.turns.has('rear_barrel') && m.turns.has('front_barrel')).toBe(true);
      m.dispose();
    }
    const hub = new BikeModel(bikeSpec({ 'drive.gear_type': 'hub_gear' }), mat);
    expect(hub.has('rear_barrel') || hub.has('front_barrel')).toBe(false);
    hub.dispose();
  });

  it('the fact picks the barrel that is marked, turned and framed; unknown marks both and turns the old guess', () => {
    const both = ['rear_barrel', 'front_barrel'];
    for (const bar of ['drop', 'flat', 'riser'] as const) {
      expect(barrelPick(bar, 'derailleur'), bar).toEqual({ main: 'rear_barrel', marked: ['rear_barrel'] });
      expect(barrelPick(bar, 'shifter'), bar).toEqual({ main: 'front_barrel', marked: ['front_barrel'] });
      // on flat and riser bars the adjuster on the cable is shown at the shifter (owner rule); on drop bars behind the bar
      expect(barrelPick(bar, 'inline'), bar).toEqual({ main: 'front_barrel', marked: ['front_barrel'] });
      for (const unknown of [undefined, 'unknown', '']) {
        expect(barrelPick(bar, unknown), bar).toEqual({ main: bar === 'drop' ? 'rear_barrel' : 'front_barrel', marked: both });
      }
    }
    const pk = barrelPick('flat', 'shifter');
    expect(pickedParts('barrel_adjuster', pk, partsOf)).toEqual(['front_barrel']);
    expect(pickedParts('barrel_adjuster', barrelPick('drop', undefined), partsOf)).toEqual(both);
    expect(pickedParts('chain', pk, partsOf)).toEqual(['chain']);
    expect(partsOf('barrel_adjuster')).toEqual(both);
    expect(turnPart('barrel_adjuster', pk)).toBe('front_barrel');
    expect(turnPart('h_screw', pk)).toBe('h_screw');
    expect(turnKey('front_barrel', pk)).toBe('barrel_adjuster');
    expect(turnKey('rear_barrel', pk)).toBe('rear_barrel');
    expect(previewNode('rear_barrel')).toBe('barrel_adjuster');
  });

  it('a barrel is drawn with what holds it: the rear one with the derailleur, the front one with the shifter or the cable', () => {
    const m = new BikeModel(bikeSpec(BARS[1].facts), mat);
    const has = (p: string) => m.has(p);
    const shown = (show: string[]) => addHeld(shownParts([], show, partsOf, has), BARREL_HOLDERS, has);
    expect(shown(['drivetrain']).has('rear_barrel')).toBe(true);
    expect(shown(['drivetrain']).has('front_barrel'), 'the front barrel is not in the drivetrain').toBe(false);
    expect(shown(['rear_derailleur']).has('rear_barrel')).toBe(true);
    expect(shown(['shifter_rear']).has('front_barrel')).toBe(true);
    expect(shown(['shift_cable']).has('front_barrel')).toBe(true);
    expect(shown(['handlebar']).has('front_barrel')).toBe(false);
    m.dispose();
  });

  it('the cable clamp bolt is its own part: drawn with the derailleur, not marked with it, turnable like the limit screws', () => {
    const m = new BikeModel(bikeSpec(BARS[1].facts), mat);
    const has = (p: string) => m.has(p);
    expect(m.has('cable_bolt')).toBe(true);
    expect(partsOf('rear_derailleur')).not.toContain('cable_bolt');
    expect(m.turns.has('cable_bolt')).toBe(true);
    expect(addHeld(shownParts([], ['rear_derailleur'], partsOf, has), HELD_PARTS, has).has('cable_bolt')).toBe(true);
    const { targets } = visTargets(card(m, ['rear_derailleur'], ['rear_derailleur', 'cassette']));
    expect(targets.get('cable_bolt')?.hot, 'marking the derailleur does not mark the bolt').toBe(0);
    expect(targets.get('rear_derailleur')?.hot).toBe(1);
    m.dispose();
  });

  it('every barrel turns about an axis from the side where the cable goes in, and its close-up looks at that side', () => {
    for (const { bar, facts } of BARS) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const B = m.spec;
      // rear: the housing comes in from behind, at the head
      const rear = barrelTurn(B, 'rear_barrel');
      expect(dot(sub(m.der!.housingFrom, rear.pos), rear.axis), `${bar}: housing at the rear barrel's head`).toBeLessThan(0);
      // front: the housing towards the frame leaves the shifter's barrel at its head; the inline one has the
      // cable from the shifter at its head
      const front = barrelTurn(B, 'front_barrel');
      const route = m.cableRoute;
      const near = route.findIndex((p) => Math.hypot(...sub(p, front.pos)) < front.len);
      const side = bar === 'drop' ? route[0] : route[Math.max(0, near) + 2];
      expect(dot(sub(side, front.pos), front.axis), `${bar}: cable at the front barrel's head`).toBeLessThan(0);
      for (const which of ['rear_barrel', 'front_barrel'] as const) {
        const t = barrelTurn(B, which);
        const v = viewPose('barrel_adjuster_close', B, which)!;
        expect(v.t[0]).toBeCloseTo(t.pos[0], 1);
        expect(v, `${bar} ${which}`).toEqual(barrelClose(B, which));
        expect(dot(sub(v.p, t.pos), t.axis), `${bar} ${which}: the close-up looks at the head`).toBeLessThan(0);
      }
      // nothing of the cockpit or the frame stands between the close-up's camera and the barrel (bounding-box
      // framing cannot see that: the first inline place was hidden behind the drop bar's bend)
      const blockers = meshPoints(m, ['handlebar', 'brake_lever', 'shifter_rear', 'frame', 'fork'], 2, { stride: 3 });
      for (const which of ['rear_barrel', 'front_barrel'] as const) {
        const t = barrelTurn(B, which);
        const v = barrelClose(B, which);
        const seg = sub(t.pos, v.p);
        const len2 = dot(seg, seg);
        const hit = blockers.find(({ p }) => {
          const k = dot(sub([p.x, p.y, p.z], v.p), seg) / len2;
          if (k < 0 || k > 0.85) return false;
          return Math.hypot(...sub([p.x, p.y, p.z], [v.p[0] + seg[0] * k, v.p[1] + seg[1] * k, v.p[2] + seg[2] * k])) < 0.004;
        });
        expect(hit && `${hit.part} at ${hit.p.toArray().map((x) => x.toFixed(3))}`, `${bar} ${which}: view blocked`).toBeUndefined();
      }
      // without a pick, the close-up keeps the old guess
      expect(viewPose('barrel_adjuster_close', B)).toEqual(barrelClose(B, bar === 'drop' ? 'rear_barrel' : 'front_barrel'));
      m.dispose();
    }
  });

  it('cable-tension-shift: the picked barrel turns while the pedals and the chain stand still; the scene adds its surroundings', () => {
    for (const { bar, facts } of BARS) {
      const m = new BikeModel(bikeSpec(facts), mat);
      for (const fact of ['derailleur', 'shifter', 'inline', undefined]) {
        const ctx = ctxFor(m, ['chain'], fact);
        const main = ctx.barrel.main;
        for (const direction of ['counterclockwise', 'clockwise']) {
          const an = makeAnim({ target: 'barrel_adjuster', motion: 'rotate', direction, caption: 'x' }, ctx)!;
          const mid = Math.floor(m.spec.n / 2);
          const end = an.frame(an.duration - 0.1);
          const turning = an.frame(2.0);
          const ccw = direction === 'counterclockwise';
          expect(Math.sign(end.screws!.barrel_adjuster!), `${bar} ${fact} ${direction}`).toBe(ccw ? -1 : 1);
          expect(turning.arrow).toEqual({ node: 'barrel_adjuster', dir: ccw ? -1 : 1 });
          // once a problem is tapped the pedals stop (owner, 2026-11-26), so the chain stays where it is
          for (let t = 0; t <= an.duration; t += 0.25) {
            expect(an.frame(t).crankSpeed ?? 0).toBe(0);
            expect(an.frame(t).derZ).toBeCloseTo(m.zOf(mid));
          }
          expect(end.scene?.focus).toEqual([main]);
          expect(end.scene?.show).toEqual(main === 'rear_barrel' ? ['rear_end', 'derailleur_hanger', 'rear_derailleur', 'shift_cable'] : ['handlebar', 'shifter_rear', 'shift_cable', 'frame']);
          expect(end.marks).toBeUndefined();
        }
      }
      m.dispose();
    }
  });

  it('barrel-tour: plays once from close on the derailleur along the cable to close on the front barrel, both marked', () => {
    for (const { bar, facts } of BARS) {
      const m = new BikeModel(bikeSpec(facts), mat);
      const an = makeAnim({ clip: 'barrel-tour', caption: 'x' }, ctxFor(m))!;
      expect(an.once).toBe(true);
      expect(an.duration).toBe(TOUR.end);
      const from = barrelClose(m.spec, 'rear_barrel');
      const to = barrelClose(m.spec, 'front_barrel');
      expect(an.frame(0).cam).toEqual({ p: from.p, t: from.t });
      const last = an.frame(an.duration).cam!;
      for (let i = 0; i < 3; i++) {
        expect(last.p[i]).toBeCloseTo(to.p[i], 6);
        expect(last.t[i]).toBeCloseTo(to.t[i], 6);
      }
      expect(an.frame(1).scene).toEqual({ focus: ['rear_barrel', 'front_barrel'] });
      // smooth: the camera never jumps, and half way it looks at the cable from the drive side
      let prev = an.frame(0).cam!;
      for (let t = 0.05; t <= an.duration; t += 0.05) {
        const c = an.frame(t).cam!;
        expect(Math.hypot(...sub(c.p, prev.p)), `${bar} at ${t.toFixed(2)} s`).toBeLessThan(0.06);
        prev = c;
      }
      const half = an.frame((TOUR.leave + TOUR.near) / 2).cam!;
      expect(toLine(half.t, m.cableRoute), `${bar}: half way the camera looks at the cable`).toBeLessThan(0.08);
      expect(half.p[2]).toBeGreaterThan(half.t[2] + 0.5);
      m.dispose();
    }
  });
});

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

  it('shift-through-gears: the pedals turn all the time, the front wheel never, while the chain goes up through every gear and back down', () => {
    const an = makeAnim({ clip: 'shift-through-gears', caption: 'x' }, ctxFor(m))!;
    const zs = new Set<number>();
    for (let t = 0; t <= an.duration; t += 0.05) {
      const f = an.frame(t);
      expect(f.crankSpeed).toBeGreaterThan(0);
      expect(f.wheelSpeed?.front_wheel ?? 0).toBe(0);
      zs.add(f.derZ!);
    }
    expect(zs.size).toBe(m.spec.n);
    expect(an.frame(0).derZ).toBeCloseTo(m.zOf(0));
    expect(an.frame(an.duration).derZ).toBeCloseTo(m.zOf(0));
  });

  it('shift-test-ride: pedals and both wheels turn all the time while the chain goes up through every gear and back down', () => {
    const an = makeAnim({ clip: 'shift-test-ride', caption: 'x' }, ctxFor(m))!;
    const zs = new Set<number>();
    for (let t = 0; t <= an.duration; t += 0.05) {
      const f = an.frame(t);
      expect(f.crankSpeed).toBeGreaterThan(0);
      expect(f.wheelSpeed?.front_wheel).toBeGreaterThan(0);
      zs.add(f.derZ!);
    }
    expect(zs.size).toBe(m.spec.n);
    expect(an.frame(0).derZ).toBeCloseTo(m.zOf(0));
    expect(an.frame(an.duration).derZ).toBeCloseTo(m.zOf(0));
  });

  it('limit-push-past: from in line with the largest sprocket, in by about one more gear and back; the upper wheel red only while out of line', () => {
    const an = makeAnim({ clip: 'limit-push-past', caption: 'x' }, ctxFor(m))!;
    const large = m.zOf(m.spec.n - 1);
    const step = large - m.zOf(m.spec.n - 2);
    let far = 0;
    for (let t = 0; t <= an.duration; t += 0.05) {
      const f = an.frame(t);
      const off = f.derZ! - large;
      expect(Math.sign(off) * Math.sign(step), 'never out of the largest sprocket\'s line away from the spokes').toBeGreaterThanOrEqual(0);
      expect(Math.abs(off)).toBeLessThanOrEqual(Math.abs(step) + 1e-9);
      far = Math.max(far, Math.abs(off));
      if (f.marks) expect(f.marks).toEqual(['upper_pulley']);
      if (Math.abs(off) < 1e-9) expect(f.marks).toBeUndefined();
      if (Math.abs(off) > Math.abs(step) * 0.5) expect(f.marks).toEqual(['upper_pulley']);
    }
    expect(far, 'it goes about one more gear in').toBeGreaterThan(Math.abs(step) * 0.8);
    expect(an.frame(0).derZ).toBeCloseTo(large);
    expect(an.frame(an.duration).derZ).toBeCloseTo(large);
  });

  it('generic motions never mark parts or draw contours; only clips do', () => {
    for (const target of Object.keys(NODES)) {
      for (const motion of MOTIONS) {
        const an = makeAnim({ target, motion, caption: 'x' }, ctxFor(m))!;
        for (let t = 0; t <= an.duration; t += 0.5) {
          const f = an.frame(t);
          expect(f.marks, `${target} ${motion}`).toBeUndefined();
          expect(f.contour, `${target} ${motion}`).toBeUndefined();
        }
      }
    }
  });

  it('colours marked parts bad, and the derailleur by status', () => {
    expect(partStatus({ marks: ['derailleur_hanger'] }, 'derailleur_hanger')).toBe('bad');
    expect(partStatus({ marks: ['cassette'] }, 'largest_sprocket')).toBe('bad');
    expect(partStatus({ marks: ['derailleur_hanger'], status: 'good' }, 'upper_pulley')).toBe('good');
    expect(partStatus({ status: 'good' }, 'derailleur_hanger')).toBeUndefined();
    expect(partStatus({}, 'rear_derailleur')).toBeUndefined();
  });

  it('hanger-bend: on every kind of bike the hanger and derailleur tilt in, out and back to rest as one, hanger red while bent', () => {
    for (const cat of ['mtb', 'road_gravel', 'trekking_city', 'cargo', 'unknown']) {
      for (const gt of ['derailleur', 'hub_gear', 'single_speed', 'gearbox', 'unknown']) {
        const label = `${cat} ${gt}`;
        const mb = new BikeModel(bikeSpec({ 'bike.category': cat, 'drive.gear_type': gt, 'drive.rear_speeds': 11 }), mat);
        const an = makeAnim({ clip: 'hanger-bend', caption: 'x' }, ctxFor(mb))!;
        expect(an, label).toBeDefined();
        const der = mb.parts.get('rear_derailleur');
        const hanger = mb.parts.get('derailleur_hanger');
        // where the lower pulley's centre is, in bike space, after the frame's motion (or at rest); the derailleur's
        // frames are posed in its group, which sits at the bike's origin at rest
        mb.setDer(mb.derZ, GAP_OK);
        const pulley = (f?: ReturnType<typeof an.frame>) => {
          for (const p of [der, hanger]) {
            if (!p) continue;
            if (f?.node?.parts.includes(p.id)) placeMoved(f.node, p.basePos, p.center, p.group.position, p.group.quaternion);
            else {
              p.group.position.copy(p.basePos);
              p.group.quaternion.identity();
            }
          }
          mb.bike.updateMatrixWorld(true);
          return mb.der?.st && der ? mb.der.st.lp.clone().applyMatrix4(der.group.matrix) : null;
        };
        const rest = pulley();
        let minDz = 0, maxDz = 0;
        for (let t = 0; t <= an.duration + 1e-9; t += 0.05) {
          const f = an.frame(t);
          expect(f.contour, label).toEqual(['derailleur_hanger', 'rear_derailleur']);
          const p = pulley(f);
          if (p && rest) {
            minDz = Math.min(minDz, p.z - rest.z);
            maxDz = Math.max(maxDz, p.z - rest.z);
            // one rigid tilt about the hanger's root: both groups have the same transform, the root stays put
            expect(der!.group.matrixWorld.equals(hanger!.group.matrixWorld), `${label} t=${t}`).toBe(true);
            const root = new T.Vector3(...f.node!.about!);
            expect(root.clone().applyMatrix4(hanger!.group.matrix).distanceTo(root), label).toBeLessThan(1e-9);
          }
          const bent = Math.abs(f.node!.rot[0]) > 0.02;
          if (bent) expect(partStatus(f, 'derailleur_hanger'), `${label} t=${t}`).toBe('bad');
          if (Math.abs(f.node!.rot[0]) < 0.005) expect(partStatus(f, 'derailleur_hanger'), `${label} t=${t}`).toBeUndefined();
          expect(partStatus(f, 'rear_derailleur')).toBeUndefined();
        }
        if (rest) {
          // z grows away from the spokes: first in by a few millimetres or more, then out as far
          expect(minDz, label).toBeLessThan(-0.005);
          expect(maxDz, label).toBeGreaterThan(0.005);
          for (const t of [0, an.duration - 1e-6]) {
            const p = pulley(an.frame(t))!;
            expect(p.distanceTo(rest), `${label} back at rest at t=${t}`).toBeLessThan(1e-6);
          }
        }
        mb.dispose();
      }
    }
  });

  it('a motion on the whole bike goes from how it was held to how it is held now', () => {
    const an = makeAnim({ target: 'bike', motion: 'rotate', caption: 'x' }, { ...ctxFor(m), poseBefore: 'flipped', pose: 'ground' })!;
    expect(an.frame(0).pose).toEqual({ from: 'flipped', to: 'ground', k: 0 });
    expect(an.frame(an.duration).pose?.k).toBe(1);
  });
});

describe('steering hinge (BikeModel.steer, setSteer)', () => {
  const A = 0.17;
  /** every kind of bike: the three bars, every category with every gear type, an e-bike */
  const BIKES: Array<Record<string, unknown>> = [
    ...(['drop', 'flat', 'riser'] as const).map((bar) => ({ 'bike.handlebar': bar, 'drive.gear_type': 'derailleur' })),
    ...['mtb', 'road_gravel', 'trekking_city', 'cargo', 'unknown'].flatMap((cat) => ['derailleur', 'hub_gear', 'single_speed', 'gearbox'].map((gt) => ({ 'bike.category': cat, 'drive.gear_type': gt }))),
    { 'bike.category': 'trekking_city', 'bike.ebike': true, 'drive.gear_type': 'derailleur' },
  ];
  const build = () => BIKES.map((f) => new BikeModel(bikeSpec(f), mat));
  const name = (m: BikeModel) => `${m.spec.kind} ${m.spec.bar} ${m.spec.gears}${m.spec.motor ? ' e-bike' : ''}`;
  /** the hinge as setSteer's doc says, built here on its own: a turn by a about the line from HB up to HT (z = 0) */
  const hinge = (B: BikeSpec, a: number) => {
    const p = new T.Vector3(B.HB[0], B.HB[1], 0);
    const d = new T.Vector3(B.HT[0] - B.HB[0], B.HT[1] - B.HB[1], 0).normalize();
    return new T.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new T.Matrix4().makeRotationAxis(d, a)).multiply(new T.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
  };
  const inSteer = (m: BikeModel, o: T.Object3D) => {
    for (let a: T.Object3D | null = o; a; a = a.parent) if (a === m.steer) return true;
    return false;
  };
  const meshes = (m: BikeModel) => {
    const out: T.Mesh[] = [];
    m.bike.traverse((o: any) => o.isMesh && out.push(o));
    return out;
  };
  /** every mesh's world matrix (the bike is not posed in tests: world space is bike space) */
  const worlds = (m: BikeModel) => {
    m.bike.updateMatrixWorld(true);
    return new Map(meshes(m).map((o) => [o, o.matrixWorld.clone()]));
  };
  const closeM = (a: T.Matrix4, b: T.Matrix4, label: string) => a.elements.forEach((v, i) => expect(v, label).toBeCloseTo(b.elements[i], 9));
  const closeV = (a: ArrayLike<number>, b: ArrayLike<number>, label: string) => [0, 1, 2].forEach((i) => expect(a[i], label).toBeCloseTo(b[i], 9));
  const pos = (o: T.Object3D) => new T.Vector3().setFromMatrixPosition(o.matrixWorld);
  const turned = (p: ArrayLike<number>, H: T.Matrix4) => new T.Vector3(p[0], p[1], p[2]).applyMatrix4(H).toArray();

  it('covers every kind of bike: three bars, a kickstand, a motor, every gear type', () => {
    const ms = build();
    expect(new Set(ms.map((m) => m.spec.bar))).toEqual(new Set(['drop', 'flat', 'riser']));
    expect(new Set(ms.map((m) => m.spec.gears))).toEqual(new Set(['derailleur', 'hub', 'single', 'gearbox']));
    expect(ms.some((m) => m.spec.kickstand) && ms.some((m) => m.spec.motor)).toBe(true);
    for (const m of ms) m.dispose();
  });

  it('builds exactly the parts of STEER_PARTS in the hinge, with their meshes, anchors and turns', () => {
    for (const m of build()) {
      const label = name(m);
      expect(m.steer.parent, label).toBe(m.bike);
      expect(inSteer(m, m.frontHub), label).toBe(true);
      for (const p of m.parts.values()) expect(inSteer(m, p.group), `${label}: ${p.id}`).toBe(STEER_PARTS.includes(p.id));
      for (const o of meshes(m)) expect(inSteer(m, o), `${label}: mesh of ${o.userData.partId}`).toBe(STEER_PARTS.includes(o.userData.partId));
      for (const [id, a] of m.anchors) expect(inSteer(m, a), `${label}: anchor ${id}`).toBe(STEER_PARTS.includes(id));
      for (const [id, t] of m.turns) expect(inSteer(m, t.spin), `${label}: turn ${id}`).toBe(STEER_PARTS.includes(id));
      for (const id of ['fork', 'front_wheel', 'handlebar', 'brake_lever']) expect(m.has(id), `${label}: ${id}`).toBe(true);
      m.dispose();
    }
  });

  it('is the identity at 0, and turning there and back gives every mesh and the cable back exactly', () => {
    for (const m of build()) {
      const label = name(m);
      expect(m.steerAngle).toBe(0);
      expect(m.steer.matrix.equals(new T.Matrix4()), label).toBe(true);
      const w0 = worlds(m);
      const route0 = m.cableRoute.map((p) => [...p]);
      const cable0 = m.cable ? [...(m.cable.mesh.geometry.attributes.position.array as Float32Array)] : null;
      m.setSteer(A);
      m.setSteer(0);
      expect(m.steer.matrix.equals(new T.Matrix4()), label).toBe(true);
      const w = worlds(m);
      expect(w.size, label).toBe(w0.size);
      for (const [o, mw] of w) expect(mw.equals(w0.get(o)!), `${label}: ${o.userData.partId}`).toBe(true);
      expect(m.cableRoute, label).toEqual(route0);
      if (cable0) expect([...(m.cable!.mesh.geometry.attributes.position.array as Float32Array)], label).toEqual(cable0);
      m.dispose();
    }
  });

  it('turns the steering parts rigidly about the steering axis, to the left for a positive angle, and nothing else', () => {
    for (const m of build()) {
      const B = m.spec;
      const label = name(m);
      const w0 = worlds(m);
      const geo0 = new Map(meshes(m).map((o) => [o, o.geometry]));
      const anchors0 = new Map([...m.anchors].map(([id, a]) => [id, pos(a)]));
      const turns0 = new Map([...m.turns].map(([id, t]) => [id, t.spin.matrixWorld.clone()]));
      // the bar's ends (its vertices furthest left and right) and the front of the tyre, found at 0
      type Vx = { o: T.Mesh; i: number };
      const extremes = (id: string) => {
        const best: Record<'lo' | 'hi' | 'front', { v: number; at: Vx | null }> = { lo: { v: Infinity, at: null }, hi: { v: -Infinity, at: null }, front: { v: -Infinity, at: null } };
        m.parts.get(id)!.group.traverse((o: any) => {
          if (!o.isMesh || o.userData.partId !== id) return;
          const ps = o.geometry.attributes.position;
          const v = new T.Vector3();
          for (let i = 0; i < ps.count; i++) {
            v.fromBufferAttribute(ps, i).applyMatrix4(o.matrixWorld);
            if (v.z < best.lo.v) best.lo = { v: v.z, at: { o, i } };
            if (v.z > best.hi.v) best.hi = { v: v.z, at: { o, i } };
            if (v.x > best.front.v) best.front = { v: v.x, at: { o, i } };
          }
        });
        return { lo: best.lo.at!, hi: best.hi.at!, front: best.front.at! };
      };
      const at = (x: Vx) => new T.Vector3().fromBufferAttribute(x.o.geometry.attributes.position as T.BufferAttribute, x.i).applyMatrix4(x.o.matrixWorld);
      const bar = extremes('handlebar');
      const tyre = extremes('front_wheel').front;
      const [left0, right0, tyre0] = [at(bar.lo), at(bar.hi), at(tyre)];
      const H = hinge(B, A);

      m.setSteer(A);
      expect(m.steerAngle).toBe(A);
      m.bike.updateMatrixWorld(true);
      closeM(m.steer.matrix, H, `${label}: hinge`);
      // points on the steering axis stay: the head tube's ends and a point below it
      for (const t of [0, 1, -0.5]) {
        const p = new T.Vector3(B.HB[0] + (B.HT[0] - B.HB[0]) * t, B.HB[1] + (B.HT[1] - B.HB[1]) * t, 0);
        expect(p.clone().applyMatrix4(m.steer.matrixWorld).distanceTo(p), `${label}: axis point ${t}`).toBeLessThan(1e-12);
      }
      for (const [o, mw] of worlds(m)) {
        if (STEER_PARTS.includes(o.userData.partId)) closeM(mw, w0.get(o)!.clone().premultiply(H), `${label}: ${o.userData.partId} turns with the hinge`);
        else expect(mw.equals(w0.get(o)!), `${label}: ${o.userData.partId} stays`).toBe(true);
        // only the cable's main run is laid again
        expect(o.geometry === geo0.get(o), `${label}: geometry of ${o.userData.partId}`).toBe(o !== m.cable?.mesh);
      }
      // the bar's ends move: the left end (-z) back towards the rider, the right end forward; the front of the tyre goes left (-z)
      const [left, right, tyreA] = [at(bar.lo), at(bar.hi), at(tyre)];
      expect(left.x - left0.x, `${label}: left bar end back`).toBeLessThan(-0.03);
      expect(right.x - right0.x, `${label}: right bar end forward`).toBeGreaterThan(0.03);
      expect(tyreA.z - tyre0.z, `${label}: front of the tyre to the left`).toBeLessThan(-0.05);
      // tag anchors and turns of steering parts follow the hinge, the others stay
      for (const [id, a] of m.anchors) {
        if (STEER_PARTS.includes(id)) closeV(pos(a).toArray(), anchors0.get(id)!.clone().applyMatrix4(H).toArray(), `${label}: anchor ${id}`);
        else expect(pos(a).equals(anchors0.get(id)!), `${label}: anchor ${id} stays`).toBe(true);
      }
      for (const [id, t] of m.turns) {
        if (STEER_PARTS.includes(id)) closeM(t.spin.matrixWorld, turns0.get(id)!.clone().premultiply(H), `${label}: turn ${id}`);
        else expect(t.spin.matrixWorld.equals(turns0.get(id)!), `${label}: turn ${id} stays`).toBe(true);
      }
      m.dispose();
    }
  });

  it('the cable follows the bar at its cockpit end and stays on the frame, laid again only when the angle changes', () => {
    const ms = build();
    expect(ms.filter((m) => m.cable).length).toBeGreaterThan(10);
    for (const m of ms.filter((x) => x.cable)) {
      const B = m.spec;
      const label = name(m);
      const c = m.cable!;
      const route0 = m.cableRoute.map((p) => [...p]);
      const shifter = m.parts.get('shifter_rear')!.group;
      const inShifter = (p: ArrayLike<number>) => shifter.worldToLocal(new T.Vector3(p[0], p[1], p[2])).toArray();
      const first0 = inShifter(route0[0]);
      const rear0 = m.der ? [m.der.housing, ...m.der.wire].map((o) => o.matrixWorld.clone()) : [];
      let disposed = 0;
      c.mesh.geometry.addEventListener('dispose', () => disposed++);

      m.setSteer(A);
      m.bike.updateMatrixWorld(true);
      const H = hinge(B, A);
      const geoA = c.mesh.geometry;
      expect(disposed, `${label}: the old cable is disposed`).toBe(1);
      expect(m.cableRoute.length).toBe(c.pts.length);
      // the first point stays where the cable starts: on the shifter (the hood of a drop bar), at the front barrel's head (flat, riser)
      closeV(m.cableRoute[0], turned(route0[0], H), `${label}: first point`);
      closeV(inShifter(m.cableRoute[0]), first0, `${label}: first point on the shifter`);
      if (B.bar !== 'drop' && m.turns.has('front_barrel')) {
        const t = m.turns.get('front_barrel')!;
        // within 0.05 mm: the cable's head uses the barrel's axis as written (not quite unit), the barrel its normalised one
        const head = t.spin.parent!.localToWorld(new T.Vector3(0, -t.len / 2, 0));
        expect(head.distanceTo(new T.Vector3(...m.cableRoute[0])), `${label}: at the front barrel's head`).toBeLessThan(1e-4);
      }
      // cockpit points turn with the hinge, frame points stay exactly
      c.pts.forEach((q, i) => {
        if (q.steer === 1) closeV(m.cableRoute[i], turned(q.p, H), `${label}: cockpit point ${i}`);
        if (q.steer === 0) expect(m.cableRoute[i], `${label}: frame point ${i}`).toEqual(route0[i]);
      });
      expect(c.pts.filter((q) => q.steer === 0).length, label).toBeGreaterThan(1);
      // cableRoute is the path as drawn: the tube's first ring sits around its first point
      const ring = new T.Vector3();
      for (let i = 0; i < 8; i++) ring.add(new T.Vector3().fromBufferAttribute(geoA.attributes.position as T.BufferAttribute, i));
      expect(ring.divideScalar(8).distanceTo(new T.Vector3(...m.cableRoute[0])), label).toBeLessThan(1e-4);
      // the derailleur's end of the cable (placed by setDer) does not change
      if (m.der) [m.der.housing, ...m.der.wire].forEach((o, i) => expect(o.matrixWorld.equals(rear0[i]), `${label}: rear housing and wire`).toBe(true));
      // the same angle again: nothing is laid again
      m.setSteer(A);
      expect(c.mesh.geometry).toBe(geoA);
      m.dispose();
    }
  });

  it('keeps the cable clear of the head tube with the bar turned 15 deg either way', () => {
    for (const m of build().filter((x) => x.cable)) {
      const B = m.spec;
      const axis = new T.Line3(new T.Vector3(B.HB[0], B.HB[1], 0), new T.Vector3(B.HT[0], B.HT[1], 0));
      const q = new T.Vector3();
      for (const a of [-0.26, 0.26]) {
        m.setSteer(a);
        const curve = new T.CatmullRomCurve3(m.cableRoute.map((p) => new T.Vector3(...p)));
        for (let i = 0; i <= 600; i++) {
          const p = curve.getPointAt(i / 600);
          const t = axis.closestPointToPointParameter(p, false);
          if (t < 0 || t > 1) continue;
          // head tube radius 0.04, cable radius 0.006
          expect(p.distanceTo(axis.at(t, q)), `${name(m)} at ${a}`).toBeGreaterThan(0.046);
        }
      }
      m.dispose();
    }
  });
});
