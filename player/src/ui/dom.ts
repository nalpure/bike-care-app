// Tiny DOM helper: h('button.btn.primary', { onclick }, 'Next'). Text is always set as text, never as HTML.

type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, any>;

export function h(spec: string, attrs?: Attrs | Child, ...children: Child[]): HTMLElement {
  if (attrs !== undefined && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs as Child);
    attrs = undefined;
  }
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries((attrs as Attrs) ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
    else if (k === 'style') el.setAttribute('style', v);
    else if (k === 'value') (el as HTMLInputElement).value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : String(c));
  }
}

/** An inline SVG icon from path data. */
export function icon(paths: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths.split('|')) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

/** Icons of the fact groups, by the icon id the bundle gives each group. */
export const GROUP_ICON: Record<string, string> = {
  bike: 'M5.5 16m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M18.5 16m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M5.5 16L9.2 9.5H15.6L11.5 16Z|M11.5 16L8.7 7.5|M7.2 7.5h3|M18.5 16L15.4 7.2h2.3',
  drivetrain: 'M8 12m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0|M18 15m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0|M8 7.5L18 12.5|M8 16.5L18 17.5',
  geometry: 'M4 20V4|M4 20h16|M4 20L17 7|M9 20a5 5 0 0 0-1.6-3.7',
};

export const ICON = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12|M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  repair: 'M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.1-.6-.6-2.1z',
  // a bike from the side: two wheels, a diamond frame, saddle, fork and handlebar
  garage: 'M5.5 16m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M18.5 16m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M5.5 16L9.2 9.5H15.6L11.5 16Z|M11.5 16L8.7 7.5|M7.2 7.5h3|M18.5 16L15.4 7.2h2.3',
  trash: 'M4 7h16|M9 7V4.5h6V7|M6.5 7l1 13h9l1-13|M10 11v5.5M14 11v5.5',
  shop: 'M5 8h14l-1 11H6z|M9 8V6a3 3 0 0 1 6 0v2',
  notes: 'M6 3h9l4 4v14H6z|M14 3v5h5|M9 13h7M9 17h5',
  ask: 'M4 5h16v11H9l-5 4z|M9 10h.01M12 10h.01M15 10h.01',
  // two sparkles: the usual sign of an AI helper
  ai: 'M10 3.5l1.9 5.6 5.6 1.9-5.6 1.9L10 18.5l-1.9-5.6L2.5 11l5.6-1.9z|M18.5 3l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z|M18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
};
