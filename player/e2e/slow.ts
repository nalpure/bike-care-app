// Slow walk for looking at the 3D stage: serves dist/ from a plain static server (no fallback, a
// subpath, as on any file host), walks the rear-shifting tutorial for a few bikes and takes a
// screenshot of every card once the camera has settled (the framing stops changing). Use it after changing the 3D bike.
//
//   npm run build && npm run shots          portrait 390x844 and short landscape 667x375
//   npm run shots -- --only road            only bikes whose id contains "road"
//   npm run shots -- --card high,low        only cards whose id contains one of the words (faster)
//   npm run shots -- --at 1.2,3.2           also one picture per card with the step's clip held at each time (s),
//                                           NN-<card id>-at<time>.png (stage.holdClip)
//
// Screenshots: scratch/shots/slow/<bike>-<width>x<height>/NN-<card id>.png (npm run test:e2e writes
// to scratch/shots/e2e/, so neither wipes the other). Page errors are printed.
// For every card it also prints the framing: how far the card's subject (focus parts, plus show
// parts on a card with show) sits from the left, right, top and bottom edge of the 3D view (% of
// its width or height; negative is cut off), and with --card the subject and all parts drawn. Check framing with these numbers first; look at a picture only to confirm.
// "marked" is the same for the marked parts alone: the numbers to read on a close-up.
//
// Which paths: each entry of BIKES below is a demo bike of the garage (or an unknown bike, answering the
// bike questions from `answers`), with facts set on it first and a way of holding it. On a card it taps the
// answer `tutorial` names (else Next, else the first answer that lets it go on); on a card in `solve` it
// also taps that problem answer and takes a picture of its solution once the camera has settled,
// NN-<card id>-<answer>.png.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const REPO = resolve(import.meta.dirname, '../..');
const OUT = join(REPO, 'scratch/shots/slow');
const PORT = 4189;
const SUB = '/sub/';
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain' };

interface ShotBike {
  id: string;
  /** a demo bike of the garage, or 'unknown' (an unknown bike that answers the questions) */
  garage: string;
  /** facts set on the garage bike before the tutorial starts */
  facts: Record<string, unknown>;
  /** the way of holding the bike (choice hold_bike) */
  hold: string;
  /** answers to bike questions: fact key -> answer value (else the first one) */
  answers?: Record<string, string>;
  /** card id -> the answer to tap on it */
  tutorial?: Record<string, string>;
  /** card id -> a problem answer whose solution gets a picture as well */
  solve?: Record<string, string>;
}

/** Bikes to draw. The demo bikes keep their own facts (road-bike-stand has a drop bar, city-derailleur-no-stand a flat bar). */
const BIKES: ShotBike[] = [
  {
    id: 'road-stand', garage: 'road-bike-stand', facts: { 'bike.category': 'road_gravel', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 11 }, hold: 'stand',
    tutorial: { 'barrel-adjuster-present': 'at-derailleur' }, solve: { 'check-cable-tension': 'slow-easier' },
  },
  {
    id: 'road-inline', garage: 'road-bike-stand', facts: { 'bike.category': 'road_gravel', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 11 }, hold: 'stand',
    tutorial: { 'barrel-adjuster-present': 'cant-find', 'barrel-adjuster-search': 'on-cable' }, solve: { 'check-cable-tension': 'slow-easier' },
  },
  { id: 'mtb12-stand', garage: 'road-bike-stand', facts: { 'bike.category': 'mtb', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 12 }, hold: 'stand' },
  {
    id: 'city-upside-down', garage: 'city-derailleur-no-stand', facts: { 'bike.category': 'city', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 8 }, hold: 'upside_down',
    tutorial: { 'barrel-adjuster-present': 'at-shifter' }, solve: { 'check-cable-tension': 'slow-harder' },
  },
  {
    id: 'unknown-ground', garage: 'unknown', facts: {}, hold: 'ground',
    answers: { 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical' },
    tutorial: { 'barrel-adjuster-present': 'cant-find', 'barrel-adjuster-search': 'on-cable' }, solve: { 'check-cable-tension-riding': 'slow-easier' },
  },
];
const SIZES = [{ width: 390, height: 844 }, { width: 667, height: 375 }];

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] ?? '' : '');
const only = arg('--only');
const cards = arg('--card').split(',').filter(Boolean);
const wantCard = (id: string) => !cards.length || cards.some((w) => id.includes(w));
const atTimes = arg('--at').split(',').filter(Boolean).map(Number).filter((x) => Number.isFinite(x));

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  if (!p.startsWith(SUB)) return void res.writeHead(404).end();
  p = p.slice(SUB.length - 1);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(join(REPO, 'dist', p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT);

rmSync(OUT, { recursive: true, force: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const bike of BIKES.filter((b) => b.id.includes(only))) {
    for (const vp of SIZES) {
      const dir = join(OUT, `${bike.id}-${vp.width}x${vp.height}`);
      mkdirSync(dir, { recursive: true });
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      page.on('pageerror', (e) => console.log(`ERROR ${bike.id} ${vp.width}x${vp.height}: ${e}`));
      await page.goto(`http://localhost:${PORT}${SUB}`);
      await page.click('[data-test="notice-ok"]');
      if (bike.garage !== 'unknown') {
        await page.evaluate(({ id, facts }) => {
          const app = (window as any).__app;
          Object.assign(app.store.bike(id).facts, facts);
          app.store.save();
        }, { id: bike.garage, facts: bike.facts });
      }
      // the guides sit in a collapsed list on the repair menu
      await page.locator('details.guides summary').click();
      await page.click('[data-test="tutorial-adjust-rear-shifting"]');
      if (bike.garage === 'unknown') {
        await page.click('[data-test="pick-unknown"]');
        await page.click('[data-test="unknown-questions"]');
      } else await page.click(`[data-test="pick-${bike.garage}"]`);
      let n = 0;
      const shot = (name: string) => page.screenshot({ path: join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
      const view = async () => (await page.locator('#root').getAttribute('data-view')) ?? '';
      // A tap on "next" slides the card out first (170 ms) and only then renders the next one, so
      // wait for #root[data-view] to change; false if it stays (an answer that keeps the card).
      const left = (v: string) => page.waitForFunction((old) => document.getElementById('root')?.dataset.view !== old, v, { timeout: 1000 }).then(() => true, () => false);
      const pct = (x: number) => (x < -0.99 ? '<-99' : `${Math.round(x * 100)}`.padStart(4));
      const box = (b: any) => `left${pct(b.left)}  right${pct(b.right)}  top${pct(b.top)}  bottom${pct(b.bottom)}${b.behind ? `  ${b.behind} corners behind the camera` : ''}`;
      // Software WebGL draws few pictures a second and the stage caps its time step, so the
      // camera move can take longer than it would on a phone: wait until the framing stops changing.
      const framing = () => page.evaluate(() => (window as any).__app.stage.framing?.() ?? null);
      const settle = async (id: string) => {
        await page.waitForTimeout(1500);
        let f = await framing();
        const t0 = Date.now();
        for (;;) {
          await page.waitForTimeout(500);
          const g = await framing();
          const same = JSON.stringify(f && [f.left, f.right, f.top, f.bottom].map((x: number) => x.toFixed(3))) === JSON.stringify(g && [g.left, g.right, g.top, g.bottom].map((x: number) => x.toFixed(3)));
          f = g;
          if (same) break;
          if (Date.now() - t0 > 15000) {
            console.log(`  (still moving after 15 s, a clip or the camera: ${id})`);
            break;
          }
        }
        return f;
      };
      const report = (id: string, f: any) => {
        const where = f && !f.subject.length ? `no focus parts  ${f.parts.length} parts drawn` : f ? `${box(f)}  ${f.parts.length} parts drawn` : 'no 3D view';
        console.log(`  ${String(n).padStart(2, '0')} ${id.padEnd(32)} ${where}`);
        if (f?.marked) for (const [part, b] of Object.entries<any>(f.marked.each ?? {})) console.log(`     marked ${part.padEnd(22)} ${box(b)}`);
        if (f && cards.length) console.log(`     subject: ${f.subject.join(' ')}\n     drawn:   ${f.parts.join(' ')}`);
      };
      for (let guard = 0; guard < 80; guard++) {
        const v = await view();
        const [, kind, id] = v.split(':');
        if (kind !== 'card') {
          if (['exit', 'done', 'shop', 'todo', 'not-covered'].includes(kind)) {
            n++;
            if (!cards.length) {
              await page.waitForTimeout(2500);
              await shot(kind);
            }
            break;
          }
          // pre-steps: the chosen way of holding the bike, the answer to a bike question, else the first
          // answer or the main button
          const hold = page.locator(`[data-test="choice-${bike.hold}"]`);
          const ans = kind === 'question' && bike.answers?.[id] ? page.locator(`[data-test="answer-${bike.answers[id]}"]`)
            : kind === 'keep' ? page.locator('[data-test="keep-skip"]') : null;
          await (await hold.count() ? hold : ans ?? page.locator('.qopts .opt, [data-test="start"], .cta .btn.primary').first()).click();
          await left(v);
          continue;
        }
        n++;
        if (wantCard(id)) {
          const f = await settle(id);
          await shot(id);
          for (const at of atTimes) {
            // the parts jump to the held moment; colours and outlines ease in over a few pictures
            await page.evaluate((t) => (window as any).__app.stage.holdClip?.(t), at);
            await page.waitForTimeout(2000);
            await shot(`${id}-at${at}`);
          }
          if (atTimes.length) await page.evaluate(() => (window as any).__app.stage.holdClip?.(null));
          report(id, f);
          const sol = bike.solve?.[id];
          if (sol) {
            // the problem answer plays its solution at once (its own view and clip); the card stays
            await page.click(`[data-test="btn-${sol}"]`);
            const g = await settle(`${id} ${sol}`);
            await shot(`${id}-${sol}`);
            report(`${id} -> ${sol}`, g);
          }
        }
        const want = bike.tutorial?.[id];
        if (want) {
          await page.click(`[data-test="btn-${want}"]`);
          if (await left(v)) continue;
        }
        const next = page.locator('[data-test="next"]');
        const canGo = async () => (await next.count()) > 0 && !(await next.isDisabled({ timeout: 1000 }));
        if (!(await canGo())) {
          // tap the first answer that lets the user go on
          const ids: string[] = await page.evaluate(() => (window as any).__app.journey.screen().card?.buttons.map((b: any) => b.id) ?? []);
          for (const b of ids) {
            await page.click(`[data-test="btn-${b}"]`);
            if (await left(v)) break;
            if (await canGo()) break;
            if (await page.locator('[data-test="again"]').count()) await page.click('[data-test="again"]');
          }
        }
        if ((await view()) !== v) continue;
        if (await canGo()) {
          await next.click();
          if (!(await left(v))) {
            console.log(`stuck on ${v}`);
            break;
          }
        } else {
          console.log(`stuck on ${v}`);
          break;
        }
      }
      console.log(`${bike.id} ${vp.width}x${vp.height}: ${n} screens`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`Screenshots in ${OUT}`);
