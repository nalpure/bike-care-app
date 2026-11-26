// Which parts a card draws. Pure (no three.js), so player/test/stage.test.ts can check it.
//
// Two rules:
// - A card with `show` draws its focus parts and its show parts and nothing else: every other part
//   has target 0, so it fades out over the card change and is then not drawn. Only focus parts are
//   marked (hot).
// - A card without `show` keeps the old rule: the focus, its context groups and the frame stay,
//   the rest of the bike is faded to FADED.
// Explore mode's "show all" shows everything; a part a state label hides stays hidden.
// When the frame is not drawn, the stand clamp is not either (and ThreeStage hides the stand and
// the hook): they hold nothing.

/** target opacity of a part that is only context */
export const FADED = 0.1;

export interface VisCard {
  /** every part id of the bike */
  ids: string[];
  /** parts of the focus nodes */
  hot: ReadonlySet<string>;
  /** parts of the focus and show nodes, or null on a card without `show` */
  shown: ReadonlySet<string> | null;
  /** off the bike because of a state label */
  hidden: ReadonlySet<string>;
  /** the old context rule, used only without `show` */
  context: (id: string) => boolean;
  exploring: boolean;
  showAll: boolean;
  /** the part picked in explore mode */
  selected: string | null;
}

export interface VisTarget {
  vis: number;
  hot: number;
}

/** The parts a card with `show` draws: focus parts and the parts of the show nodes that exist on this bike. */
export function shownParts(hot: Iterable<string>, show: string[], partsOf: (node: string) => string[], has: (part: string) => boolean): Set<string> {
  const out = new Set(hot);
  for (const n of show) for (const p of partsOf(n)) if (has(p)) out.add(p);
  return out;
}

/**
 * Small parts drawn with what holds them: each part of `held` is added when one of its holders is drawn and the part
 * is on this bike (the barrel adjusters, barrel.ts: the rear one with the derailleur, the front one with the shifter or
 * the cable). Returns the same set.
 */
export function addHeld(shown: Set<string>, held: Record<string, string[]>, has: (part: string) => boolean): Set<string> {
  for (const [part, holders] of Object.entries(held)) if (has(part) && holders.some((h) => shown.has(h))) shown.add(part);
  return shown;
}

export function visTargets(c: VisCard): { targets: Map<string, VisTarget>; frameGone: boolean } {
  const out = c.shown ? 0 : FADED;
  const targets = new Map<string, VisTarget>();
  for (const id of c.ids) {
    const isHot = c.hot.has(id);
    const isCtx = c.shown ? c.shown.has(id) : c.context(id);
    let vis = c.hidden.has(id) ? 0 : c.exploring && c.showAll ? 1 : isHot || isCtx ? 1 : out;
    let hot = isHot ? 1 : 0;
    if (c.exploring && c.selected) {
      hot = id === c.selected ? 1 : 0;
      if (!c.hidden.has(id)) vis = c.showAll || id === c.selected || isHot || isCtx ? 1 : out;
    }
    targets.set(id, { vis, hot });
  }
  const frameGone = targets.get('frame')?.vis === 0;
  const clamp = targets.get('stand_clamp');
  if (frameGone && clamp) clamp.vis = 0;
  return { targets, frameGone };
}
