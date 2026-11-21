// The rear derailleur: its dimensions and pose maths (derGeom, derPose, the body angle and the
// turning points) and its meshes (hanger, body, links, cage, pulleys, screws, barrel adjuster).
// Session area: D (derailleur).

import * as T from 'three';
import { layoutCirc, rAt } from './drivetrain.js';
import { gearGeo, hullShape, seg, slabGeo, UP, v3 } from './geo.js';
import { DEG, GAP_OK, HP, LC, RP, type BikeSpec, type V2, type V3 } from './spec.js';
import type { BikeModel } from './bike.js';

// ------------------------------------------------------------------ derailleur layout

/*
 * The rear derailleur is built like a real one. Its body (B-knuckle) hangs from the hanger bolt,
 * outside the smallest sprocket: an arch from the bolt back to the link pins. Two parallel link
 * plates (the parallelogram) hang down from the pins; their free end (the P-knuckle) carries the
 * cage pivot, and the cage turns about it with the two pulleys.
 *
 * As on a real derailleur, the links swing on a slanted plane: towards the larger sprockets the
 * P-knuckle moves inwards and away from the axle, towards the smaller ones outwards and up to the
 * hanger. The body turns about the bolt only when the B screw is turned (it rests on the hanger's
 * tab); shifting leaves it where it is. The cage turns about its pivot (its spring takes up the
 * chain) so the upper pulley keeps the gap on every sprocket. derPose() solves this; no part
 * stretches, and nothing but the chain and the pulleys comes near the sprockets (stage.test.ts).
 */

/** P-knuckle (outer link's free end) this far outside the chain; link pins to the cage pivot */
const POFF = 0.05;
const PIN = 0.018;
/** cage pivot to upper pulley, and its angle to the cage's line from upper to lower pulley */
const CO = 0.045;
const KAPPA = 70 * DEG;
/** body angle with the gap right; cage line (upper -> lower pulley) on the smallest and largest sprocket */
const BETA_L = -135 * DEG;
const CAGE_S = -60 * DEG;
const CAGE_L = -80 * DEG;
/** distance between the two link plates; half the links' swing */
const EZ = 0.022;
const A0 = 42 * DEG;
const CAGE_SWING = 30 * DEG;

export interface DerGeom {
  /** z of the hanger; hanger bolt (x, y) */
  zH: number;
  Hb: V2;
  /** In the body frame (origin at the bolt; the cage pivot lies along -x with the gap right on
   * the largest sprocket): the arch's elbow, the outer link's pins, and the inner link's offset */
  elbow: V2;
  pins: V3;
  off: V3;
  /** link length; the links' end runs on pins + L (cos a e1 + sin a e2), a from -A0 (smallest) to A0 (largest) */
  L: number;
  e1: V3;
  e2: V3;
  /** pin axis (across the link plates) */
  axis: V3;
  /** cage pivot's distance from the bolt on the largest sprocket */
  rhoL: number;
  /** body z: the arch, from z0 to z1 */
  z0: number;
  z1: number;
}

function reach(w: V2, b: number, need: number): number {
  const bw = w[0] * Math.cos(b) + w[1] * Math.sin(b);
  return -bw + Math.sqrt(Math.max(0, bw * bw - (w[0] ** 2 + w[1] ** 2 - need * need)));
}

export function derGeom(B: BikeSpec): DerGeom {
  const { zs, rs, n, rx, huby } = B;
  const zH = B.zDrop;
  const Hb: V2 = [rx - 0.012, huby - 0.052];
  const hb: V2 = [Hb[0] - rx, Hb[1] - huby];
  // the cage pivot on the smallest and on the largest sprocket, with the body at BETA_L
  const at = (cage: number): V2 => [hb[0] + CO * Math.cos(cage + KAPPA), hb[1] + CO * Math.sin(cage + KAPPA)];
  const rhoS = Math.max(0.06, reach(at(CAGE_S), BETA_L, rs[0] + GAP_OK + RP));
  const rhoL = Math.max(rhoS + 0.012, reach(at(CAGE_L), BETA_L, rs[n - 1] + GAP_OK + RP));
  const PS: V3 = [-rhoS + PIN, 0, zs[0] + POFF];
  const PL: V3 = [-rhoL + PIN, 0, zs[n - 1] + POFF];
  const d: V3 = [PL[0] - PS[0], 0, PL[2] - PS[2]];
  const C = Math.max(1e-3, v3.len(d));
  const e2 = v3.sc(d, 1 / C);
  // The pins sit above the middle of that travel (body +y), so the links hang down from them. The
  // middle sprockets are smaller than halfway between the smallest and largest, so the links'
  // arc bows towards the bolt (n) by about that much: a wider swing, and a plane tilted towards n.
  const nb: V3 = [-e2[2], 0, e2[0]];
  const mid = (zs[0] + zs[n - 1]) / 2;
  const sag = Math.max(0, 0.85 * ((rs[0] + rs[n - 1]) / 2 - rAt(B, mid)));
  const a0 = A0;
  const L = C / (2 * Math.sin(a0));
  const h = L * Math.cos(a0);
  // tilted only so far that the links' end still moves steadily inwards over the whole swing
  const sinNu = Math.min(1, sag / Math.max(1e-6, L * (1 - Math.cos(a0)) * nb[0]), (0.8 * Math.abs(e2[2])) / Math.max(1e-6, Math.abs(nb[2]) * Math.tan(a0)));
  const cosNu = Math.sqrt(1 - sinNu * sinNu);
  const e1: V3 = [nb[0] * sinNu, -cosNu, nb[2] * sinNu];
  const M: V3 = [(PS[0] + PL[0]) / 2, 0, (PS[2] + PL[2]) / 2];
  const pins = v3.add(M, v3.sc(e1, -h));
  const axis = v3.cross(e1, e2);
  const off = v3.sc(e2, EZ);
  // the arch rises from the bolt to an elbow, then runs back to the pins
  const elbow: V2 = [Math.max(pins[0] + 0.03, -0.035), Math.max(0.055, Math.min(pins[1], 0.095))];
  const z0 = zH + 0.004;
  return { zH, Hb, elbow, pins, off, L, e1, e2, axis, rhoL, z0, z1: z0 + 0.034 };
}

export interface DerPose {
  /** body angle (from the bolt towards the cage pivot on the largest sprocket), the cage line (upper -> lower pulley), the links' swing; rad */
  beta: number;
  cage: number;
  alpha: number;
  /** P-knuckle (outer link's free end) in the body frame */
  P: V3;
  /** cage pivot and upper pulley (x, y) */
  Cv: V2;
  U: V2;
}

export const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** The body angle that gives this gap on the largest sprocket (set by the B screw). */
function bodyAngle(B: BikeSpec, G: DerGeom, gap: number): number {
  const hb: V2 = [G.Hb[0] - B.rx, G.Hb[1] - B.huby];
  const w: V2 = [hb[0] + CO * Math.cos(CAGE_L + KAPPA), hb[1] + CO * Math.sin(CAGE_L + KAPPA)];
  const need = B.rs[B.n - 1] + gap + RP;
  const rho = G.rhoL;
  const lw = Math.hypot(w[0], w[1]);
  const c = Math.max(-1, Math.min(1, (need * need - rho * rho - lw * lw) / (2 * rho * lw)));
  const aw = Math.atan2(w[1], w[0]);
  return [aw + Math.acos(c), aw - Math.acos(c)].sort((p, q) => Math.abs(angDiff(p, BETA_L)) - Math.abs(angDiff(q, BETA_L)))[0];
}

/** Where the derailleur's parts are for a position z, a gap and the sprocket radius r there. */
export function derPose(B: BikeSpec, G: DerGeom, z: number, gap: number, r: number): DerPose {
  // links: their end follows z
  // L (cos a e1z + sin a e2z) = z + POFF - pins z; the solution nearest the middle of the swing
  const A = G.L * G.e1[2];
  const Bz = G.L * G.e2[2];
  const R = Math.hypot(A, Bz) || 1e-6;
  const ph = Math.atan2(Bz, A);
  const ac = Math.acos(Math.max(-1, Math.min(1, (z + POFF - G.pins[2]) / R)));
  const out = (a: number) => Math.max(0, Math.abs(a) - A0);
  const alpha = [ph + ac, ph - ac].map((a) => angDiff(a, 0)).sort((p, q) => out(p) - out(q) || Math.abs(p) - Math.abs(q))[0];
  const P = v3.add(G.pins, v3.add(v3.sc(G.e1, G.L * Math.cos(alpha)), v3.sc(G.e2, G.L * Math.sin(alpha))));
  // body: set by the B screw
  const beta = bodyAngle(B, G, gap);
  const th = beta + Math.PI;
  const cx = P[0] - PIN;
  const cy = P[1];
  const Cv: V2 = [G.Hb[0] + cx * Math.cos(th) - cy * Math.sin(th), G.Hb[1] + cx * Math.sin(th) + cy * Math.cos(th)];
  // cage: turns so the upper pulley keeps the gap; the nearer solution to its usual angle
  const t = Math.max(0, Math.min(1, (r - B.rs[0]) / (B.rs[B.n - 1] - B.rs[0] || 1)));
  const usual = CAGE_S + (CAGE_L - CAGE_S) * t + KAPPA;
  const q: V2 = [Cv[0] - B.rx, Cv[1] - B.huby];
  const lq = Math.hypot(q[0], q[1]) || 1e-6;
  const need = r + gap + RP;
  const c = Math.max(-1, Math.min(1, (need * need - lq * lq - CO * CO) / (2 * CO * lq)));
  const aq = Math.atan2(q[1], q[0]);
  const best = [aq + Math.acos(c), aq - Math.acos(c)].sort((p, q2) => Math.abs(angDiff(p, usual)) - Math.abs(angDiff(q2, usual)))[0];
  // the cage swings at most CAGE_SWING from its usual angle; beyond that the gap opens a little
  const u = usual + Math.max(-CAGE_SWING, Math.min(CAGE_SWING, angDiff(best, usual)));
  const U: V2 = [Cv[0] + CO * Math.cos(u), Cv[1] + CO * Math.sin(u)];
  return { beta, cage: u - KAPPA, alpha, P, Cv, U };
}

/** A turnable part: screws and the barrel adjuster. `pos` and `axis` are in its parent's frame; `axis` points from the head into the thread. */
export interface Turn {
  pos: V3;
  axis: V3;
  len: number;
}

/** The derailleur barrel adjuster (or cable stop) on the body, in the body's frame (origin at the bolt, body along -x). */
export function bodyBarrel(G: DerGeom): Turn {
  // on top of the arch at its elbow, pointing down into it
  const u = [0.29, 0.957];
  const len = 0.03;
  const d = BODY_R - 0.004 + len / 2;
  return { pos: [G.elbow[0] + u[0] * d, G.elbow[1] + u[1] * d, (G.z0 + G.z1) / 2], axis: [-u[0], -u[1], 0], len };
}

/** The arch's half-width at the bolt (a little less at the elbow and the pins); screw shank length. */
export const BODY_R = 0.03;
export const SCREW_LEN = 0.018;

/** Body frame -> bike space, for a body angle beta. */
export function bodyToBike(G: DerGeom, beta: number, p: V3): V3 {
  const th = beta + Math.PI;
  return [G.Hb[0] + p[0] * Math.cos(th) - p[1] * Math.sin(th), G.Hb[1] + p[0] * Math.sin(th) + p[1] * Math.cos(th), p[2]];
}

/**
 * Where the barrel adjuster is on this bike, in bike space (on the derailleur: with the chain on
 * the middle sprocket). `axis` points from its head into the thread.
 */
export function barrelTurn(B: BikeSpec): Turn {
  if (B.barrelAt === 'derailleur') {
    const G = derGeom(B);
    const mid = Math.floor(B.n / 2);
    const P = derPose(B, G, B.zs[mid], GAP_OK, B.rs[mid]);
    const t = bodyBarrel(G);
    const th = P.beta + Math.PI;
    return { pos: bodyToBike(G, P.beta, t.pos), axis: [t.axis[0] * Math.cos(th) - t.axis[1] * Math.sin(th), t.axis[0] * Math.sin(th) + t.axis[1] * Math.cos(th), 0], len: t.len };
  }
  // on the trigger pod's inner end, pointing in and forward where the cable leaves
  const ax: V3 = [0.45, 0, -0.89];
  const tip: V3 = [B.S[0] + 0.012, B.S[1] + 0.004, B.S[2] - 0.0225];
  return { pos: [tip[0] + ax[0] * 0.019, tip[1], tip[2] + ax[2] * 0.019], axis: [-ax[0], 0, -ax[2]], len: 0.038 };
}

/** The upper pulley's position (x, y) for a derailleur position z and a gap. */
export function upperPulley(B: BikeSpec, z: number, gap = GAP_OK): V2 {
  const G = derGeom(B);
  const r = rAt(B, z);
  return derPose(B, G, z, gap, r).U;
}

/** Sprocket radius at a z between the sprockets. */

/** What BikeModel keeps of the derailleur it built, for moving it in moveDerailleur. */
export interface DerParts {
  G: DerGeom;
  body: T.Group;
  links: T.Mesh[];
  pk: T.Group;
  wire: T.Mesh | null;
  housing: T.Mesh | null;
  housingFrom: V3;
  /** the B screw moves along its axis as the body turns, so its tip stays on the hanger's tab */
  bScrew: { group: T.Object3D; base: V3; axis: V3; arm: number; beta0: number };
}

const tM = new T.Matrix4();

/** Hanger; body with the H, L and B screws; parallelogram links; P-knuckle; cage and pulleys. */
export function buildDerailleur(m: BikeModel): void {
  const B = m.spec;
  const { rx, huby } = B;
  const G = derGeom(B);
  const { zH, Hb, elbow, pins, off, L, z0, z1 } = G;
  const D = 'rear_derailleur';
  const pw = B.chainW / 2 + 0.0035;
  const P0 = derPose(B, G, B.zs[B.n - 1], GAP_OK, B.rs[B.n - 1]);

  m.part(D);
  m.part('upper_pulley');
  const dg = m.parts.get(D)!.group;

  // Body (B-knuckle): turns about the bolt; its frame has the bolt at the origin.
  const body = new T.Group();
  body.position.set(Hb[0], Hb[1], 0);
  dg.add(body);
  // the bolt's knuckle, with the bolt head on the outside
  m.add(D, new T.CylinderGeometry(BODY_R, BODY_R, z1 - zH + 0.004, 24), [0, 0, (z1 + zH) / 2], [HP, 0, 0], { parent: body, k: 0.42 });
  m.add(D, new T.CylinderGeometry(0.013, 0.013, 0.005, 6), [0, 0, z1 + 0.004], [HP, 0, 0], { parent: body, k: 1.25 });
  // the arch from the knuckle up to the elbow and back to the pins
  m.add(D, slabGeo(hullShape([[0, 0, BODY_R - 0.002], [elbow[0], elbow[1], BODY_R - 0.003], [pins[0], pins[1], BODY_R - 0.006]]), z0, z1, 0.006), null, null, { parent: body, k: 0.5 });
  // a lighter cover on the outer face, as on a real derailleur
  m.add(D, slabGeo(hullShape([[-0.004, 0.01, 0.014], [elbow[0], elbow[1], 0.015], [pins[0] + 0.01, pins[1], 0.012]]), z1 - 0.001, z1 + 0.003, 0.0015), null, null, { parent: body, k: 0.85 });
  // a boss at the pins end reaching in to the inner link
  const pinIn = v3.add(pins, off);
  m.add(D, slabGeo(hullShape([[pins[0], pins[1], 0.017], [pinIn[0], pinIn[1], 0.017]]), Math.min(pins[2], pinIn[2]) - 0.007, z0 + 0.006, 0.004), null, null, { parent: body, k: 0.45 });
  const pinQ = new T.Quaternion().setFromUnitVectors(UP, new T.Vector3(...G.axis));
  const pinMesh = (parent: T.Object3D, at: V3) => {
    const mesh = m.add(D, new T.CylinderGeometry(0.0045, 0.0045, 0.04, 8), at, null, { parent, k: 1.2 });
    mesh.quaternion.copy(pinQ);
  };
  for (const p of [pins, pinIn]) pinMesh(body, p);

  // Links: rigid plates from pins on the body to pins on the P-knuckle (oriented in setDer)
  const links = [0.02, 0.017].map((hw, i) => {
    const geo = slabGeo(hullShape([[0, 0, hw], [-L, 0, hw * 0.9]]), -0.003, 0.003, 0.0015);
    return m.add(D, geo, i ? pinIn : pins, null, { parent: body, k: i ? 0.55 : 0.78 });
  });
  // P-knuckle: moves with the links' free end without turning; carries the cage pivot (round cap)
  const pk = new T.Group();
  body.add(pk);
  m.add(D, slabGeo(hullShape([[0, 0, 0.016], [off[0], off[1], 0.016], [-PIN, 0, 0.02]]), Math.min(0, off[2]) - 0.006, 0.008, 0.004), null, null, { parent: pk, k: 0.48 });
  m.add(D, new T.CylinderGeometry(0.023, 0.023, 0.012, 24), [-PIN, 0, 0.006], [HP, 0, 0], { parent: pk, k: 0.4 });
  m.add(D, new T.CylinderGeometry(0.011, 0.011, 0.004, 16), [-PIN, 0, 0.013], [HP, 0, 0], { parent: pk, k: 0.95 });
  for (const p of [[0, 0, 0], off] as V3[]) pinMesh(pk, p);

  // Cage: two plates with the upper and lower pulley; turns about its pivot, which sits behind
  // and above the upper pulley (local (cx, cy)).
  const cage = new T.Group();
  m.cage = cage;
  dg.add(cage);
  const cx = -CO * Math.sin(KAPPA);
  const cy = CO * Math.cos(KAPPA);
  const pulleyW = Math.min(0.011, B.sp * 0.9);
  m.add('upper_pulley', gearGeo(RP, 11, pulleyW), null, null, { parent: cage, k: 0.35, flat: true });
  m.add(D, gearGeo(RP, 11, pulleyW), [0, -LC, 0], null, { parent: cage, k: 0.35, flat: true });
  m.add(D, slabGeo(hullShape([[cx, cy, 0.019], [0, 0, 0.028], [0, -LC, 0.033]]), pw, pw + 0.006, 0.002), null, null, { parent: cage, k: 0.52 });
  // the inner plate starts below the upper pulley's axle, so it stays off the next larger sprocket
  m.add(D, slabGeo(hullShape([[0, -0.068, 0.012], [0, -LC, 0.024]]), -pw - 0.004, -pw, 0.0015), null, null, { parent: cage, k: 0.58 });
  for (const y of [0, -LC]) m.add(D, new T.CylinderGeometry(0.011, 0.011, 2 * pw + 0.006, 12), [0, y, 0], [HP, 0, 0], { parent: cage, k: 1.25 });
  // pivot axle from the cage up into the P-knuckle
  m.add(D, new T.CylinderGeometry(0.009, 0.009, POFF - pw, 10), [cx, cy, (POFF + pw) / 2], [HP, 0, 0], { parent: cage, k: 1.1 });
  m.anchor('upper_pulley', cage, [0, 0.01, 0.02]);
  m.anchor(D, body, [(elbow[0] + pins[0]) / 2, (elbow[1] + pins[1]) / 2 + 0.02, z1 + 0.01]);

  // Limit screws H and L in the top of the arch, heads up where you turn them, threads into the body.
  const top = (k: number, along: number): { at: V3; axis: V3 } => {
    // a point on the arch's top edge between elbow and pins (k from 0 to 1), screw centre inside it
    const ex = pins[0] - elbow[0];
    const ey = pins[1] - elbow[1];
    const el = Math.hypot(ex, ey) || 1;
    const nx = -ey / el;
    const ny = ex / el;
    const up: V2 = ny >= 0 ? [nx, ny] : [-nx, -ny];
    const r = BODY_R - 0.003 - 0.006 * k;
    const c: V2 = [elbow[0] + ex * k + up[0] * (r - along), elbow[1] + ey * k + up[1] * (r - along)];
    return { at: [c[0], c[1], (z0 + z1) / 2], axis: [-up[0], -up[1], 0] };
  };
  const sl = SCREW_LEN / 2 - 0.002;
  const hs = top(0.3, sl);
  const ls = top(0.75, sl);
  m.screw('h_screw', hs.at, hs.axis, body);
  m.screw('l_screw', ls.at, ls.axis, body);

  // B screw: in a lug on the knuckle, its tip on a tab of the hanger. It points along the way the
  // body turns, so turning it in turns the body (and opens the gap).
  const bp: V2 = [0.012, BODY_R + 0.004];
  const arm = Math.hypot(bp[0], bp[1]);
  const ba: V3 = [bp[1] / arm, -bp[0] / arm, 0];
  const bz = zH + 0.014;
  m.add(D, slabGeo(hullShape([[bp[0] - ba[0] * 0.004, bp[1] - ba[1] * 0.004, 0.007], [0, 0.02, 0.008]]), bz - 0.007, bz + 0.007, 0.002), null, null, { parent: body, k: 0.42 });
  const bCentre: V3 = [bp[0], bp[1], bz];
  m.screw('b_screw', bCentre, ba, body);
  const bGroup = m.parts.get('b_screw')!.group;

  // Hanger: a plate from the axle down to the bolt, with the tab the B screw's tip rests on.
  m.part('derailleur_hanger');
  const tip = bodyToBike(G, P0.beta, [bp[0] + ba[0] * (SCREW_LEN / 2 + 0.004), bp[1] + ba[1] * (SCREW_LEN / 2 + 0.004), 0]);
  m.add('derailleur_hanger', slabGeo(hullShape([[rx, huby, 0.03], [Hb[0], Hb[1], 0.024], [tip[0], tip[1], 0.008]]), zH - 0.0045, zH + 0.0045, 0.002), null, null, { k: 0.8 });
  m.add('derailleur_hanger', new T.BoxGeometry(0.012, 0.012, bz - zH + 0.006), [tip[0], tip[1], (zH + bz) / 2 + 0.002], null, { k: 0.8 });
  m.anchor('derailleur_hanger', m.bike, [(rx + Hb[0]) / 2, (huby + Hb[1]) / 2, zH + 0.01]);

  // Barrel adjuster: on the body where the housing comes in, or on the trigger shifter
  const bt = B.barrelAt === 'derailleur' ? bodyBarrel(G) : barrelTurn(B);
  const spin = m.turnable('barrel_adjuster', bt, B.barrelAt === 'derailleur' ? body : m.bike);
  const br = 0.011;
  m.add('barrel_adjuster', new T.CylinderGeometry(br, br, bt.len * 0.75, 12), [0, -bt.len * 0.125, 0], null, { parent: spin, flat: true });
  for (const y of [-0.3, 0, 0.3]) m.add('barrel_adjuster', new T.CylinderGeometry(br + 0.0018, br + 0.0018, 0.003, 12), [0, -bt.len * 0.125 + y * bt.len * 0.75, 0], null, { parent: spin, k: 0.8, flat: true });
  m.add('barrel_adjuster', new T.CylinderGeometry(br * 0.55, br * 0.55, bt.len * 0.25, 8), [0, bt.len * 0.375, 0], null, { parent: spin, k: 1.2 });
  m.add('barrel_adjuster', new T.BoxGeometry(0.005, 0.003, br * 2.1), [0, -bt.len / 2, 0], null, { parent: spin, dark: true });
  if (B.barrelAt !== 'derailleur') {
    // a plain cable stop where the barrel would be
    const st = bodyBarrel(G);
    const stop = m.add(D, new T.CylinderGeometry(0.009, 0.009, 0.018, 10), null, null, { parent: body, k: 1.1 });
    stop.position.set(st.pos[0] - st.axis[0] * 0.004, st.pos[1] - st.axis[1] * 0.004, st.pos[2]);
    stop.quaternion.setFromUnitVectors(UP, new T.Vector3(...st.axis));
  }
  // the housing loop ends here; its last bit to the body is placed in setDer
  const head = bodyToBike(G, P0.beta, bodyBarrel(G).pos);
  m.der = {
    G, body, links, pk, wire: null, housing: null,
    housingFrom: [head[0] - 0.03, head[1] + 0.07, head[2] + 0.03],
    bScrew: { group: bGroup, base: bCentre, axis: ba, arm, beta0: P0.beta },
  };
}

/** Turns cage, body and links for the derailleur at z with the given gap, and moves the cable ends. */
export function moveDerailleur(m: BikeModel, z: number, gap: number): void {
  const d = m.der;
  if (m.cage && d) {
    const { G } = d;
    const Lo = layoutCirc(m, z, gap);
    const P = Lo.pose;
    m.cage.position.set(Lo.gx, Lo.gy, z);
    m.cage.rotation.z = Lo.a;
    d.body.rotation.z = P.beta + Math.PI;
    // links: local -x along the link, local y along the pin axis
    const dir = new T.Vector3(P.P[0] - G.pins[0], P.P[1] - G.pins[1], P.P[2] - G.pins[2]).normalize();
    const X = dir.clone().negate();
    const Y = new T.Vector3(...G.axis).normalize();
    const Z = new T.Vector3().crossVectors(X, Y).normalize();
    Y.crossVectors(Z, X);
    const q = new T.Quaternion().setFromRotationMatrix(tM.makeBasis(X, Y, Z));
    for (const m of d.links) m.quaternion.copy(q);
    d.pk.position.set(...P.P);
    const bs = d.bScrew;
    const sh = bs.arm * angDiff(P.beta, bs.beta0);
    bs.group.position.set(bs.base[0] + bs.axis[0] * sh, bs.base[1] + bs.axis[1] * sh, bs.base[2]);
    const bb = bodyBarrel(G);
    if (d.wire) {
      // from the barrel down to its clamp on the outer link
      const k = 0.4;
      seg(d.wire, [bb.pos[0] + bb.axis[0] * bb.len * 0.5, bb.pos[1] + bb.axis[1] * bb.len * 0.5, bb.pos[2]], [G.pins[0] + dir.x * G.L * k, G.pins[1] + dir.y * G.L * k, G.pins[2] + dir.z * G.L * k + 0.006]);
    }
    if (d.housing) {
      const head = bodyToBike(G, P.beta, [bb.pos[0] - bb.axis[0] * bb.len * 0.5, bb.pos[1] - bb.axis[1] * bb.len * 0.5, bb.pos[2]]);
      seg(d.housing, d.housingFrom, head);
    }
  }
}
