// The parts library: real part shapes (built by `npm run parts` from tools/assets/library/library.yaml) loaded once at start.
// Every geometry is in library space: scene units (1 unit = 0.5 m), x forward, y up, z to the drive side,
// origin at the source's bottom bracket centre. Parts are not moved to their own origin; builders place them
// from measured points (player/public/parts/library.json). The geometries are shared: never dispose them.

import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const LIB_NAMES = ['rd_upper_body', 'rd_barrel', 'rd_link_outer', 'rd_link_inner', 'rd_lower_body',
  'rd_cage_outer', 'rd_cage_inner', 'rd_pulley_upper', 'rd_pulley_lower', 'rd_hanger',
  'crank_arms', 'pedal_drive', 'pedal_nondrive', 'saddle', 'seat_collar', 'stem', 'bar_flat',
  'grip_drive', 'grip_nondrive'] as const;
export type LibName = (typeof LIB_NAMES)[number];

const CREASE = T.MathUtils.degToRad(35);
const geos = new Map<LibName, T.BufferGeometry>();

/** Browser: fetches ./parts/library.glb. Tests pass the file's bytes. Loading twice does nothing. */
export async function loadLibrary(bytes?: ArrayBuffer): Promise<void> {
  if (hasLibrary()) return;
  const loader = new GLTFLoader();
  const gltf = bytes ? await loader.parseAsync(bytes, '') : await loader.loadAsync('./parts/library.glb');
  gltf.scene.updateMatrixWorld(true);
  const loaded = new Map<LibName, T.BufferGeometry>();
  for (const name of LIB_NAMES) {
    const mesh = gltf.scene.getObjectByName(name) as T.Mesh | undefined;
    if (!mesh?.isMesh) throw new Error(`The parts library has no part "${name}".`);
    loaded.set(name, toLibSpace(mesh));
  }
  for (const [name, g] of loaded) geos.set(name, g);
}

/** The file is quantized (integer positions with a scale on the node): bake that into plain floats, then crease the normals. */
function toLibSpace(mesh: T.Mesh): T.BufferGeometry {
  const src = mesh.geometry;
  const pa = src.getAttribute('position');
  const pos = new Float32Array(pa.count * 3);
  const v = new T.Vector3();
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i).applyMatrix4(mesh.matrixWorld);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setIndex(Array.from(src.index!.array));
  const out = toCreasedNormals(g, CREASE);
  g.dispose();
  out.userData.lib = true;
  return out;
}

export function hasLibrary(): boolean {
  return geos.size === LIB_NAMES.length;
}

/** Shared geometry of one part, in library space, creased normals. `userData.lib` is true; never dispose it. */
export function libGeo(name: LibName): T.BufferGeometry {
  const g = geos.get(name);
  if (!g) throw new Error(`Library part "${name}" is not loaded (call loadLibrary first).`);
  return g;
}
