// Named camera positions, ported from the prototype's step cameras (cam, behind, gapCam,
// barrelCam, mainCam). A view in bike space follows the bike when it is lifted, hung or turned
// over; the whole-bike view stays in world space, so the user sees the bike move.
//
// Close-ups are built from the bike's own dimensions (BikeSpec), so they frame the same part on
// every bike. The stage widens the field of view on narrow screens; the close-ups below are
// framed for a phone in portrait (stage about 1.1 : 1) and landscape.

import { barrelTurn, GAP_OK, LC, upperPulley, type BikeSpec } from './bike.js';
import type { VIEWS } from './registry.js';

export interface ViewPose {
  /** camera position and the point it looks at */
  p: [number, number, number];
  t: [number, number, number];
  space: 'world' | 'bike';
}

type ViewName = (typeof VIEWS)[number];

const hasDerailleur = (B: BikeSpec) => B.gears === 'derailleur' && B.n > 1;

export const VIEW_POSES: Record<ViewName, (B: BikeSpec) => ViewPose> = {
  whole_bike: () => ({ p: [-1.45, 1.65, 5.7], t: [0.2, 1.1, 0.05], space: 'world' }),
  drive_side: (B) => ({ p: [-0.5, B.bby + 0.95, 3.6], t: [-0.1, B.bby + 0.37, 0.12], space: 'bike' }),
  // From straight behind, a little outside the sprockets: the upper pulley reads against the
  // sprockets, with the bike upright or upside down. The frame runs from the sprockets' top
  // down past the lower pulley.
  derailleur_from_behind: (B) => {
    const us = hasDerailleur(B) ? upperPulley(B, B.zs[0]) : [B.rx, B.huby - 0.1];
    const ul = hasDerailleur(B) ? upperPulley(B, B.zs[B.n - 1]) : us;
    const low = Math.min(us[1], ul[1]) - LC * 0.6;
    const top = B.huby + B.rs[B.n - 1] * 0.4;
    const ty = (top + low) / 2;
    const zc = B.chainline;
    return { p: [B.rx - 0.95, ty + 0.05, zc + 0.13], t: [B.rx - 0.03, ty, zc + 0.035], space: 'bike' };
  },
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
    return { p: [g[0] + tx * 0.42, g[1] + ty * 0.42, zN + 0.4], t: g, space: 'bike' };
  },
  barrel_adjuster_close: (B) => {
    const bt = barrelTurn(B);
    const t: [number, number, number] = [bt.pos[0], bt.pos[1], bt.pos[2]];
    // at the derailleur: from behind, above and outside; on the trigger shifter it points
    // forward and in, so look at its head from the front and inside
    if (B.barrelAt === 'derailleur') return { p: [t[0] - 0.42, t[1] + 0.28, t[2] + 0.6], t: [t[0], t[1] - 0.03, t[2]], space: 'bike' };
    return { p: [t[0] + 0.5, t[1] + 0.42, t[2] - 0.5], t, space: 'bike' };
  },
  handlebar_from_above: (B) => {
    const [hx, hy] = B.HT;
    return { p: [hx - 0.8, hy + 1.0, 0.45], t: [hx - 0.04, hy + 0.1, 0.05], space: 'bike' };
  },
  chain_close: (B) => {
    const ty = (B.bby + B.huby) / 2 - 0.075;
    return { p: [-0.3, ty + 0.35, 1.45], t: [-0.38, ty, B.chainline], space: 'bike' };
  },
};

export function viewPose(name: string, B: BikeSpec): ViewPose | undefined {
  const f = (VIEW_POSES as Record<string, (b: BikeSpec) => ViewPose>)[name];
  return f ? f(B) : undefined;
}

/** The garage preview: the whole bike from the drive side, a little from the front and above. */
export function previewPose(B: BikeSpec): ViewPose {
  const cx = (B.rx + B.FX) / 2;
  return { p: [cx - 1.2, 1.55, 5.1], t: [cx, B.huby + 0.32, 0.05], space: 'world' };
}
