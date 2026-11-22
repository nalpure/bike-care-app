// The stage above each card: what the 3D view shows for the current step.
// The element is kept across renders, so the view stays pinned while the text changes.
// The three.js stage is in player/src/stage/; the placeholder here names the parts in focus and
// is used by tests and when the 3D view is switched off.

import { h } from './dom.js';

export interface StageView {
  /** the card this view belongs to; a new id restarts camera, focus and animation */
  id?: string;
  /** the button tapped on the card; a change stops a solution that is playing */
  chosen?: string;
  /** the bike's name, written on its frame */
  bike?: string;
  /** named 3D nodes to highlight */
  focus: string[];
  /** named 3D nodes drawn plain; the 3D view will hide every part in neither focus nor show (a later change uses it) */
  show?: string[];
  /** named camera position */
  view?: string;
  /** a generic motion on a node, or a named clip */
  animation?: any;
  /** session state labels (what is apart or not ready to ride) after this card */
  labels: string[];
  /** the labels before this card; a step that sets or clears one shows the change */
  labelsBefore?: string[];
  /** facts of the bike, so the scene can pick parts */
  facts: Record<string, unknown>;
}

export interface Stage {
  readonly el: HTMLElement;
  show(v: StageView): void;
  /** plays a button's solution animations in the same step */
  playSolution(anims: any[]): void;
  replay(): void;
  /** The whole bike turning slowly inside host (the garage's bike page). Only the 3D stage has it. */
  preview?(facts: Record<string, unknown>, host: HTMLElement, opts?: { name?: string }): void;
  endPreview?(): void;
  /** A still picture (PNG data URL) of a bike for lists; null when it cannot be drawn. */
  snapshot?(facts: Record<string, unknown>, width?: number, height?: number, name?: string): string | null;
}

export class PlaceholderStage implements Stage {
  readonly el: HTMLElement;
  private body: HTMLElement;

  constructor() {
    this.body = h('div.ph');
    this.el = h('section.stage', { 'aria-label': 'Picture of the bike' }, this.body);
  }

  show(v: StageView): void {
    // v.show is ignored for now; a later change uses it.
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
