// The assistant button: one floating button on every screen. The user can drag it; it sticks to
// the nearest side edge, and the place is kept in the settings. It moves out of the way (without
// being saved) when it would cover the buttons that move a flow on: Next, Back and the answers.

import type { App } from './app.js';
import { h, icon, ICON } from './dom.js';

const SIZE = 52;
const EDGE = 10;
const PAD = 8;
/** Elements the button must not cover. */
const PROTECTED = '.pager, .cta, .q, .qopts, .verdict .actions, .tabbar, .helpbtn, .wh .ib, .gtop button, .tabs2, .stage3d .fabs';
/** Text it should not cover if there is room elsewhere. */
const TEXT = '.step h2, .step p, .step .kicker, .step .needs, .step .verdict, .step .standing';

function bounds(): { min: number; max: number } {
  const tab = document.querySelector<HTMLElement>('.tabbar');
  const max = (tab ? tab.getBoundingClientRect().top : window.innerHeight) - SIZE - PAD;
  return { min: PAD, max: Math.max(PAD, max) };
}

function overlaps(top: number, side: 'left' | 'right', withText = false): boolean {
  const left = side === 'left' ? EDGE : window.innerWidth - EDGE - SIZE;
  for (const el of document.querySelectorAll<HTMLElement>(withText ? `${PROTECTED}, ${TEXT}` : PROTECTED)) {
    if (el.closest('.modal')) continue;
    for (const r of el.matches('.qopts, .q') ? [...el.querySelectorAll<HTMLElement>('.opt')].map((x) => x.getBoundingClientRect()) : [el.getBoundingClientRect()]) {
      if (!r.width || !r.height) continue;
      if (left < r.right + PAD && left + SIZE > r.left - PAD && top < r.bottom + PAD && top + SIZE > r.top - PAD) return true;
    }
  }
  return false;
}

/** Puts the button at the user's place, or the nearest free height when that would cover a button. */
export function placeAssistant(app: App): void {
  const btn = document.querySelector<HTMLElement>('.assist');
  if (!btn || btn.classList.contains('dragging')) return;
  const pos = app.store.data.assistant ?? { side: 'right' as const, y: 1 };
  const { min, max } = bounds();
  const want = Math.min(max, Math.max(min, pos.y * window.innerHeight));
  // Nearest free height: first on the user's side clear of buttons and text, then on the other
  // side, then on the user's side clear of buttons only; else where the user put it.
  const other = pos.side === 'left' ? 'right' : 'left';
  const find = (side: 'left' | 'right', text: boolean): number | undefined => {
    if (!overlaps(want, side, text)) return want;
    for (let d = 8; d <= window.innerHeight; d += 8) {
      const free = [want - d, want + d].find((t) => t >= min && t <= max && !overlaps(t, side, text));
      if (free !== undefined) return free;
    }
    return undefined;
  };
  let side = pos.side;
  let top = find(pos.side, true);
  if (top === undefined) {
    top = find(other, true);
    if (top !== undefined) side = other;
  }
  if (top === undefined) top = find(pos.side, false) ?? want;
  btn.style.top = `${Math.round(top)}px`;
  btn.style.left = side === 'left' ? `${EDGE}px` : `${window.innerWidth - EDGE - SIZE}px`;
  btn.dataset.side = side;
}

let scheduled = 0;
export function placeSoon(app: App): void {
  cancelAnimationFrame(scheduled);
  scheduled = requestAnimationFrame(() => placeAssistant(app));
}

export function assistantButton(app: App): HTMLElement {
  const btn = h('button.assist', { 'aria-label': 'Ask the assistant (AI)', 'data-test': 'assistant' }, icon(ICON.ai), h('span.ai', 'AI'));
  let down = false;
  let moved = false;
  let dx = 0;
  let dy = 0;
  let x0 = 0;
  let y0 = 0;
  btn.addEventListener('pointerdown', (e) => {
    down = true;
    moved = false;
    const r = btn.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    x0 = e.clientX;
    y0 = e.clientY;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
  });
  btn.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (!moved && Math.hypot(e.clientX - x0, e.clientY - y0) < 8) return;
    moved = true;
    btn.classList.add('dragging');
    const { min, max } = bounds();
    btn.style.left = `${Math.min(window.innerWidth - SIZE, Math.max(0, e.clientX - dx))}px`;
    btn.style.top = `${Math.min(max, Math.max(min, e.clientY - dy))}px`;
  });
  const end = () => {
    if (!down) return;
    down = false;
    if (!moved) return;
    btn.classList.remove('dragging');
    const r = btn.getBoundingClientRect();
    app.store.data.assistant = { side: r.left + SIZE / 2 < window.innerWidth / 2 ? 'left' : 'right', y: r.top / window.innerHeight };
    app.store.save();
    placeAssistant(app);
  };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('click', (e) => {
    if (moved) {
      moved = false;
      e.preventDefault();
      return;
    }
    app.openOverlay({ k: 'assistant' });
  });
  // Keyboard: arrow keys move it up and down, so it can be put out of the way without a pointer.
  btn.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowUp' ? -0.08 : e.key === 'ArrowDown' ? 0.08 : 0;
    const side = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : undefined;
    if (!step && !side) return;
    e.preventDefault();
    const cur = app.store.data.assistant ?? { side: 'right' as const, y: 1 };
    app.store.data.assistant = { side: side ?? cur.side, y: Math.min(1, Math.max(0, cur.y + step)) };
    app.store.save();
    placeAssistant(app);
  });
  return btn;
}
