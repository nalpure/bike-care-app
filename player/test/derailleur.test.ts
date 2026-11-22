// The rear derailleur's measured rig (rd-rig.ts) and its kinematics (rd-kin.ts).
import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { anglesOf, LINK_SWING, pulleySpin, rdPose, RIG, type RdAngles, type RdPose } from '../src/stage/rd-kin.js';
import { libGeo, type LibName } from '../src/stage/library.js';

const MM = 1 / 500; // scene units per mm
const DEG = Math.PI / 180;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** the matrix each library piece gets in a pose (pulleys not spun) */
function pieceMatrices(p: RdPose, bolt: T.Vector3): [LibName, T.Matrix4][] {
  const hanger = new T.Matrix4().makeTranslation(bolt.x - RIG.B.x, bolt.y - RIG.B.y, bolt.z - RIG.B.z);
  return [
    ['rd_hanger', hanger],
    ['rd_upper_body', p.upper], ['rd_barrel', p.upper],
    ['rd_link_outer', p.linkOuter], ['rd_link_inner', p.linkInner],
    ['rd_lower_body', p.lower],
    ['rd_cage_outer', p.cage], ['rd_cage_inner', p.cage],
    ['rd_pulley_upper', p.cage.clone().multiply(pulleySpin('upper', 0))],
    ['rd_pulley_lower', p.cage.clone().multiply(pulleySpin('lower', 0))],
  ];
}

describe('rear derailleur rig', () => {
  it('closes the four-bar through the whole swing: both links stay on both bodies within 0.2 mm', () => {
    // two points on each pin axis, 6 mm apart, so a pin that tilts or slides off is caught too
    const pinPts = (v: T.Vector3) => [v, v.clone().addScaledVector(RIG.a, 6 * MM)];
    const bolt = new T.Vector3(0.3, -0.1, 0.02);
    let worst = 0;
    let steps = 0;
    const n = 110;
    for (let i = 0; i <= n; i++) {
      const link = LINK_SWING.min + ((LINK_SWING.max - LINK_SWING.min) * i) / n;
      const p = rdPose(bolt, { body: RIG.src.body + 0.2, link, cage: RIG.src.cage });
      expect(p.ok, `link ${((link - RIG.src.link) / DEG).toFixed(0)} deg from the source`).toBe(true);
      const joints: [T.Matrix4, T.Matrix4, T.Vector3][] = [
        [p.linkOuter, p.upper, RIG.UO], [p.linkInner, p.upper, RIG.UI],
        [p.linkOuter, p.lower, RIG.LO], [p.linkInner, p.lower, RIG.LI],
      ];
      for (const [m1, m2, v] of joints) for (const q of pinPts(v)) worst = Math.max(worst, q.clone().applyMatrix4(m1).distanceTo(q.clone().applyMatrix4(m2)));
      steps++;
    }
    expect(steps).toBe(n + 1);
    // the swing moves the upper pulley sideways by more than the widest cassette (about 39 mm)
    const zAt = (link: number) => RIG.Up.clone().applyMatrix4(rdPose(RIG.B, { ...RIG.src, link }).cage).z;
    expect((zAt(LINK_SWING.min) - zAt(LINK_SWING.max)) / MM).toBeGreaterThan(45);
    expect(worst).toBeLessThan(0.2 * MM);
  });

  it('puts every piece back where it sits in the source at the source pose (0.1 mm, 0.1 deg)', () => {
    const p = rdPose(RIG.B, RIG.src);
    for (const [name, m] of pieceMatrices(p, RIG.B)) {
      const g = libGeo(name);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      let move = 0;
      for (let i = 0; i < 8; i++) {
        const c = new T.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
        move = Math.max(move, c.clone().applyMatrix4(m).distanceTo(c));
      }
      const q = new T.Quaternion();
      m.decompose(new T.Vector3(), q, new T.Vector3());
      const turn = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
      expect(move / MM, `${name} moves (mm)`).toBeLessThan(0.1);
      expect(turn / DEG, `${name} turns (deg)`).toBeLessThan(0.1);
    }
  });

  it('means what its angles say: a pose reads back the angles it was made from', () => {
    const bolt = new T.Vector3(-0.1, 0.25, 0.07);
    const cases: [number, number, number][] = [[0, 0, 0], [12, 0, 0], [0, 25, 0], [0, -30, 0], [0, 0, -35], [-8, 18, 40]];
    for (const [b, l, c] of cases) {
      const ang: RdAngles = { body: RIG.src.body + b * DEG, link: RIG.src.link + l * DEG, cage: RIG.src.cage + c * DEG };
      const back = anglesOf(rdPose(bolt, ang));
      for (const k of ['body', 'link', 'cage'] as const) expect(Math.abs(wrap(back[k] - ang[k])), `${k} for ${b}/${l}/${c}`).toBeLessThan(1e-6);
      // the bolt stays where it was put
      expect(RIG.B.clone().applyMatrix4(rdPose(bolt, ang).upper).distanceTo(bolt)).toBeLessThan(1e-9);
    }
  });

  it('has a measured rig that matches the model: 82 mm cage, real link lengths, bolt along z', () => {
    expect(RIG.Up.distanceTo(RIG.Lp) / MM).toBeGreaterThan(81);
    expect(RIG.Up.distanceTo(RIG.Lp) / MM).toBeLessThan(83);
    expect(RIG.lOuter / MM).toBeCloseTo(38.5, 1);
    expect(RIG.lInner / MM).toBeCloseTo(38.5, 1);
    expect(Math.abs(RIG.Bd.z)).toBeGreaterThan(0.999);
  });
});
