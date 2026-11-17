// The stage above each card: what the 3D view shows for the current step.
// The element is kept across renders, so the view stays pinned while the text changes.
// Part 1 of the build has a placeholder that names the parts in focus; the three.js stage
// replaces it with the same interface.

import { h } from './dom.js';

export interface StageView {
  /** named 3D nodes to highlight */
  focus: string[];
  /** named camera position */
  view?: string;
  /** a generic motion on a node, or a named clip */
  animation?: any;
  /** session state labels (what is apart or not ready to ride) */
  labels: string[];
  /** facts of the bike, so the scene can pick parts */
  facts: Record<string, unknown>;
}

export interface Stage {
  readonly el: HTMLElement;
  show(v: StageView): void;
  /** plays a button's solution animations in the same step */
  playSolution(anims: any[]): void;
  replay(): void;
}

export class PlaceholderStage implements Stage {
  readonly el: HTMLElement;
  private body: HTMLElement;

  constructor() {
    this.body = h('div.ph');
    this.el = h('section.stage', { 'aria-label': 'Picture of the bike' }, this.body);
  }

  show(v: StageView): void {
    const names = (list: string[]) => list.map((n) => n.replace(/_/g, ' '));
    this.body.replaceChildren(
      h('span.eyebrow', v.view ? `View: ${v.view.replace(/_/g, ' ')}` : 'Whole bike'),
      h('div.tags', names(v.focus).map((n) => h('span.tag', n))),
      h('span.s', v.animation?.caption ?? ''),
      h('small.s', '3D view coming in the next build'),
    );
  }

  playSolution(anims: any[]): void {
    const caps = anims.map((a) => a.caption).filter(Boolean);
    if (caps.length) this.body.append(h('div.tags', caps.map((c: string) => h('span.tag', c))));
  }

  replay(): void {}
}
