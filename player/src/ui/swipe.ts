// Swipe a row to the left to reveal an action behind it (the garage's delete button).
// Pointer events, so it works with a finger and with a mouse; vertical drags still scroll.

import { h } from './dom.js';

const OPEN = 96;

/** Wraps front in a row that slides left on a horizontal drag and shows action behind it. */
export function swipeRow(front: HTMLElement, action: HTMLElement, test?: string): HTMLElement {
  const row = h('div.swipe', { 'data-test': test }, h('div.behind', action), front);
  front.classList.add('front');
  front.style.touchAction = 'pan-y';
  let x0 = 0;
  let y0 = 0;
  let base = 0;
  let dx = 0;
  let dragging = false;
  let down = false;
  let moved = false;
  const place = (x: number, animate: boolean) => {
    front.style.transition = animate ? 'transform .18s ease' : 'none';
    front.style.transform = x ? `translateX(${x}px)` : '';
  };
  const open = (on: boolean) => {
    base = on ? -OPEN : 0;
    row.classList.toggle('open', on);
    action.tabIndex = on ? 0 : -1;
    place(base, true);
  };
  action.tabIndex = -1;
  front.addEventListener('pointerdown', (e) => {
    down = true;
    dragging = false;
    moved = false;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
  });
  front.addEventListener('pointermove', (e) => {
    if (!down) return;
    const mx = e.clientX - x0;
    const my = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
        down = false;
        return;
      }
      if (Math.abs(mx) < 8) return;
      dragging = true;
      moved = true;
      row.classList.add('dragging');
      try {
        front.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
    }
    dx = mx;
    place(Math.max(-OPEN - 24, Math.min(0, base + dx)), false);
  });
  const end = () => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    dragging = false;
    row.classList.remove('dragging');
    open(base + dx < -OPEN / 2);
  };
  front.addEventListener('pointerup', end);
  front.addEventListener('pointercancel', end);
  // A drag is not a tap; a tap on an open row closes it.
  front.addEventListener('click', (e) => {
    if (moved) {
      e.preventDefault();
      e.stopImmediatePropagation();
      moved = false;
    } else if (row.classList.contains('open')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      open(false);
    }
  }, true);
  return row;
}
