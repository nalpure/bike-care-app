// The cockpit: handlebar, brake levers, the right shifter, and the gear cable that runs from the
// shifter to the derailleur (or hub, or gearbox).
// Session area: E (other parts).

import * as T from 'three';
import { barrelTurn } from './derailleur.js';
import { curveGeo, plate, tubeGeo } from './geo.js';
import { gripOf, HP, stayPts, type V3 } from './spec.js';
import type { BikeModel } from './bike.js';

/** Handlebar, brake levers and the right shifter. */
export function buildCockpit(m: BikeModel): void {
  const B = m.spec;
  const { HT, C, S } = B;
  const [hx, hy] = HT;
  const hasShifter = B.gears !== 'single';
  m.part('handlebar');
  m.part('brake_lever');
  if (hasShifter) m.part('shifter_rear');

  if (B.bar === 'drop') {
    // Drop bar: the hoods hold combined brake and shift levers. The brake lever hangs in front
    // of the curve; on the right, the shift paddle sits behind it.
    m.add('handlebar', tubeGeo([HT[0], HT[1], 0], [C[0], C[1], 0], 0.02));
    for (const sd of [1, -1]) {
      const z = sd * 0.21;
      m.add('handlebar', tubeGeo([C[0], C[1], 0], [C[0], C[1], z], 0.014));
      m.add('handlebar', curveGeo([[C[0], C[1], z], [C[0] + 0.1, C[1] + 0.01, z], [C[0] + 0.18, C[1] - 0.08, z], [C[0] + 0.16, C[1] - 0.19, z], [C[0] + 0.05, C[1] - 0.23, z]], 0.013));
      const hood = sd > 0 && hasShifter ? 'shifter_rear' : 'brake_lever';
      m.add(hood, new T.BoxGeometry(0.08, 0.038, 0.034), [C[0] + 0.162, C[1] + 0.012, z], [0, 0, 0.28], { k: 0.42 });
      m.add(hood, new T.BoxGeometry(0.022, 0.03, 0.028), [C[0] + 0.198, C[1] + 0.036, z], [0, 0, 0.5], { k: 0.42 });
      m.add('brake_lever', curveGeo([[C[0] + 0.2, C[1] + 0.005, z], [C[0] + 0.218, C[1] - 0.07, z], [C[0] + 0.2, C[1] - 0.14, z], [C[0] + 0.165, C[1] - 0.19, z]], 0.009, 24), null, null, { k: 1.15 });
      if (sd > 0 && hasShifter) {
        m.add('shifter_rear', curveGeo([[C[0] + 0.188, C[1] - 0.01, z], [C[0] + 0.198, C[1] - 0.07, z - 0.004], [C[0] + 0.182, C[1] - 0.12, z - 0.012]], 0.0065, 16), null, null, { k: 0.7 });
      }
    }
    m.anchor('brake_lever', m.bike, [C[0] + 0.22, C[1] - 0.09, 0.21]);
  } else {
    const g = gripOf(B.bar, HT);
    if (B.bar === 'flat') {
      m.add('handlebar', tubeGeo([hx, hy, 0], [g[0], g[1], 0], 0.018));
      m.add('handlebar', tubeGeo([g[0], g[1], -0.4], [g[0], g[1], 0.4], 0.015));
    } else {
      m.add('handlebar', tubeGeo([hx, hy, 0], [hx - 0.02, hy + 0.08, 0], 0.02));
      for (const sd of [1, -1]) {
        m.add('handlebar', tubeGeo([hx - 0.02, hy + 0.08, 0], [hx - 0.02, hy + 0.08, sd * 0.14], 0.016));
        m.add('handlebar', tubeGeo([hx - 0.02, hy + 0.08, sd * 0.14], [g[0], g[1], sd * 0.3], 0.015));
        m.add('handlebar', tubeGeo([g[0], g[1], sd * 0.3], [g[0], g[1], sd * 0.4], 0.015));
      }
    }
    for (const sd of [1, -1]) {
      // grip, then the brake lever: a clamp, a body forward of the bar and a blade in front of the grip
      m.add('handlebar', tubeGeo([g[0], g[1], sd * 0.3], [g[0], g[1], sd * 0.4], 0.021), null, null, { k: 0.45 });
      m.add('brake_lever', new T.CylinderGeometry(0.021, 0.021, 0.016, 12), [g[0], g[1], sd * 0.288], [HP, 0, 0], { k: 0.5 });
      m.add('brake_lever', new T.BoxGeometry(0.055, 0.026, 0.02), [g[0] + 0.03, g[1] + 0.004, sd * 0.288], null, { k: 0.5 });
      m.add('brake_lever', curveGeo([[g[0] + 0.052, g[1] + 0.0, sd * 0.292], [g[0] + 0.068, g[1] - 0.008, sd * 0.33], [g[0] + 0.07, g[1] - 0.016, sd * 0.385]], 0.0075, 16), null, null, { k: 1.15 });
    }
    if (hasShifter) {
      // trigger shifter under the bar, inside the brake lever: the large lever for the thumb
      // (towards the rider) and the small release lever in front for the index finger
      m.add('shifter_rear', new T.CylinderGeometry(0.019, 0.019, 0.012, 12), [g[0], g[1], 0.262], [HP, 0, 0], { k: 0.5 });
      m.add('shifter_rear', new T.BoxGeometry(0.06, 0.036, 0.045), [S[0], S[1], S[2]], null, { k: 0.55 });
      const thumb = m.add('shifter_rear', new T.BoxGeometry(0.03, 1, 0.007), null, null, { k: 0.85 });
      plate(thumb, [S[0] - 0.02, S[1] - 0.012, S[2] + 0.005], [S[0] - 0.065, S[1] - 0.022, S[2] + 0.04], [0, 1, 0]);
      const trig = m.add('shifter_rear', new T.BoxGeometry(0.018, 1, 0.006), null, null, { k: 0.85 });
      plate(trig, [S[0] + 0.022, S[1] - 0.008, S[2] + 0.004], [S[0] + 0.042, S[1] - 0.026, S[2] + 0.03], [1, 0, 0]);
      m.add('shifter_rear', new T.BoxGeometry(0.004, 0.016, 0.026), [S[0] - 0.031, S[1] + 0.004, S[2]], null, { dark: true });
    }
    m.anchor('brake_lever', m.bike, [g[0] + 0.07, g[1], 0.36]);
  }
  if (hasShifter) m.anchor('shifter_rear', m.bike, [S[0], S[1] + 0.05, S[2]]);
}

/** Gear cable from the shifter to the derailleur (or the hub, or the gearbox). */
export function buildShiftCable(m: BikeModel): void {
  const B = m.spec;
  const { ST, HT, HB, C, S, rx, huby, bby, zDrop: zD, chainline: zc } = B;
  const [hx, hy] = HT;
  const bt = barrelTurn(B);
  // On a derailleur the housing ends in a loop behind the axle; its last bit, to the
  // derailleur (which turns about its bolt), is placed in setDer.
  const derEnd: V3 | null = m.der ? m.der.housingFrom : null;
  const end: V3 = derEnd ?? (B.gears === 'hub' ? [rx + 0.035, huby - 0.02, zD + 0.02] : [0.05, bby + 0.1, zc - 0.01]);
  const loop: V3[] = derEnd ? [[rx + 0.1, huby + 0.03, zD + 0.04], [rx + 0.01, huby + 0.06, zD + 0.06]] : [];
  // along the down tube (u from the bottom bracket) or just above the top tube (at x)
  const dt = (u: number): V3 => [HB[0] * (1 - u), bby + (HB[1] - bby) * u, 0.06];
  const tt = (x: number, z: number): V3 => [x, ST[1] + ((x - ST[0]) / (HT[0] - ST[0])) * (HT[1] - ST[1]) + 0.04, z];
  const cs = stayPts(B, 'chain', 1);
  const ss = stayPts(B, 'seat', 1);
  const along = (a: V3, b: V3, t: number, dy: number, dz: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + dy, a[2] + (b[2] - a[2]) * t + dz];
  let start: V3[];
  if (B.bar === 'drop') {
    start = [[S[0] - 0.035, S[1] - 0.02, S[2] - 0.005], [C[0] + 0.07, C[1] - 0.012, 0.2], [C[0] + 0.015, C[1] - 0.02, 0.13], [C[0] - 0.03, C[1] - 0.07, 0.07]];
  } else {
    const head: V3 = [bt.pos[0] - bt.axis[0] * bt.len / 2, bt.pos[1], bt.pos[2] - bt.axis[2] * bt.len / 2];
    start = [head, [head[0] + 0.06, head[1] - 0.02, head[2] - 0.08], [hx + 0.08, hy - 0.04, 0.09]];
  }
  const path: V3[] = B.bar === 'drop'
    ? [...start, [HB[0] + 0.02, HB[1] + 0.01, 0.07], [HB[0] * 0.7, dt(0.7)[1], 0.06], dt(0.35), [0.05, bby - 0.07, 0.05], along(cs[2], cs[4], 0.1, 0.035, 0.02), along(cs[2], cs[4], 0.6, 0.035, 0.022), ...loop, end]
    : B.gears === 'gearbox'
      ? [...start, [HB[0] - 0.08, HB[1] - 0.05, 0.07], dt(0.4), end]
      : [...start, tt(HT[0] - 0.25, 0.08), tt(HT[0] - 0.45, 0.05), tt(-0.05, 0.05), tt(ST[0] + 0.02, 0.06), along(ss[0], ss[1], 0.4, 0.03, 0.02), along(ss[0], ss[1], 0.75, 0.03, 0.022), ...loop, end];
  m.add('shift_cable', curveGeo(path, 0.006, 96), null, null, { k: 0.6 });
  m.anchor('shift_cable', m.bike, B.bar === 'drop' ? along(cs[2], cs[4], 0.3, 0.05, 0.02) : tt(-0.05, 0.08));
  if (m.der) {
    // the housing's last bit, and the inner wire from the barrel down to its clamp on the outer link
    m.der.housing = m.add('shift_cable', new T.CylinderGeometry(0.006, 0.006, 1, 8), null, null, { k: 0.6 });
    m.der.wire = m.add('shift_cable', new T.CylinderGeometry(0.0028, 0.0028, 1, 6), null, null, { parent: m.der.body, k: 1.3 });
  }
}
