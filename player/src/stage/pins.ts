// The chain as a ring of pins, one pitch apart in a straight line (chord), as on a real chain.
// Pins are laid along the exact path (chain.ts) from a first pin on the chainring, so on every wheel
// they sit on the pitch circle and one pitch apart: the wheel's tooth gaps follow from them. The
// length the chain has left over (a fraction of a link up to a few percent) is spread evenly over the
// last run before the chainring, the free one on a real bike; the run to the sprocket stays straight.
// No three.js: plain numbers, so it can be tested in node.
// Session area: C (drivetrain).

import { bend, type Path, type PathSeg } from './chain.js';

export interface Pins {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  /** the wheel (index in the circles) each pin sits on, or -1 on a run */
  wheel: Int8Array;
  /** 0 or 1: whether the first link is an inner or an outer one, so links keep their kind as the chain moves */
  parity: number;
}

export const newPins = (n: number): Pins => ({ x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n), wheel: new Int8Array(n), parity: 0 });

const pt3 = { x: 0, y: 0, z: 0 };
/** where each pin of the last call lies along the path (scratch) */
let sPin = new Float64Array(0);

/** The point at xy-length `s` along the path, exact. Returns the index of its piece (a hint for the next call). */
export function pathAt(o: Path, s: number, out: { x: number; y: number; z: number }, hint = 0): number {
  const segs = o.segs;
  const last = segs[segs.length - 1];
  const total = last.s0 + last.len;
  s = ((s % total) + total) % total;
  let j = hint < segs.length && segs[hint].s0 <= s ? hint : 0;
  while (j < segs.length - 1 && segs[j + 1].s0 <= s) j++;
  const g = segs[j];
  const u = g.len > 0 ? (s - g.s0) / g.len : 0;
  if (g.k === 'arc') {
    const a = g.a0 + g.sw * u;
    out.x = g.cx + g.r * Math.cos(a);
    out.y = g.cy + g.r * Math.sin(a);
    out.z = g.z;
  } else {
    out.x = g.x0 + (g.x1 - g.x0) * u;
    out.y = g.y0 + (g.y1 - g.y0) * u;
    out.z = g.z1 === g.z0 ? g.z0 : g.z0 + (g.z1 - g.z0) * bend(u);
  }
  return j;
}

/** The angle one pitch `p` spans on a wheel of pitch radius `r`: the angle between two tooth gaps. */
export const pitchAngle = (r: number, p: number) => 2 * Math.asin(Math.min(1, p / (2 * r)));

/** The length of a taut chain around the path, in chord lengths: an arc counts one pitch per tooth. */
export function chordLength(o: Path, p: number): number {
  let L = 0;
  for (const g of o.segs) {
    if (g.k === 'arc') L += (Math.abs(g.sw) / pitchAngle(g.r, p)) * p;
    else L += Math.hypot(g.x1 - g.x0, g.y1 - g.y0, g.z1 - g.z0);
  }
  return L;
}

/**
 * Lays `N` pins one pitch `p` apart along the path `o`, the first on the first wheel's pitch circle
 * at a tooth gap (that wheel's gaps are at `theta + k * alpha`). The last pin on the last wheel
 * ends the taut part; the pins after it are spread along the path back to the first pin.
 */
export function layPins(o: Path, N: number, p: number, theta: number, alpha: number, out: Pins): void {
  const segs = o.segs;
  const first = segs[0] as Extract<PathSeg, { k: 'arc' }>;
  const lastSeg = segs[segs.length - 1];
  const totalS = lastSeg.s0 + lastSeg.len;
  const wheels = segs.reduce((m, g) => (g.k === 'arc' ? Math.max(m, g.wheel + 1) : m), 0);
  const dir = Math.sign(first.sw) || 1;
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const u = dir > 0 ? mod(theta - first.a0, alpha) : mod(first.a0 - theta, alpha);
  out.parity = mod(Math.round((first.a0 + dir * u - theta) / alpha), 2);
  let s = Math.min(first.len * 0.999, first.r * u);
  const sFirst = s;
  if (sPin.length < N) sPin = new Float64Array(N);
  sPin[0] = s;
  let hint = pathAt(o, s, pt3, 0);
  out.x[0] = pt3.x;
  out.y[0] = pt3.y;
  out.z[0] = pt3.z;
  out.wheel[0] = 0;
  let lastOnWheel = 0;
  const q = { x: 0, y: 0, z: 0 };
  for (let k = 1; k < N; k++) {
    const px = out.x[k - 1];
    const py = out.y[k - 1];
    const pz = out.z[k - 1];
    let lo = s + 0.4 * p;
    let hi = s + 2.6 * p;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      pathAt(o, mid, q, hint);
      if (Math.hypot(q.x - px, q.y - py, q.z - pz) < p) lo = mid;
      else hi = mid;
    }
    s = (lo + hi) / 2;
    sPin[k] = s;
    hint = pathAt(o, s, q, hint);
    out.x[k] = q.x;
    out.y[k] = q.y;
    out.z[k] = q.z;
    const seg = segs[hint];
    // a pin that has gone round past the end of the path is not on a wheel: the spread of the last run replaces it
    out.wheel[k] = seg.k === 'arc' && s < totalS ? seg.wheel : -1;
    if (out.wheel[k] === wheels - 1) lastOnWheel = k;
  }
  // The pins after the last one on the last wheel share the length that is left over: their spacing
  // along the path is stretched or squeezed evenly (by a few percent at most) so the last one is
  // one link before the first pin. They stay on the path, so the run stays straight and nothing
  // jumps when a pin changes from the wheel to the run.
  const sEnd = sFirst + totalS;
  const sL = sPin[lastOnWheel];
  const links = N - lastOnWheel;
  for (let k = lastOnWheel + 1; k < N; k++) {
    pathAt(o, sL + ((sEnd - sL) * (k - lastOnWheel)) / links, q, 0);
    out.x[k] = q.x;
    out.y[k] = q.y;
    out.z[k] = q.z;
    out.wheel[k] = -1;
  }
}
