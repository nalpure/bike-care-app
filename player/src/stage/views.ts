// Named camera positions, ported from the prototype's step cameras (cam, behind, gapCam,
// barrelCam, mainCam). A view in bike space follows the bike when it is lifted, hung or turned
// over; the whole-bike view stays in world space, so the user sees the bike move.

import { RX, type BikeSpec } from './bike.js';
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
  drive_side: () => ({ p: [-0.5, 1.45, 3.6], t: [-0.1, 0.92, 0.12], space: 'bike' }),
  derailleur_from_behind: () => ({ p: [RX - 1.85, 0.82, 0.78], t: [RX, 0.55, 0.2], space: 'bike' }),
  derailleur_side_close: () => ({ p: [RX - 0.85, 0.62, 0.95], t: [RX, 0.52, 0.14], space: 'bike' }),
  barrel_adjuster_close: (B) => {
    if (B.barrelAt === 'derailleur') return { p: [RX - 1.0, 0.95, 1.3], t: [RX, 0.6, 0.2], space: 'bike' };
    const t: [number, number, number] = [B.S[0] - 0.07, B.S[1], B.S[2]];
    return { p: [t[0] - 0.55, t[1] + 0.55, t[2] + 0.85], t, space: 'bike' };
  },
  handlebar_from_above: (B) => {
    const [hx, hy] = B.HT;
    return { p: [hx - 0.8, hy + 1.0, 0.45], t: [hx - 0.04, hy + 0.1, 0.05], space: 'bike' };
  },
  chain_close: () => ({ p: [-0.3, 0.8, 1.55], t: [-0.38, 0.45, 0.18], space: 'bike' }),
};

export function viewPose(name: string, B: BikeSpec): ViewPose | undefined {
  const f = (VIEW_POSES as Record<string, (b: BikeSpec) => ViewPose>)[name];
  return f ? f(B) : undefined;
}
