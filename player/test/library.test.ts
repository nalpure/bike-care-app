// The parts library: it loads from disk, matches library.json, survives disposeTree and stays within budget.
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeTree } from '../src/stage/geo.js';
import { hasLibrary, libGeo, LIB_NAMES, type LibName } from '../src/stage/library.js';

const dir = resolve(import.meta.dirname, '../public/parts');
const meta = JSON.parse(readFileSync(resolve(dir, 'library.json'), 'utf8'));
const tris = (g: T.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('parts library', () => {
  it('has every part', () => {
    expect(hasLibrary()).toBe(true);
    for (const n of LIB_NAMES) {
      const g = libGeo(n);
      expect(g.userData.lib, n).toBe(true);
      expect(g.getAttribute('normal'), n).toBeTruthy();
    }
    expect(Object.keys(meta.parts).sort()).toEqual([...LIB_NAMES].sort());
  });

  it('matches library.json: triangles and box', () => {
    for (const n of LIB_NAMES) {
      const g = libGeo(n);
      expect(tris(g), n).toBe(meta.parts[n].trisAfter);
      g.computeBoundingBox();
      const b = meta.parts[n].box;
      const mm = 500;
      for (const [i, k] of (['x', 'y', 'z'] as const).entries()) {
        expect(Math.abs(g.boundingBox!.min[k] - b.min[i]) * mm, `${n} min ${k}`).toBeLessThan(0.05);
        expect(Math.abs(g.boundingBox!.max[k] - b.max[i]) * mm, `${n} max ${k}`).toBeLessThan(0.05);
      }
    }
  });

  it('survives disposeTree', () => {
    const group = new T.Group();
    for (const n of LIB_NAMES) group.add(new T.Mesh(libGeo(n), new T.MeshStandardMaterial()));
    let disposed = 0;
    for (const n of LIB_NAMES) libGeo(n).addEventListener('dispose', () => disposed++);
    disposeTree(group);
    expect(disposed).toBe(0);
    // a generated geometry is still disposed
    const own = new T.BoxGeometry();
    let own_disposed = false;
    own.addEventListener('dispose', () => { own_disposed = true; });
    disposeTree(new T.Mesh(own, new T.MeshStandardMaterial()));
    expect(own_disposed).toBe(true);
  });

  it('names a missing part clearly', () => {
    expect(() => libGeo('nope' as LibName)).toThrow(/not loaded/);
  });

  it('stays within budget', () => {
    const total = LIB_NAMES.reduce((s, n) => s + tris(libGeo(n)), 0);
    expect(total).toBe(meta.totalTriangles);
    expect(total).toBeLessThanOrEqual(35000);
    expect(statSync(resolve(dir, 'library.glb')).size).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  });
});
