// The 3D stage without a browser: the registry, the manifest, the bike builder, views and
// animations. WebGL itself is covered by the browser walk (npm run test:e2e).

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { dirSign, makeAnim, type AnimCtx } from '../src/stage/anim.js';
import { BikeModel, bikeSpec, GAP_OK } from '../src/stage/bike.js';
import { buildPath, newPath } from '../src/stage/chain.js';
import { CLIPS, LABEL_SCENES, manifest, MOTIONS, NODES, partsOf, VIEWS } from '../src/stage/registry.js';
import { viewPose } from '../src/stage/views.js';

const REPO = resolve(import.meta.dirname, '../..');
const mat = new T.MeshStandardMaterial();

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

  it('lays a closed chain path', () => {
    const p = newPath();
    const len = buildPath([{ x: 0, y: 0, z: 0, r: 0.2, s: 1 }, { x: -1, y: 0.3, z: 0, r: 0.1, s: 1 }], p);
    expect(len).toBeGreaterThan(2);
    expect(p.x[p.n - 1]).toBeCloseTo(p.x[0]);
    expect(p.y[p.n - 1]).toBeCloseTo(p.y[0]);
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
