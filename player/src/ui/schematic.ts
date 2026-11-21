// A 2D side view of a bike frame (inline SVG) that shows what each geometry value measures.
// Values the bike does not have yet are drawn as typical ones, in a lighter line, so the picture
// is always complete. The selected value's line is highlighted and labelled.

const NS = 'http://www.w3.org/2000/svg';

function s(tag: string, attrs: Record<string, string | number> = {}, ...kids: SVGElement[]): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const k of kids) el.append(k);
  return el;
}

/** Typical values used where the bike has none (a medium road bike). */
const TYPICAL: Record<string, number> = {
  stack: 560, reach: 385, head_tube: 150, seat_tube: 540, top_tube: 560, chainstay: 420, wheelbase: 990, bb_drop: 70,
  head_angle: 72.5, seat_angle: 73.5, wheel_bsd: 622,
};

type Pt = [number, number];

export function renderSchematic(facts: Record<string, unknown>, selected: string | null, label: (key: string) => string): SVGElement {
  const val = (n: string): number => {
    const v = Number(facts[`geometry.${n}_${n.endsWith('angle') ? 'deg' : 'mm'}`]);
    return Number.isFinite(v) && facts[`geometry.${n}_${n.endsWith('angle') ? 'deg' : 'mm'}`] !== undefined ? v : TYPICAL[n];
  };
  const known = (n: string) => facts[`geometry.${n}_${n.endsWith('angle') ? 'deg' : 'mm'}`] !== undefined;
  const rad = (d: number) => (d * Math.PI) / 180;

  const cs = val('chainstay');
  const drop = val('bb_drop');
  const wb = val('wheelbase');
  const reach = val('reach');
  const stack = val('stack');
  const ht = val('head_tube');
  const ha = rad(val('head_angle'));
  const sa = rad(val('seat_angle'));
  const st = val('seat_tube');
  const R = val('wheel_bsd') / 2 + 32;

  // Millimetres with y up and the bottom bracket at the origin; flipped when drawn.
  const rear: Pt = [-Math.sqrt(Math.max(cs * cs - drop * drop, 1)), drop];
  const front: Pt = [rear[0] + wb, drop];
  const headTop: Pt = [reach, stack];
  const headBot: Pt = [reach + ht * Math.cos(ha), stack - ht * Math.sin(ha)];
  const seatTop: Pt = [-st * Math.cos(sa), st * Math.sin(sa)];
  const P = (p: Pt) => `${p[0].toFixed(1)},${(-p[1]).toFixed(1)}`;
  const line = (a: Pt, b: Pt, attrs: Record<string, string | number> = {}) => s('line', { x1: a[0], y1: -a[1], x2: b[0], y2: -b[1], ...attrs });

  const minX = rear[0] - R - 30;
  const maxX = front[0] + R + 30;
  const top = Math.max(stack, seatTop[1]) + 90;
  const bottom = -(drop - R) + 150;
  const svg = s('svg', {
    viewBox: `${minX} ${-top} ${maxX - minX} ${top + bottom}`, class: 'schematic', role: 'img',
    'aria-label': selected ? `Frame drawing, ${label(selected)} highlighted` : 'Frame drawing',
  });

  const frame = s('g', { class: 'sc-frame', fill: 'none' });
  for (const c of [rear, front]) frame.append(s('circle', { cx: c[0], cy: -c[1], r: R, class: 'sc-wheel' }));
  frame.append(
    line([0, 0], seatTop), line([0, 0], headBot), line(seatTop, headTop), line(headTop, headBot),
    line([0, 0], rear), line(seatTop, rear), line(headBot, front),
  );
  svg.append(frame);

  // Lines that measure something, each with the fact key it stands for.
  const mark = (key: string, parts: SVGElement[], text: string, at: Pt, dx = 0, dy = 0) => {
    const on = selected === key;
    const g = s('g', { class: `sc-m${on ? ' on' : ''}${known(key.replace(/^geometry\./, '').replace(/_(mm|deg)$/, '')) ? '' : ' typical'}`, 'data-key': key });
    for (const p of parts) g.append(p);
    if (on) {
      const t = s('text', { x: at[0] + dx, y: -at[1] + dy, class: 'sc-t', 'text-anchor': 'middle' });
      t.textContent = text;
      g.append(t);
    }
    svg.append(g);
  };
  const arc = (c: Pt, from: number, to: number, r: number) => {
    const a = (t: number): Pt => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
    const p = a(from);
    const q = a(to);
    const large = Math.abs(to - from) > Math.PI ? 1 : 0;
    return s('path', { d: `M${P(p)} A${r},${r} 0 ${large} ${to > from ? 0 : 1} ${P(q)}`, fill: 'none' });
  };
  const fmt = (key: string, unit: string) => {
    const v = facts[key];
    return v === undefined ? 'not known' : `${v}${unit}`;
  };
  const mm = (key: string) => fmt(key, ' mm');

  mark('geometry.stack_mm', [line([0, 0], [0, stack])], mm('geometry.stack_mm'), [0, stack / 2], -90, 0);
  mark('geometry.reach_mm', [line([0, stack], [reach, stack])], mm('geometry.reach_mm'), [reach / 2, stack], 0, -30);
  mark('geometry.top_tube_mm', [line([-stack / Math.tan(sa), stack + 28], [reach, stack + 28])], mm('geometry.top_tube_mm'), [reach / 2 - stack / Math.tan(sa) / 2, stack + 28], 0, -30);
  mark('geometry.head_tube_mm', [line(headTop, headBot, { 'stroke-width': 9 })], mm('geometry.head_tube_mm'), headBot, 190, 50);
  mark('geometry.seat_tube_mm', [line([0, 0], seatTop, { 'stroke-width': 9 })], mm('geometry.seat_tube_mm'), [seatTop[0] / 2, seatTop[1] / 2], -110, 0);
  mark('geometry.chainstay_mm', [line([0, 0], rear, { 'stroke-width': 9 })], mm('geometry.chainstay_mm'), [rear[0] / 2, rear[1] / 2], 0, 90);
  mark('geometry.wheelbase_mm', [line([rear[0], -R + drop - 30], [front[0], -R + drop - 30]), line([rear[0], drop], [rear[0], -R + drop - 40], { 'stroke-dasharray': '6 6' }), line([front[0], drop], [front[0], -R + drop - 40], { 'stroke-dasharray': '6 6' })],
    mm('geometry.wheelbase_mm'), [0, -R + drop - 30], 0, -30);
  mark('geometry.bb_drop_mm', [line([-40, drop], [40, drop], { 'stroke-dasharray': '6 6' }), line([30, drop], [30, 0])], mm('geometry.bb_drop_mm'), [30, drop / 2], 100, 10);
  mark('geometry.head_angle_deg', [line(headBot, [headBot[0] + 140, headBot[1]], { 'stroke-dasharray': '6 6' }), arc(headBot, 0, Math.PI - ha, 90)],
    fmt('geometry.head_angle_deg', '°'), headBot, 110, 40);
  mark('geometry.seat_angle_deg', [line([0, 0], [-160, 0], { 'stroke-dasharray': '6 6' }), arc([0, 0], Math.PI, Math.PI - sa, 100)],
    fmt('geometry.seat_angle_deg', '°'), [-120, 0], -40, 100);
  mark('geometry.wheel_bsd_mm', [s('circle', { cx: front[0], cy: -front[1], r: R - 14, fill: 'none' })],
    fmt('geometry.wheel_bsd_mm', ' mm'), front, 0, -R - 40);
  return svg;
}
