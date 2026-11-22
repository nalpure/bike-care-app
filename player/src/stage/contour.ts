// Contours (Frame.contour): the outline of parts where they rest, the correct or starting pose, drawn on top
// while a clip moves the parts themselves. Only named clips ask for them (decisions.md, "Clips own the scene").
// The lines are the parts' sharp edges (35 deg, as their dark outlines), in one colour that is neither the
// highlight nor the "bad" red; they ease in and out with the clip and fade with the part they belong to.

import * as T from 'three';
import type { BikeModel, Part } from './bike.js';
import { partsOf } from './registry.js';

interface Item {
  /** the listed part whose group the mesh sits in (the one a motion moves) */
  owner: Part;
  /** the part the mesh itself belongs to (its opacity) */
  part: Part | undefined;
  mesh: T.Mesh;
  line: T.LineSegments;
  /** the edge geometry was made here (not shared with the mesh's own outline) */
  own: boolean;
}

const tA = new T.Matrix4();
const tB = new T.Matrix4();

export class Contours {
  private group = new T.Group();
  private items: Item[] = [];
  private key = '';
  private on = 0;
  readonly mat = new T.LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, opacity: 0 });

  constructor(private m: BikeModel) {
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    m.bike.add(this.group);
  }

  /** Draws the rest outline of the nodes (none: fades out). Call every frame after the parts were moved. */
  update(nodes: string[] | undefined, dt: number, colour: T.Color): void {
    const want = nodes?.length ? nodes.join(' ') : '';
    if (want && want !== this.key) this.build(nodes!);
    this.on += ((want ? 1 : 0) - this.on) * (1 - Math.exp(-dt * 6));
    this.group.visible = this.on > 0.01 && this.items.length > 0;
    if (!this.group.visible) return;
    this.mat.color.copy(colour);
    this.mat.opacity = 0.8 * this.on;
    // a mesh's rest place: its place inside the moved group, with the group back where it rests (no turn, no scale).
    // The bike's own matrix is current (the stage updates the scene after the pose); the moved groups are updated here.
    const inv = tB.copy(this.m.bike.matrixWorld).invert();
    const done = new Set<Part>();
    for (const it of this.items) {
      const g = it.owner.group;
      if (!done.has(it.owner)) {
        g.updateMatrixWorld(true);
        done.add(it.owner);
      }
      const rest = tA.makeTranslation(it.owner.basePos.x, it.owner.basePos.y, it.owner.basePos.z);
      if (g.parent) rest.premultiply(g.parent.matrixWorld);
      const local = it.line.matrix.copy(g.matrixWorld).invert().multiply(it.mesh.matrixWorld);
      local.premultiply(rest).premultiply(inv);
      it.line.matrixWorldNeedsUpdate = true;
      it.line.visible = (it.part?.vis ?? 1) > 0.05;
    }
  }

  private build(nodes: string[]): void {
    this.clear();
    this.key = nodes.join(' ');
    const seen = new Set<T.Mesh>();
    for (const id of nodes.flatMap((n) => partsOf(n))) {
      const owner = this.m.parts.get(id);
      if (!owner) continue;
      owner.group.traverse((o) => {
        const mesh = o as T.Mesh;
        if (!mesh.isMesh || (mesh as any).isInstancedMesh || seen.has(mesh) || !mesh.userData.partId) return;
        seen.add(mesh);
        const shared = mesh.children.find((c) => (c as T.LineSegments).isLineSegments) as T.LineSegments | undefined;
        const geo = shared?.geometry ?? new T.EdgesGeometry(mesh.geometry, 35);
        const line = new T.LineSegments(geo, this.mat);
        line.matrixAutoUpdate = false;
        line.renderOrder = 8;
        line.raycast = () => {};
        this.group.add(line);
        this.items.push({ owner, part: this.m.parts.get(mesh.userData.partId), mesh, line, own: !shared });
      });
    }
  }

  private clear(): void {
    for (const it of this.items) {
      this.group.remove(it.line);
      if (it.own) it.line.geometry.dispose();
    }
    this.items = [];
    this.key = '';
  }
}
