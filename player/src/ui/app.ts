// The app shell: which view is open, the tab bar, overlays (test notice, assistant, feedback),
// and the active journey. Views render from the store and the journey; nothing here knows any
// repair content.

import type { Content } from '../engine/content.js';
import { Journey, Session, type Start } from '../engine/journey.js';
import type { Bike, Finding, Store } from '../engine/store.js';
import { h, icon, ICON } from './dom.js';
import { renderJourney } from './flow.js';
import { renderBike, renderGarage, renderHome, renderNotes, renderShopTab } from './home.js';
import type { Stage } from './stage.js';

export type View = { k: 'home' } | { k: 'garage' } | { k: 'bike'; id: string } | { k: 'shop' } | { k: 'notes' } | { k: 'journey' };

type Overlay = null | { k: 'notice' } | { k: 'assistant' } | { k: 'feedback' };

export class App {
  view: View = { k: 'home' };
  journey: Journey | null = null;
  session = new Session();
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
  }

  get bike(): Bike {
    return this.store.current;
  }

  go(view: View): void {
    this.view = view;
    this.render();
  }

  start(start: Start): void {
    this.journey = new Journey(this.c, this.store, this.bike, this.session, start);
    this.moved = null;
    this.view = { k: 'journey' };
    this.render();
  }

  openTodo(f: Finding): void {
    this.start({ job: f.job!, urgency: f.urgency, params: f.pos ? { pos: f.pos } : {} });
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
      this.closeJourney();
      return;
    }
    this.act((j) => j.back(), 'back');
  }

  closeJourney(): void {
    this.journey = null;
    this.view = { k: 'home' };
    this.render();
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
      this.act((j) => j.next(), 'next');
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
        screen = renderBike(this, this.view.id);
        break;
      case 'shop':
        screen = renderShopTab(this);
        break;
      case 'notes':
        screen = renderNotes(this);
        break;
      case 'journey':
        screen = this.journey ? renderJourney(this, this.journey) : renderHome(this);
        break;
    }
    this.root.append(screen);
    const inJourney = this.view.k === 'journey';
    if (!inJourney) this.root.append(this.tabbar());
    this.root.append(this.assistantButton(inJourney));
    if (this.overlay) this.root.append(this.renderOverlay());
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

  private assistantButton(low: boolean): HTMLElement {
    return h(`button.assist${low ? '.low' : ''}`, { 'aria-label': 'Ask the assistant', 'data-test': 'assistant', onclick: () => this.openOverlay({ k: 'assistant' }) }, icon(ICON.ask));
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
        h('button.btn.primary.wide', { 'data-test': 'notice-ok', onclick: () => {
          this.store.data.noticeSeen = true;
          this.store.save();
          this.closeOverlay();
        } }, 'I understand'),
      ));
    }
    if (o.k === 'assistant') {
      const ctx = this.journey?.context() ?? { facts: { ...this.bike.facts }, state: [], path: [] };
      const lines = [
        `Bike: ${this.bike.name}`,
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
    const ctx = this.journey?.context() ?? { facts: { ...this.bike.facts }, state: [], path: [] };
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
            path: ctx.path,
            facts: ctx.facts,
            bike: this.bike.name,
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
