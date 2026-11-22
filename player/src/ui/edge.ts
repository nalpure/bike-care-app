// Swipe from the left screen edge to go back, as the back arrow does. The screen follows the
// finger; letting go past a third of the width (or with a quick flick) goes back, else it springs back.
//
// Phone browsers have their own edge swipe: Safari on iOS goes back in its history from the left
// edge, Chrome on Android from either edge (a system gesture the page never sees). The app keeps
// one history entry per level (see App.sentinel), so the browser's back also goes back in the app,
// and `lastEdgeBack` stops the two from counting twice when both fire. Our zone is the first 24 px.
// The flick speed uses the events' own time stamps, so a busy page does not make a flick look slow.

import type { App } from './app.js';

const ZONE = 24;

export function attachEdgeBack(app: App): void {
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let on: 'maybe' | 'drag' | null = null;
  let screen: HTMLElement | null = null;

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settle = (to: number, done?: () => void) => {
    if (!screen) return;
    const el = screen;
    if (reduced()) {
      el.style.transform = '';
      done?.();
      return;
    }
    el.style.transition = 'transform .16s ease-out';
    el.style.transform = to ? `translateX(${to}px)` : '';
    window.setTimeout(() => {
      el.style.transition = '';
      if (done) el.style.transform = '';
      done?.();
    }, 170);
  };

  document.addEventListener('touchstart', (e) => {
    on = null;
    const t = e.touches[0];
    if (e.touches.length !== 1 || t.clientX > ZONE || !app.backTarget()) return;
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = e.timeStamp;
    screen = app.root.querySelector<HTMLElement>(':scope > .screen');
    on = 'maybe';
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!on || !screen) return;
    const t = e.touches[0];
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (on === 'maybe') {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        on = null;
        return;
      }
      if (dx < 8) return;
      on = 'drag';
      screen.style.transition = 'none';
      screen.style.willChange = 'transform';
    }
    e.preventDefault();
    screen.style.transform = `translateX(${Math.max(0, dx)}px)`;
  }, { passive: false });

  const end = (e: TouchEvent) => {
    if (on !== 'drag' || !screen) {
      on = null;
      return;
    }
    on = null;
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0;
    const fast = dx / Math.max(1, e.timeStamp - t0) > 0.5;
    if (dx > window.innerWidth / 3 || (fast && dx > 60)) {
      app.lastEdgeBack = performance.now();
      settle(window.innerWidth, () => {
        app.goBack(true);
      });
    } else settle(0);
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', () => {
    if (on === 'drag') settle(0);
    on = null;
  });
}
