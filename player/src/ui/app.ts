// The app shell: which view is open, the tab bar, overlays (test notice, assistant, feedback),
// and the active journey. Views render from the store and the journey; nothing here knows any
// repair content.

import type { Content } from '../engine/content.js';
import { Journey, Session, type Start } from '../engine/journey.js';
import type { Value } from '../../../tools/lib/conditions.js';
import type { Bike, Finding, Store } from '../engine/store.js';
import { h, icon, ICON } from './dom.js';
import { renderJourney } from './flow.js';
import { endPreview, renderBike } from './bike.js';
import { renderGarage, renderHome, renderNotes, renderShopTab } from './home.js';
import { placeSoon, assistantButton } from './assistant.js';
import { attachEdgeBack } from './edge.js';
import { pickBack, renderPick, type PickStep } from './pick.js';
import type { Stage } from './stage.js';

export type View =
  | { k: 'home' }
  | { k: 'garage' }
  | { k: 'bike'; id: string }
  | { k: 'shop' }
  | { k: 'notes' }
  /** the first screen of a flow: which bike, and for an unknown bike how to describe it */
  | { k: 'pick'; start: Start; step: PickStep }
  | { k: 'journey' };

type Overlay =
  | null
  | { k: 'notice' }
  | { k: 'assistant' }
  | { k: 'feedback' }
  /** a warning before something that cannot be undone */
  | { k: 'confirm'; title: string; text: string; ok: string; run: () => void };

export class App {
  view: View = { k: 'home' };
  journey: Journey | null = null;
  /** one sitting per garage bike (hard rule 12); an unknown bike starts a fresh one each time */
  private sessions = new Map<string, Session>();
  /** where Back on the first screen of the journey returns to */
  private origin: View = { k: 'home' };
  /** the sitting of the open journey */
  private sitting = new Session();
  overlay: Overlay = null;
  /** direction of the last card move, for the slide animation */
  moved: 'next' | 'back' | null = null;
  private toastTimer = 0;

  constructor(
    readonly c: Content,
    readonly store: Store,
    readonly root: HTMLElement,
    readonly stage: Stage,
  ) {
    if (!store.data.noticeSeen) this.overlay = { k: 'notice' };
    document.addEventListener('keydown', (e) => this.onKey(e));
    // The assistant button keeps clear of buttons that scroll under it.
    document.addEventListener('scroll', () => placeSoon(this), true);
    window.addEventListener('resize', () => placeSoon(this));
    attachEdgeBack(this);
    // The browser's own back (a button, or an edge swipe in Safari) goes back in the app too.
    window.addEventListener('popstate', () => {
      this.sentinel = false;
      if (performance.now() - this.lastEdgeBack < 700) return;
      this.goBack(true);
    });
  }

  /** a history entry the browser's back button can pop instead of leaving the app */
  private sentinel = false;
  /** when our own edge swipe last went back, so the browser's gesture is not counted twice */
  lastEdgeBack = -1e9;
  /** a card is sliding out; ignore further taps until it is gone */
  private busy = false;

  /** What Back does on this screen, or null where there is nowhere to go back to (the main tabs). */
  backTarget(): (() => void) | null {
    if (this.overlay) return this.overlay.k === 'notice' ? null : () => this.closeOverlay();
    switch (this.view.k) {
      case 'journey':
        return this.journey ? () => this.back() : null;
      case 'pick':
        return () => pickBack(this, this.view as Extract<View, { k: 'pick' }>);
      case 'bike':
        return () => this.go({ k: 'garage' });
      default:
        return null;
    }
  }

  /** Does what the back arrow does; false on a main tab. `instant`: the screen has already moved away, so no slide. */
  goBack(instant = false): boolean {
    const t = this.backTarget();
    this.noSlide = instant;
    t?.();
    this.noSlide = false;
    return !!t;
  }

  private noSlide = false;

  /** Runs a card move after the text has slid out (at once with reduced motion). */
  advance(fn: (j: Journey) => void, dir: 'next' | 'back'): void {
    const el = this.root.querySelector<HTMLElement>('.step');
    if (this.busy) return;
    if (!el || this.noSlide || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return this.act(fn, dir);
    this.busy = true;
    el.classList.add(dir === 'next' ? 'out-next' : 'out-back');
    window.setTimeout(() => {
      this.busy = false;
      this.act(fn, dir);
    }, 170);
  }

  go(view: View): void {
    this.view = view;
    this.render();
  }

  /** A flow starts by choosing the bike, unless it is opened from a bike (a to-do item). */
  start(start: Start, bike?: Bike): void {
    if (bike) this.run(start, bike, {}, this.view);
    else this.go({ k: 'pick', start, step: { k: 'list' } });
  }

  /** Starts the journey on a garage bike, or on an unknown bike (null) with facts given so far. */
  run(start: Start, bike: Bike | null, preset: Record<string, Value>, origin: View): void {
    let session = bike ? this.sessions.get(bike.id) : undefined;
    if (!session) {
      session = new Session();
      if (bike) this.sessions.set(bike.id, session);
    }
    this.sitting = session;
    this.journey = new Journey(this.c, this.store, bike, session, start, preset);
    this.origin = origin;
    this.moved = null;
    this.view = { k: 'journey' };
    this.render();
  }

  /** The keep screen saved an unknown bike: later flows on it share its sitting. */
  adoptSession(bike: Bike): void {
    if (!this.sessions.has(bike.id)) this.sessions.set(bike.id, this.sitting);
  }

  openTodo(bike: Bike, f: Finding): void {
    this.start({ job: f.job!, urgency: f.urgency, params: f.pos ? { pos: f.pos } : {} }, bike);
  }

  /** Name of the bike in the open flow, for headers. */
  get bikeName(): string {
    return this.journey?.bikeName ?? '';
  }

  /** Runs an action on the journey and re-renders. */
  act(fn: (j: Journey) => void, moved: 'next' | 'back' | null = null): void {
    if (!this.journey) return;
    fn(this.journey);
    this.moved = moved;
    if (this.journey.screen().kind === 'closed') this.closeJourney();
    else this.render();
  }

  /** Back by hand; from the first screen of a journey, back leaves it. */
  back(): void {
    if (!this.journey) return;
    if (!this.journey.canBack) {
      this.journey = null;
      this.go(this.origin);
      return;
    }
    // On a card, Back goes to the previous card, not just to the same card before its tap.
    const cardId = (j: Journey) => {
      const s = j.screen();
      return s.kind === 'card' ? s.card.id : null;
    };
    this.advance((j) => {
      const from = cardId(j);
      j.back();
      while (from !== null && j.canBack && cardId(j) === from) j.back();
    }, 'back');
  }

  closeJourney(): void {
    this.journey = null;
    this.view = { k: 'home' };
    this.render();
  }

  /** The warning before a bike is deleted; after() runs once it is gone. */
  confirmDelete(b: Bike, after?: () => void): void {
    this.openOverlay({
      k: 'confirm',
      title: `Delete ${b.name}?`,
      text: 'Its facts, findings and to-do items are deleted from this phone. This cannot be undone.',
      ok: 'Delete',
      run: () => {
        this.store.removeBike(b.id);
        after?.();
        this.toast(`Deleted "${b.name}"`);
      },
    });
  }

  toast(msg: string): void {
    let t = document.querySelector<HTMLElement>('.toast');
    if (!t) {
      t = h('div.toast', { role: 'status' });
      document.body.append(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (t!.hidden = true), 2600);
  }

  setTextOnly(on: boolean): void {
    this.store.data.textOnly = on;
    this.store.save();
    this.render();
  }

  private onKey(e: KeyboardEvent): void {
    if (this.overlay) {
      if (e.key === 'Escape') {
        this.overlay = null;
        this.render();
      }
      return;
    }
    if (this.view.k !== 'journey' || !this.journey) return;
    const target = e.target as HTMLElement;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const s = this.journey.screen();
    if (s.kind !== 'card') return;
    if (e.key === 'ArrowRight' && s.card.nextEnabled) {
      e.preventDefault();
      this.advance((j) => j.next(), 'next');
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.back();
    }
  }

  // ------------------------------------------------------------ render

  render(): void {
    const keepScroll = this.root.querySelector<HTMLElement>('.scroll')?.scrollTop ?? 0;
    const sameView = this.root.dataset.view === this.viewKey();
    // The bike page owns the 3D stage while it is open; any other screen lets it go (a card takes it by itself).
    if (this.view.k !== 'bike' && this.view.k !== 'journey') endPreview(this);
    this.root.replaceChildren();
    this.root.dataset.view = this.viewKey();
    let screen: HTMLElement;
    switch (this.view.k) {
      case 'home':
        screen = renderHome(this);
        break;
      case 'garage':
        screen = renderGarage(this);
        break;
      case 'bike':
        screen = renderBike(this, this.view.id, () => this.go({ k: 'garage' })) ?? renderGarage(this);
        break;
      case 'shop':
        screen = renderShopTab(this);
        break;
      case 'notes':
        screen = renderNotes(this);
        break;
      case 'pick':
        screen = renderPick(this, this.view);
        break;
      case 'journey':
        screen = this.journey ? renderJourney(this, this.journey) : renderHome(this);
        break;
    }
    this.root.append(screen);
    const inJourney = this.view.k === 'journey' || this.view.k === 'pick';
    if (!inJourney) this.root.append(this.tabbar());
    this.root.append(assistantButton(this));
    if (this.overlay) this.root.append(this.renderOverlay());
    placeSoon(this);
    if (this.backTarget() && !this.sentinel) {
      history.pushState({ bikeApp: 1 }, '');
      this.sentinel = true;
    }
    if (sameView) {
      const sc = this.root.querySelector<HTMLElement>('.scroll');
      if (sc) sc.scrollTop = keepScroll;
    }
  }

  private viewKey(): string {
    if (this.view.k === 'journey' && this.journey) {
      const s = this.journey.screen();
      return `journey:${s.kind}:${s.kind === 'card' ? s.card.id : s.kind === 'question' ? s.key : ''}`;
    }
    if (this.view.k === 'pick') return `pick:${this.view.step.k}`;
    return this.view.k === 'bike' ? `bike:${this.view.id}` : this.view.k;
  }

  private tabbar(): HTMLElement {
    const tab = (k: View['k'], label: string, ic: string) =>
      h('button', { 'aria-current': this.view.k === k || (k === 'garage' && this.view.k === 'bike') ? 'page' : 'false', onclick: () => this.go({ k } as View) }, icon(ic), label);
    return h('nav.tabbar', { 'aria-label': 'Main' },
      tab('home', 'Repair', ICON.repair),
      tab('garage', 'Garage', ICON.garage),
      tab('shop', 'Shop', ICON.shop),
      tab('notes', 'Notes', ICON.notes),
    );
  }

  openOverlay(o: Overlay): void {
    this.overlay = o;
    this.render();
  }

  private closeOverlay = () => {
    this.overlay = null;
    this.render();
  };

  private renderOverlay(): HTMLElement {
    const o = this.overlay!;
    const modal = (card: HTMLElement) => h('div.modal', { onclick: (e: Event) => e.target === e.currentTarget && o.k !== 'notice' && this.closeOverlay() }, card);
    if (o.k === 'notice') {
      return modal(h('div.card', { role: 'dialog', 'aria-label': 'Test build' },
        h('span.eyebrow', 'Test build'),
        h('b.t', 'Please read this first'),
        h('p', this.c.notice),
        h('p.s', 'Do not rely on these steps for brakes, wheels or anything else that keeps you safe. When in doubt, ask a bike shop.'),
        h('p.s', 'Spotted something odd? Tap "Note" on any step to leave feedback. You find all notes in the Notes tab.'),
        // The licence of the 3D parts (CC BY 4.0) requires this credit while library parts are in use; never drop it.
        h('p.s', { 'data-test': 'credits' },
          '3D parts based on "Rigid Bike [Touring Bike]" (',
          h('a', { href: 'https://skfb.ly/pAzTT', target: '_blank', rel: 'noopener' }, 'https://skfb.ly/pAzTT'),
          ') by Mohamed Farhan, licensed under CC BY 4.0 (',
          h('a', { href: 'http://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener' }, 'http://creativecommons.org/licenses/by/4.0/'),
          '). Changed: split into parts, simplified, re-oriented.'),
        h('button.btn.primary.wide', { 'data-test': 'notice-ok', onclick: () => {
          this.store.data.noticeSeen = true;
          this.store.save();
          this.closeOverlay();
        } }, 'I understand'),
      ));
    }
    if (o.k === 'confirm') {
      return modal(h('div.card', { role: 'alertdialog', 'aria-label': o.title },
        h('b.t', o.title),
        h('p', o.text),
        h('div.row2',
          h('button.btn', { 'data-test': 'confirm-cancel', onclick: this.closeOverlay }, 'Cancel'),
          h('button.btn.danger', { 'data-test': 'confirm-ok', onclick: () => {
            this.overlay = null;
            o.run();
            this.render();
          } }, o.ok),
        ),
      ));
    }
    if (o.k === 'assistant') {
      const ctx = this.journey?.context() ?? { facts: {}, state: [], path: [] };
      const lines = [
        `Bike: ${this.journey?.bikeName ?? '(none chosen)'}`,
        `Flow: ${ctx.flow ?? '(none)'}`,
        `Step: ${ctx.item ?? '(none)'}`,
        `Review unit: ${ctx.unit ?? '(none)'}`,
        `Facts: ${Object.entries(ctx.facts).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`,
        `Taken apart / not ready to ride: ${ctx.state.join(', ') || '(nothing)'}`,
        `Path so far: ${ctx.path.join(' > ') || '(nothing yet)'}`,
      ];
      return modal(h('div.card', { role: 'dialog', 'aria-label': 'Assistant' },
        h('span.eyebrow', 'Assistant'),
        h('b.t', 'Not connected yet'),
        h('p.s', 'In the real app the assistant answers questions about the step you are on. It would receive this:'),
        h('div.kv', lines.join('\n')),
        h('button.btn.wide', { onclick: this.closeOverlay }, 'Close'),
      ));
    }
    // feedback
    const ctx = this.journey?.context() ?? { facts: {}, state: [], path: [] };
    const ta = h('textarea.text', { placeholder: 'What is unclear, wrong or missing here?', 'aria-label': 'Your note', 'data-test': 'note-text' }) as HTMLTextAreaElement;
    return modal(h('div.card', { role: 'dialog', 'aria-label': 'Feedback' },
      h('span.eyebrow', `Note on ${ctx.unit ?? 'this screen'}`),
      h('b.t', 'Leave a note'),
      ta,
      h('div.row2',
        h('button.btn', { onclick: this.closeOverlay }, 'Cancel'),
        h('button.btn.primary', { 'data-test': 'note-save', onclick: () => {
          const text = ta.value.trim();
          if (!text) return;
          this.store.addNote({
            id: `n${Date.now().toString(36)}`,
            date: new Date().toISOString(),
            text,
            flow: ctx.flow,
            item: ctx.item,
            unit: ctx.unit,
            title: ctx.title,
            last: ctx.path.slice(-3),
            path: ctx.path,
            facts: ctx.facts,
            bike: this.journey?.bikeName ?? '(none chosen)',
            content_hash: this.c.bundle.content_hash,
          });
          this.overlay = null;
          this.render();
          this.toast('Note saved. Thank you.');
        } }, 'Save note'),
      ),
    ));
  }
}
