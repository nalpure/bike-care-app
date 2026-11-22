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

/** Bikes to draw: a demo bike of the garage, the facts set on it before the tutorial starts, and how it is held. */
const BIKES: Array<{ id: string; garage: string; facts: Record<string, unknown>; hold: string }> = [
  { id: 'road-stand', garage: 'road-bike-stand', facts: { 'bike.category': 'road_gravel', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 11 }, hold: 'stand' },
  { id: 'mtb12-stand', garage: 'road-bike-stand', facts: { 'bike.category': 'mtb', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 12 }, hold: 'stand' },
  { id: 'city-upside-down', garage: 'city-derailleur-no-stand', facts: { 'bike.category': 'city', 'bike.ebike': false, 'drive.gear_type': 'derailleur', 'drive.shifting': 'mechanical', 'drive.rear_speeds': 8 }, hold: 'upside_down' },
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
      await page.evaluate(({ id, facts }) => {
        const app = (window as any).__app;
        Object.assign(app.store.bike(id).facts, facts);
        app.store.save();
      }, { id: bike.garage, facts: bike.facts });
      // the guides sit in a collapsed list on the repair menu
      await page.locator('details.guides summary').click();
      await page.click('[data-test="tutorial-adjust-rear-shifting"]');
      await page.click(`[data-test="pick-${bike.garage}"]`);
      let n = 0;
      const shot = (name: string) => page.screenshot({ path: join(dir, `${String(n).padStart(2, '0')}-${name}.png`) });
      const view = async () => (await page.locator('#root').getAttribute('data-view')) ?? '';
      // A tap on "next" slides the card out first (170 ms) and only then renders the next one, so
      // wait for #root[data-view] to change; false if it stays (an answer that keeps the card).
      const left = (v: string) => page.waitForFunction((old) => document.getElementById('root')?.dataset.view !== old, v, { timeout: 1000 }).then(() => true, () => false);
      const pct = (x: number) => (x < -0.99 ? '<-99' : `${Math.round(x * 100)}`.padStart(4));
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
          // pre-steps: the chosen way of holding the bike, else the first answer or the main button
          const hold = page.locator(`[data-test="choice-${bike.hold}"]`);
          await (await hold.count() ? hold : page.locator('.qopts .opt, [data-test="start"], .cta .btn.primary').first()).click();
          await left(v);
          continue;
        }
        n++;
        if (wantCard(id)) {
          // Software WebGL draws few pictures a second and the stage caps its time step, so the
          // camera move can take longer than it would on a phone: wait until the framing stops changing.
          const framing = () => page.evaluate(() => (window as any).__app.stage.framing?.() ?? null);
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
          await shot(id);
          for (const at of atTimes) {
            // the parts jump to the held moment; colours and outlines ease in over a few pictures
            await page.evaluate((t) => (window as any).__app.stage.holdClip?.(t), at);
            await page.waitForTimeout(2000);
            await shot(`${id}-at${at}`);
          }
          if (atTimes.length) await page.evaluate(() => (window as any).__app.stage.holdClip?.(null));
          const where = f && !f.subject.length ? `no focus parts  ${f.parts.length} parts drawn` : f ? `left${pct(f.left)}  right${pct(f.right)}  top${pct(f.top)}  bottom${pct(f.bottom)}${f.behind ? `  ${f.behind} corners behind the camera` : ''}  ${f.parts.length} parts drawn` : 'no 3D view';
          console.log(`  ${String(n).padStart(2, '0')} ${id.padEnd(32)} ${where}`);
          if (f && cards.length) console.log(`     subject: ${f.subject.join(' ')}\n     drawn:   ${f.parts.join(' ')}`);
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
