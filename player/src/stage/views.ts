// Named camera positions, ported from the prototype's step cameras (cam, behind, gapCam,
// barrelCam, mainCam). A view in bike space follows the bike when it is lifted, hung or turned
// over; the whole-bike view stays in world space, so the user sees the bike move.
//
// Close-ups are built from the bike's own dimensions (BikeSpec), so they frame the same part on
// every bike. The stage widens the field of view on narrow screens; the close-ups below are
// framed for a phone in portrait (stage about 1.1 : 1) and landscape.

import { barrelTurn, GAP_OK, lowerPulley, upperPulley, type BikeSpec } from './bike.js';
import { barrelPick, frontPlace, type BarrelPart } from './barrel.js';
import type { VIEWS } from './registry.js';

export interface ViewPose {
  /** camera position and the point it looks at */
  p: [number, number, number];
  t: [number, number, number];
  space: 'world' | 'bike';
  /**
   * Points in bike space (the corners of every drawn part's box) that must fill the picture:
   * the camera keeps this pose's direction and looks at their middle from as near as lets them all in.
   * Set by the stage on a card with `show`, for the views in FIT_VIEWS.
   */
  fit?: V3[];
}

type V3 = [number, number, number];

/** The wide views that frame what a card with `show` draws; close-ups keep their own framing. */
export const FIT_VIEWS: readonly string[] = ['drive_side'];

/**
 * `vp` moved along its own viewing direction and re-aimed so that `pts` (bike space) fill the
 * picture, centred, with `margin` around them. `tanV` is tan(half the vertical field of view),
 * `aspect` width / height of the picture. Pure.
 */
export function fitPose(vp: ViewPose, pts: V3[], tanV: number, aspect: number, margin = 1.1): ViewPose {
  if (!pts.length) return vp;
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a: V3): V3 => {
    const l = Math.hypot(...a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const d = norm(sub(vp.p, vp.t)); // from the target to the camera
  const f: V3 = [-d[0], -d[1], -d[2]]; // viewing direction
  const right = norm([-f[2], 0, f[0]]); // f x up, up = (0, 1, 0)
  const up: V3 = [right[1] * f[2] - right[2] * f[1], right[2] * f[0] - right[0] * f[2], right[0] * f[1] - right[1] * f[0]];
  const tanH = tanV * aspect;
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let i = 0; i < 3; i++) {
    lo[i] = Math.min(lo[i], p[i]);
    hi[i] = Math.max(hi[i], p[i]);
  }
  let c: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let D = 1;
  for (let it = 0; it < 6; it++) {
    const rel = pts.map((p) => {
      const r = sub(p, c);
      return { x: dot(r, right), y: dot(r, up), z: dot(r, f) };
    });
    // the distance from c at which every point is inside the picture, with the margin
    D = Math.max(0.2, ...rel.map((r) => Math.max((Math.abs(r.x) * margin) / tanH, (Math.abs(r.y) * margin) / tanV) - r.z));
    // then move c so that what is drawn sits in the middle of the picture (perspective shifts it a little)
    let nx0 = Infinity, nx1 = -Infinity, ny0 = Infinity, ny1 = -Infinity;
    for (const r of rel) {
      const k = D + r.z;
      nx0 = Math.min(nx0, r.x / k); nx1 = Math.max(nx1, r.x / k);
      ny0 = Math.min(ny0, r.y / k); ny1 = Math.max(ny1, r.y / k);
    }
    const sx = ((nx0 + nx1) / 2) * D;
    const sy = ((ny0 + ny1) / 2) * D;
    c = [c[0] + right[0] * sx + up[0] * sy, c[1] + right[1] * sx + up[1] * sy, c[2] + right[2] * sx + up[2] * sy];
  }
  return { p: [c[0] + d[0] * D, c[1] + d[1] * D, c[2] + d[2] * D], t: c, space: vp.space };
}

type ViewName = (typeof VIEWS)[number];

const hasDerailleur = (B: BikeSpec) => B.gears === 'derailleur' && B.n > 1;

/**
 * From straight behind, a little outside the sprockets. The frame runs from just above the upper
 * pulley (or from `reach`, when that is higher) down past the lower pulley, in the first and the last gear.
 */
function fromBehind(B: BikeSpec, reach = -Infinity): ViewPose {
  const ends = hasDerailleur(B) ? [B.zs[0], B.zs[B.n - 1]] : [B.chainline];
  const ups = ends.map((z) => (hasDerailleur(B) ? upperPulley(B, z) : [B.rx, B.huby - 0.1]));
  const lps = ends.map((z) => (hasDerailleur(B) ? lowerPulley(B, z) : [B.rx, B.huby - 0.26]));
  const top = Math.max(Math.max(...ups.map((u) => u[1])) + 0.07, reach);
  const low = Math.min(...lps.map((l) => l[1])) - 0.02;
  const ty = (top + low) / 2;
  const zc = B.chainline;
  const d = Math.max(0.5, (top - low) * 1.75);
  return { p: [B.rx - d, ty + 0.02, zc + 0.07], t: [B.rx - 0.03, ty, zc + 0.035], space: 'bike' };
}

/**
 * Close on a barrel adjuster, looking at its head (the side where the cable goes in). At the derailleur: from
 * behind, above and outside. On the trigger shifter it points forward and in, so from the front and inside. In
 * the housing below a drop bar its head faces up, to the bar: from the drive side, a little above and behind it, so
 * the bar's bend (in front) does not hide it.
 */
export function barrelClose(B: BikeSpec, which: BarrelPart): ViewPose {
  const bt = barrelTurn(B, which);
  const t: [number, number, number] = [bt.pos[0], bt.pos[1], bt.pos[2]];
  if (which === 'rear_barrel') return { p: [t[0] - 0.2, t[1] + 0.13, t[2] + 0.3], t: [t[0], t[1] - 0.01, t[2]], space: 'bike' };
  if (frontPlace(B.bar) === 'shifter') return { p: [t[0] + 0.5, t[1] + 0.42, t[2] - 0.5], t, space: 'bike' };
  return { p: [t[0] - 0.1, t[1] + 0.08, t[2] + 0.4], t, space: 'bike' };
}

/** Every named view; `barrel` is the barrel adjuster the fact picks (barrel.ts), for barrel_adjuster_close. */
export const VIEW_POSES: Record<ViewName, (B: BikeSpec, barrel: BarrelPart) => ViewPose> = {
  whole_bike: () => ({ p: [-1.45, 1.65, 5.7], t: [0.2, 1.1, 0.05], space: 'world' }),
  drive_side: (B) => ({ p: [-0.5, B.bby + 0.95, 3.6], t: [-0.1, B.bby + 0.37, 0.12], space: 'bike' }),
  // From straight behind, a little outside the sprockets: the upper pulley reads against the
  // sprockets' lowest teeth, with the bike upright or upside down. The frame runs from just above
  // the upper pulley down past the lower pulley, in the first and the last gear.
  derailleur_from_behind: (B) => fromBehind(B),
  // The hanger check: the same view, its top raised so the whole hanger, up to the axle, sits
  // below the caption (which covers about the top tenth of the picture).
  hanger_from_behind: (B) => fromBehind(B, B.huby + 0.04),
  // The gap between the upper pulley and the largest sprocket, seen along the sprocket's edge
  // from behind, above and outside: the derailleur's body and links stay out of the way.
  derailleur_side_close: (B) => {
    const rl = B.rs[B.n - 1];
    const u = hasDerailleur(B) ? upperPulley(B, B.zs[B.n - 1]) : [B.rx, B.huby - rl - 0.05];
    const d = Math.hypot(u[0] - B.rx, u[1] - B.huby) || 1;
    const rx = (u[0] - B.rx) / d;
    const ry = (u[1] - B.huby) / d;
    const zN = B.zs[B.n - 1];
    const g: [number, number, number] = [B.rx + rx * (rl + GAP_OK / 2), B.huby + ry * (rl + GAP_OK / 2), zN];
    // along the sprocket's edge, towards the back and up
    const tx = ry;
    const ty = -rx;
    return { p: [g[0] + tx * 0.3, g[1] + ty * 0.3, zN + 0.28], t: g, space: 'bike' };
  },
  barrel_adjuster_close: (B, barrel) => barrelClose(B, barrel),
  // The library bar is 784 mm wide (a fixed size), so the camera stands further back than for the old 400 mm bar.
  handlebar_from_above: (B) => {
    const [cx, cy] = B.C;
    return { p: [cx - 0.9, cy + 2.0, 0.55], t: [cx + 0.03, cy - 0.02, 0.0], space: 'bike' };
  },
  chain_close: (B) => {
    const ty = (B.bby + B.huby) / 2 - 0.075;
    return { p: [-0.3, ty + 0.35, 1.45], t: [-0.38, ty, B.chainline], space: 'bike' };
  },
};

/** A named view; `barrel` defaults to the barrel picked while the fact is unknown. */
export function viewPose(name: string, B: BikeSpec, barrel: BarrelPart = barrelPick(B.bar, undefined).main): ViewPose | undefined {
  const f = (VIEW_POSES as Record<string, (b: BikeSpec, barrel: BarrelPart) => ViewPose>)[name];
  return f ? f(B, barrel) : undefined;
}

/** The garage preview: the whole bike from the drive side, a little from the front and above. */
export function previewPose(B: BikeSpec): ViewPose {
  const cx = (B.rx + B.FX) / 2;
  return { p: [cx - 1.2, 1.55, 5.1], t: [cx, B.huby + 0.32, 0.05], space: 'world' };
}
