// Measures where the library parts mount (crank spider and pedal axles, seat tube and saddle clamp, stem and bar clamp,
// grips, lever and shifter spots, the points a flipped bike rests on) on the LIBRARY geometry, in library space, and writes
// player/src/stage/mounts.ts. Run: npm run parts:mounts   (after npm run parts; it prints every number).
//
// Library space: scene units (1 = 0.5 m), x forward, y up, z to the drive side, origin at the source's bottom bracket.
// Everything is measured in mm (MM) and written in scene units. DRAWING DATA, not facts about any real part (hard rule 3).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { libGeo, loadLibrary, type LibName } from '../../../player/src/stage/library.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MM = 500;
const cfg = YAML.parse(fs.readFileSync(path.join(root, 'tools/assets/library/library.yaml'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'player/public/parts/library.json'), 'utf8'));
const file = fs.readFileSync(path.join(root, 'player/public/parts/library.glb'));
await loadLibrary(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);

type P3 = [number, number, number];
const pts = (n: LibName): P3[] => {
  const a = libGeo(n).getAttribute('position');
  const o: P3[] = [];
  for (let i = 0; i < a.count; i++) o.push([a.getX(i) * MM, a.getY(i) * MM, a.getZ(i) * MM]);
  return o;
};
const extent = (q: P3[], i: 0 | 1 | 2) => [Math.min(...q.map((p) => p[i])), Math.max(...q.map((p) => p[i]))] as [number, number];
const mid = (q: P3[], i: 0 | 1 | 2) => { const [a, b] = extent(q, i); return (a + b) / 2; };
const notes: string[] = [];
const say = (s: string) => { notes.push(s); console.log(s); };

// ---------------------------------------------------------------- crank: spider face, arm angles, pedal axles
const crank = pts('crank_arms');
const clipR: number = cfg.parts.crank_arms.clip.r;
const clipZ1: number = cfg.parts.crank_arms.clip.z[1];
const rOf = (p: P3) => Math.hypot(p[0], p[1]);
const spiderFaceZ = Math.max(...crank.filter((p) => rOf(p) > 30 && rOf(p) < clipR - 0.5 && p[2] < clipZ1).map((p) => p[2]));
// the arms end on the clip circle: their vertices there, grouped by angle
const ends = crank.filter((p) => Math.abs(rOf(p) - clipR) < 0.8 && p[2] > spiderFaceZ - 6 && p[2] < spiderFaceZ + 1).map((p) => Math.atan2(p[1], p[0]));
ends.sort((a, b) => a - b);
const groups: number[][] = [];
for (const a of ends) {
  const g = groups[groups.length - 1];
  if (g && a - g[g.length - 1] < 0.35) g.push(a); else groups.push([a]);
}
if (groups.length > 1 && groups[0][0] + 2 * Math.PI - groups[groups.length - 1][groups[groups.length - 1].length - 1] < 0.35) groups[0].unshift(...groups.pop()!.map((a) => a - 2 * Math.PI));
const found = groups.map((g) => (g[0] + g[g.length - 1]) / 2).sort((a, b) => a - b);
if (found.length !== 5) throw new Error(`expected 5 spider arms, found ${found.length}`);
// the arms are 72 deg apart: take the mean offset of the five measured angles (one arm has a single vertex on the circle)
const STEP = (2 * Math.PI) / 5;
const a0 = Math.atan2(
  found.reduce((s, a, i) => s + Math.sin(a - i * STEP), 0),
  found.reduce((s, a, i) => s + Math.cos(a - i * STEP), 0),
);
const armAngles = Array.from({ length: 5 }, (_, i) => a0 + i * STEP);
say(`crank: spider outer face z ${spiderFaceZ.toFixed(2)} mm, clip radius ${clipR} mm, 5 arms measured at ${found.map((a) => ((a * 180) / Math.PI).toFixed(1)).join(', ')} deg, 72 deg apart from ${((a0 * 180) / Math.PI).toFixed(1)}`);
const pedal = (n: LibName): [number, number] => { const q = pts(n); return [mid(q, 0), mid(q, 1)]; };
const pedalDrive = pedal('pedal_drive');
const pedalNon = pedal('pedal_nondrive');
say(`crank: pedal axles (${pedalDrive.map((v) => v.toFixed(1))}) and (${pedalNon.map((v) => v.toFixed(1))}) mm, arm length ${Math.hypot(...pedalDrive).toFixed(1)} mm`);
const pedZ = [extent(pts('pedal_drive'), 2), extent(pts('pedal_nondrive'), 2)];

// ---------------------------------------------------------------- seat tube axis, collar, saddle head
const cut = cfg.parts.saddle.cut as { point: P3; normal: P3 };
const nl = Math.hypot(...cut.normal);
const ax: [number, number] = [cut.normal[0] / nl, cut.normal[1] / nl];
const tOf = (p: P3) => (p[0] - cut.point[0]) * ax[0] + (p[1] - cut.point[1]) * ax[1];
const rAxis = (p: P3) => Math.hypot(p[2], (p[0] - cut.point[0]) * -ax[1] + (p[1] - cut.point[1]) * ax[0]);
const at = (t: number): [number, number] => [cut.point[0] + ax[0] * t, cut.point[1] + ax[1] * t];
const collar = pts('seat_collar');
// the collar's ring (the clamp ear and the screw lie further out); its wall is thin, so the bore is the radius below which a quarter of the ring's vertices lie
const ring = collar.filter((p) => rAxis(p) < 20);
const collarTop = Math.max(...ring.map(tOf));
const collarBot = Math.min(...ring.map(tOf));
const radii = ring.map(rAxis).sort((a, b) => a - b);
const bore = radii[Math.floor(radii.length * 0.25)];
const outer = extent(collar, 2)[1];
say(`seat: axis through (${cut.point[0]}, ${cut.point[1]}) mm up ${((Math.atan2(ax[1], -ax[0]) * 180) / Math.PI).toFixed(2)} deg from horizontal (backwards); collar t ${collarBot.toFixed(1)}..${collarTop.toFixed(1)} mm, bore radius ${bore.toFixed(1)}, outer ${outer.toFixed(1)}`);
const sad = pts('saddle');
const barrel = sad.filter((p) => rAxis(p) > 10 && rAxis(p) < 17.5 && tOf(p) < 17);
const bT = [Math.min(...barrel.map(tOf)), Math.max(...barrel.map(tOf))];
const headT = (bT[0] + bT[1]) / 2;
say(`saddle: clamp barrel t ${bT[0].toFixed(1)}..${bT[1].toFixed(1)} mm from the cut (${barrel.length} vertices), head at ${headT.toFixed(1)}`);
const sTop = sad.reduce((a, p) => (p[1] > a[1] ? p : a));
const head = at(headT);
const saddleTopY = Math.max(...sad.filter((p) => Math.abs(p[0] - head[0]) < 40).map((p) => p[1]));
// where the hook catches: the lowest point under the saddle (the rails) 100 mm in front of the clamp
const hookX = head[0] + 100;
const hookY = Math.min(...sad.filter((p) => Math.abs(p[0] - hookX) < 25).map((p) => p[1]));
say(`saddle: hook at (${hookX.toFixed(1)}, ${hookY.toFixed(1)}), head (${head.map((v) => v.toFixed(1))}), top above the head y ${saddleTopY.toFixed(1)} (${(saddleTopY - head[1]).toFixed(1)} mm above), highest point (${sTop.map((v) => v.toFixed(1))}), x ${extent(sad, 0).map((v) => v.toFixed(0))}`);

// ---------------------------------------------------------------- stem, bar, grips
const sa: P3 = [meta.steering.a[0] * MM, meta.steering.a[1] * MM, 0];
const sb: P3 = [meta.steering.b[0] * MM, meta.steering.b[1] * MM, 0];
const sl = Math.hypot(sb[0] - sa[0], sb[1] - sa[1]);
const sd: [number, number] = [(sb[0] - sa[0]) / sl, (sb[1] - sa[1]) / sl];
const stem = pts('stem');
const sT = (p: P3) => (p[0] - sa[0]) * sd[0] + (p[1] - sa[1]) * sd[1];
const stemT: [number, number] = [Math.min(...stem.map(sT)), Math.max(...stem.map(sT))];
const stemR = Math.max(...stem.filter((p) => sT(p) < stemT[0] + 4).map((p) => Math.hypot(p[2], (p[0] - sa[0]) * -sd[1] + (p[1] - sa[1]) * sd[0])));
const bar = pts('bar_flat');
// the straight clamp section: its two rings at z = -54 and 54
const barMid = bar.filter((p) => Math.abs(Math.abs(p[2]) - 54) < 3);
const barClamp: [number, number] = [mid(barMid, 0), mid(barMid, 1)];
const barR = (extent(barMid, 0)[1] - extent(barMid, 0)[0]) / 2;
say(`stem: steering axis from (${sa[0].toFixed(1)}, ${sa[1].toFixed(1)}) up ${((Math.atan2(sd[1], -sd[0]) * 180) / Math.PI).toFixed(2)} deg (head angle); stem t ${stemT.map((v) => v.toFixed(1))} mm, foot radius ${stemR.toFixed(1)}; bar clamp (${barClamp.map((v) => v.toFixed(1))}), bar radius ${barR.toFixed(2)} (${barMid.length} vertices)`);
const gd = pts('grip_drive');
const gripIn = Math.min(...gd.map((p) => p[2]));
const gripOut = Math.max(...gd.map((p) => p[2]));
/** centre of the ring of vertices nearest z (the ring's own bounding box; the meshes have few rings, so widen the slice until there are some) */
const ringAt = (q: P3[], z: number): [number, number] => {
  for (let w = 6; w < 40; w += 4) { const s = q.filter((p) => Math.abs(p[2] - z) < w); if (s.length > 40) return [mid(s, 0), mid(s, 1)]; }
  throw new Error('no ring near z ' + z);
};
const g0 = ringAt(gd, gripIn + 8);
const g1 = ringAt(gd, gripOut - 8);
const b160 = ringAt(bar, 160);
const b60 = ringAt(bar, 60);
/** the bar's centre line at z: straight in the middle, then along the bar's rings, then the grip's */
const lineAt = (z: number): [number, number] => {
  const pz: Array<[number, [number, number]]> = [[0, barClamp], [54, barClamp], [160, b160], [gripIn + 8, g0], [gripOut - 8, g1]];
  for (let i = 1; i < pz.length; i++) {
    if (z <= pz[i][0]) {
      const u = (z - pz[i - 1][0]) / (pz[i][0] - pz[i - 1][0]);
      return [pz[i - 1][1][0] + (pz[i][1][0] - pz[i - 1][1][0]) * u, pz[i - 1][1][1] + (pz[i][1][1] - pz[i - 1][1][1]) * u];
    }
  }
  return g1;
};
const gtop = gd.reduce((a, p) => (p[1] > a[1] ? p : a));
const barW = extent(bar, 2)[1];
say(`bar: half width ${barW.toFixed(1)} mm; grips z ${gripIn.toFixed(1)}..${gripOut.toFixed(1)}, axis ${g0.map((v) => v.toFixed(1))} -> ${g1.map((v) => v.toFixed(1))}; bar ring at z 60 ${b60.map((v) => v.toFixed(1))}, 160 ${b160.map((v) => v.toFixed(1))}; highest grip point (${gtop.map((v) => v.toFixed(1))})`);
// a brake lever's clamp sits just inboard of the grip, the trigger shifter's further in
const leverZ = gripIn - 12;
const shiftZ = leverZ - 26;

// ---------------------------------------------------------------- write
const u = (v: number) => Number((v / MM).toFixed(5));
const u2 = (p: [number, number]) => `[${u(p[0])}, ${u(p[1])}]`;
const u3 = (p: P3) => `[${u(p[0])}, ${u(p[1])}, ${u(p[2])}]`;
const ln = (z: number) => `[${u(z)}, ${u2(lineAt(z)).slice(1, -1)}]`;
const body = `// GENERATED by tools/assets/measure/mounts.ts. Do not edit: run \`npm run parts:mounts\` to measure again.
// Where the library parts mount, measured on the library geometry in library space: scene units (1 = 0.5 m), x forward,
// y up, z to the drive side, origin at the source's bottom bracket. DRAWING DATA, not facts about any real part (hard rule 3).
//
// Measurement (mm):
${notes.map((n) => '//   ' + n).join('\n')}

export type M2 = [number, number];
export type M3 = [number, number, number];

export const MOUNTS = {
  crank: {
    /** the spider's outer face (z): the chainring's back face lies on it */
    ringFaceZ: ${u(spiderFaceZ)},
    /** the spider's 5 arms end on this circle; their angles (rad, from +x, counter-clockwise seen from the drive side) */
    spiderR: ${u(clipR)},
    armAngles: [${armAngles.map((a) => a.toFixed(5)).join(', ')}],
    /** pedal axles (x, y; the axle runs along z) and the z range of each pedal body */
    pedalDrive: ${u2(pedalDrive)} as M2,
    pedalNon: ${u2(pedalNon)} as M2,
    pedalDriveZ: [${pedZ[0].map(u).join(', ')}],
    pedalNonZ: [${pedZ[1].map(u).join(', ')}],
  },
  /** the seat tube's axis (a point on it and the direction up the tube, backwards), the collar and the saddle's clamp on the post */
  seat: {
    axisP: ${u2([cut.point[0], cut.point[1]])} as M2,
    axisD: [${ax.map((v) => v.toFixed(5)).join(', ')}] as M2,
    /** along the axis from axisP: the collar's top and bottom, its bore and outer radius */
    collarTop: ${u(collarTop)},
    collarBot: ${u(collarBot)},
    boreR: ${u(bore)},
    collarR: ${u(outer)},
    /** the saddle's clamp barrel: its centre along the axis from axisP, and the post radius that fits it */
    headT: ${u(headT)},
    postR: ${u(12.3)},
  },
  saddle: {
    head: ${u2(head)} as M2,
    /** the highest point of the shell above the clamp (y), and the highest point of all (x, y, z): the saddle's rest when the bike is flipped */
    topY: ${u(saddleTopY)},
    /** the underside of the rails in front of the clamp (x, y): where the hook catches */
    hook: ${u2([hookX, hookY])} as M2,
    rest: ${u3(sTop)} as M3,
  },
  /** the steering axis (a point on it, the direction up and backwards), the stem's foot and top along it, and the bar clamp */
  stem: {
    axisP: ${u2([sa[0], sa[1]])} as M2,
    axisD: [${sd.map((v) => v.toFixed(5)).join(', ')}] as M2,
    footT: ${u(stemT[0])},
    topT: ${u(stemT[1])},
    footR: ${u(stemR)},
    clamp: ${u2(barClamp)} as M2,
  },
  bar: {
    halfW: ${u(barW)},
    radius: ${u(barR)},
    /** the bar's centre line: z, x, y */
    line: [${ln(0)}, ${ln(54)}, ${ln(160)}] as Array<[number, number, number]>,
  },
  grip: {
    gripIn: ${u(gripIn)},
    gripOut: ${u(gripOut)},
    /** the grip's axis at its two ends (x, y) */
    axisIn: ${u2(g0)} as M2,
    axisOut: ${u2(g1)} as M2,
    /** the highest point of the grip (x, y, z): its rest when the bike is flipped */
    rest: ${u3(gtop)} as M3,
  },
  /** just inboard of the grip: a brake lever's clamp, then the trigger shifter's (z, and the bar's centre line there) */
  lever: { z: ${u(leverZ)}, at: ${u2(lineAt(leverZ))} as M2 },
  shifter: { z: ${u(shiftZ)}, at: ${u2(lineAt(shiftZ))} as M2 },
} as const;
`;
fs.writeFileSync(path.join(root, 'player/src/stage/mounts.ts'), body);
console.log('wrote player/src/stage/mounts.ts');
