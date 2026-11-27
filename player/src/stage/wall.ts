// The wall a parked bike leans on (pose 'parked', park.ts): where it stands follows from this bike's meshes as they sit
// when parked (leaning, bar turned), so a new part that sticks out moves the wall without a change here. World space.

import * as T from 'three';
import { GROUND, type BikeModel } from './bike.js';
import { leanPt, PARK_HIDES, PARK_STEER, tyrePts, wallLine, type P2, type WallLine } from './park.js';

/** The wall's size: 5 m long, 2.2 m high, 15 cm thick (drawing values). */
const WALL = { len: 10, h: 4.4, thick: 0.3 };
/** Parts that rest on the wall (the rear wheel's tyre, rim and spokes) and parts not drawn when parked: not in the way. */
const NOT_IN_WAY = new Set(['rear_wheel', ...PARK_HIDES]);

/** Every vertex of the bike that must stay off the wall, as world plan points (x, z) in the parked pose. */
function restPts(m: BikeModel): P2[] {
  const before = m.steerAngle;
  m.setSteer(PARK_STEER);
  m.bike.updateMatrixWorld(true);
  const toBike = m.bike.matrixWorld.clone().invert();
  const out: P2[] = [];
  const v = new T.Vector3();
  const im = new T.Matrix4();
  const mw = new T.Matrix4();
  m.bike.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh || NOT_IN_WAY.has(mesh.userData.partId)) return;
    const pos = mesh.geometry.getAttribute('position');
    const base = new T.Matrix4().multiplyMatrices(toBike, mesh.matrixWorld);
    const inst = (mesh as T.InstancedMesh).isInstancedMesh ? (mesh as T.InstancedMesh) : null;
    for (let i = 0; i < (inst ? inst.count : 1); i++) {
      if (inst) {
        inst.getMatrixAt(i, im);
        mw.multiplyMatrices(base, im);
      } else mw.copy(base);
      for (let j = 0; j < pos.count; j++) {
        v.fromBufferAttribute(pos, j).applyMatrix4(mw);
        const w = leanPt([v.x, v.y, v.z]);
        out.push([w[0], w[2]]);
      }
    }
  });
  m.setSteer(before);
  return out;
}

/** Where the wall stands for this bike, or null when no angle keeps it off everything but the rear tyre. */
export function wallFor(m: BikeModel): WallLine | null {
  const tyre = tyrePts(m.spec).map((p): P2 => {
    const w = leanPt(p);
    return [w[0], w[2]];
  });
  return wallLine(tyre, restPts(m));
}

/** The wall as a mesh in world space, its face on `line`, centred beside the middle of the bike. */
export function buildWall(m: BikeModel, line: WallLine, mat: T.Material): T.Mesh {
  const { angle, d } = line;
  const n: P2 = [Math.sin(angle), Math.cos(angle)];
  // the point of the face nearest the middle of the bike, then half the thickness behind the face
  const mid: P2 = [(m.spec.rx + m.spec.FX) / 2, 0];
  const off = n[0] * mid[0] + n[1] * mid[1] - d + WALL.thick / 2;
  const wall = new T.Mesh(new T.BoxGeometry(WALL.len, WALL.h, WALL.thick), mat);
  // the box's length (local x) runs along the face: (cos a, 0, -sin a) after turning by a about y
  wall.rotation.y = angle;
  wall.position.set(mid[0] - n[0] * off, GROUND + WALL.h / 2, mid[1] - n[1] * off);
  wall.raycast = () => {};
  return wall;
}
