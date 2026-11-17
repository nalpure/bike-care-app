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

export const ICON = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12|M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  repair: 'M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.1-.6-.6-2.1z',
  garage: 'M6 16m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M18 16m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0|M6 16l4-8h5l3 8M10 8l3 8M9 6h3',
  shop: 'M5 8h14l-1 11H6z|M9 8V6a3 3 0 0 1 6 0v2',
  notes: 'M6 3h9l4 4v14H6z|M14 3v5h5|M9 13h7M9 17h5',
  ask: 'M4 5h16v11H9l-5 4z|M9 10h.01M12 10h.01M15 10h.01',
};
