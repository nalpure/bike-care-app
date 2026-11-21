// Named camera positions, ported from the prototype's step cameras (cam, behind, gapCam,
// barrelCam, mainCam). A view in bike space follows the bike when it is lifted, hung or turned
// over; the whole-bike view stays in world space, so the user sees the bike move.
//
// Close-ups are built from the bike's own dimensions (BikeSpec), so they frame the same part on
// every bike. The stage widens the field of view on narrow screens; the close-ups below are
// framed for a phone in portrait (stage about 1.1 : 1) and landscape.

import { barrelTurn, derGeom, LC, RP, GAP_OK, type BikeSpec } from './bike.js';
import type { VIEWS } from './registry.js';

export interface ViewPose {
  /** camera position and the point it looks at */
  p: [number, number, number];
  t: [number, number, number];
  space: 'world' | 'bike';
}

type ViewName = (typeof VIEWS)[number];

export const VIEW_POSES: Record<ViewName, (B: BikeSpec) => ViewPose> = {
  whole_bike: () => ({ p: [-1.45, 1.65, 5.7], t: [0.2, 1.1, 0.05], space: 'world' }),
  drive_side: (B) => ({ p: [-0.5, B.bby + 0.95, 3.6], t: [-0.1, B.bby + 0.37, 0.12], space: 'bike' }),
  // From straight behind, at the height of the pulleys and a little outside the sprockets: the
  // upper pulley reads against the sprocket above it, with the bike upright or upside down.
  // The frame runs from the largest sprocket's top down past the lower pulley.
  derailleur_from_behind: (B) => {
    const zc = (B.zs[0] + B.zs[B.n - 1]) / 2;
    const rl = B.rs[B.n - 1];
    const ty = B.huby - (rl + GAP_OK + RP + LC * 0.6) / 2 - 0.02;
    return { p: [B.rx - 0.95, ty + 0.05, zc + 0.15], t: [B.rx, ty, zc + 0.04], space: 'bike' };
  },
  // From the drive side, a little in front of the axle and below the gap, so the derailleur body
  // (behind the axle) and the links (below) stay out of the way: the gap between the upper
  // pulley and the largest sprocket fills the middle of the picture.
  derailleur_side_close: (B) => {
    const rl = B.rs[B.n - 1];
    const gy = B.huby - rl - GAP_OK / 2;
    return { p: [B.rx + 0.16, gy - 0.1, B.zs[B.n - 1] + 0.6], t: [B.rx - 0.01, gy - 0.015, B.zs[B.n - 1]], space: 'bike' };
  },
  barrel_adjuster_close: (B) => {
    const bt = barrelTurn(B);
    if (B.barrelAt === 'derailleur') {
      const G = derGeom(B);
      const t: [number, number, number] = [bt.pos[0], bt.pos[1] - 0.03, G.zL];
      return { p: [t[0] - 0.42, t[1] + 0.25, t[2] + 0.62], t, space: 'bike' };
    }
    // on the trigger shifter it points forward and in, so look at its head from the front and inside
    const t: [number, number, number] = [bt.pos[0], bt.pos[1], bt.pos[2]];
    return { p: [t[0] + 0.5, t[1] + 0.42, t[2] - 0.5], t, space: 'bike' };
  },
  handlebar_from_above: (B) => {
    const [hx, hy] = B.HT;
    return { p: [hx - 0.8, hy + 1.0, 0.45], t: [hx - 0.04, hy + 0.1, 0.05], space: 'bike' };
  },
  chain_close: (B) => {
    const ty = (B.bby + B.huby) / 2 - 0.075;
    return { p: [-0.3, ty + 0.35, 1.55], t: [-0.38, ty, 0.18], space: 'bike' };
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
