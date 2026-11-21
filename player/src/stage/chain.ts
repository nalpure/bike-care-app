// Chain path math, ported from the prototype (legacy/Bikefix-garage-guide v2.html, buildPath).
// No three.js: plain numbers, so it can be tested in node.

export interface Circle {
  x: number;
  y: number;
  z: number;
  r: number;
  /** +1 when the chain wraps it counterclockwise (seen from the drive side), -1 clockwise */
  s: number;
}

export interface Path {
  x: number[];
  y: number[];
  z: number[];
  /** cumulative length */
  l: number[];
  n: number;
}

const TAU = Math.PI * 2;

export const newPath = (): Path => ({ x: [], y: [], z: [], l: [], n: 0 });

/**
 * Fills `o` with a closed polyline around the circles in travel order and returns its length.
 * Each pair of neighbours is joined by the common tangent that matches their wrap directions.
 */
export function buildPath(circ: Circle[], o: Path): number {
  const n = circ.length;
  const T: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = circ[i];
    const b = circ[(i + 1) % n];
    const wx = b.x - a.x;
    const wy = b.y - a.y;
    const D = Math.hypot(wx, wy) || 1e-6;
    const k = b.r * b.s - a.r * a.s;
    const phi = Math.atan2(wy, wx) + Math.asin(Math.max(-1, Math.min(1, -k / D)));
    T.push([Math.sin(phi), -Math.cos(phi)]);
  }
  let c = 0;
  const angleIn = (i: number) => {
    const ci = circ[i];
    const m1 = T[(i - 1 + n) % n];
    return Math.atan2(ci.s * m1[1], ci.s * m1[0]);
  };
  for (let i = 0; i < n; i++) {
    const ci = circ[i];
    const m2 = T[i];
    const ta = angleIn(i);
    const td = Math.atan2(ci.s * m2[1], ci.s * m2[0]);
    let dl = (td - ta) * ci.s;
    dl = ((dl % TAU) + TAU) % TAU;
    const sw = dl * ci.s;
    const steps = Math.max(2, Math.ceil(dl / 0.14));
    for (let k = 0; k <= steps; k++) {
      const th = ta + (sw * k) / steps;
      o.x[c] = ci.x + ci.r * Math.cos(th);
      o.y[c] = ci.y + ci.r * Math.sin(th);
      o.z[c] = ci.z;
      c++;
    }
    // The straight run to the next wheel. Where the two wheels are in different planes, the chain
    // leaves each in its plane and bends sideways on the way (smoothstep in z), as a real chain
    // flexes, instead of cutting across at an angle into the neighbouring sprockets.
    const nx = circ[(i + 1) % n];
    if (Math.abs(nx.z - ci.z) > 1e-6) {
      const x0 = o.x[c - 1];
      const y0 = o.y[c - 1];
      const tb = angleIn((i + 1) % n);
      const x1 = nx.x + nx.r * Math.cos(tb);
      const y1 = nx.y + nx.r * Math.sin(tb);
      const m = Math.min(24, Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.04)));
      for (let k = 1; k < m; k++) {
        const t = k / m;
        o.x[c] = x0 + (x1 - x0) * t;
        o.y[c] = y0 + (y1 - y0) * t;
        o.z[c] = ci.z + (nx.z - ci.z) * t * t * (3 - 2 * t);
        c++;
      }
    }
  }
  o.x[c] = o.x[0];
  o.y[c] = o.y[0];
  o.z[c] = o.z[0];
  c++;
  o.l[0] = 0;
  for (let i = 1; i < c; i++) o.l[i] = o.l[i - 1] + Math.hypot(o.x[i] - o.x[i - 1], o.y[i] - o.y[i - 1], o.z[i] - o.z[i - 1]);
  o.n = c;
  return o.l[c - 1];
}

/** Point and direction at length `s` along the path (s wraps around). */
export function pointAt(o: Path, s: number, out: { x: number; y: number; z: number; dx: number; dy: number; dz: number }, hint = 0): number {
  const total = o.l[o.n - 1];
  s = ((s % total) + total) % total;
  let j = hint < o.n - 1 && o.l[hint] <= s ? hint : 0;
  while (j < o.n - 2 && o.l[j + 1] < s) j++;
  const sl = o.l[j + 1] - o.l[j] || 1e-6;
  const u = (s - o.l[j]) / sl;
  out.x = o.x[j] + (o.x[j + 1] - o.x[j]) * u;
  out.y = o.y[j] + (o.y[j + 1] - o.y[j]) * u;
  out.z = o.z[j] + (o.z[j + 1] - o.z[j]) * u;
  out.dx = o.x[j + 1] - o.x[j];
  out.dy = o.y[j + 1] - o.y[j];
  out.dz = o.z[j + 1] - o.z[j];
  return j;
}
