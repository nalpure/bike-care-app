// Slow walk for looking at the 3D stage: serves dist/ from a plain static server (no fallback, a
// subpath, as on any file host), walks the rear-shifting tutorial for a few bikes and takes a
// screenshot of every card after the camera has settled (2.5 s). Use it after changing the 3D bike.
//
//   npm run build && npm run shots          portrait 390x844 and short landscape 667x375
//   npm run shots -- --only road            only bikes whose id contains "road"
//
// Screenshots: player/e2e/shots/slow/<bike>-<width>x<height>/. Page errors are printed.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { constants, setPriority } from 'node:os';
import { chromium } from 'playwright';

const REPO = resolve(import.meta.dirname, '../..');
// Software 3D keeps the machine busy: below-normal priority (Chromium inherits it), so other work comes first.
try {
  setPriority(constants.priority.PRIORITY_BELOW_NORMAL);
} catch { /* not allowed here: run at normal priority */ }
const OUT = join(REPO, 'player/e2e/shots/slow');
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

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : '';

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
      const shot = (name: string) => page.screenshot({ path: join(dir, `${String(++n).padStart(2, '0')}-${name}.png`) });
      for (let guard = 0; guard < 80; guard++) {
        const v = (await page.locator('#root').getAttribute('data-view')) ?? '';
        const [, kind, id] = v.split(':');
        if (kind !== 'card') {
          if (['exit', 'done', 'shop', 'todo', 'not-covered'].includes(kind)) {
            await page.waitForTimeout(2500);
            await shot(kind);
            break;
          }
          // pre-steps: the chosen way of holding the bike, else the first answer or the main button
          const hold = page.locator(`[data-test="choice-${bike.hold}"]`);
          await (await hold.count() ? hold : page.locator('.qopts .opt, [data-test="start"], .cta .btn.primary').first()).click();
          continue;
        }
        await page.waitForTimeout(2500);
        await shot(id);
        const next = page.locator('[data-test="next"]');
        const canGo = async () => (await next.count()) > 0 && !(await next.isDisabled({ timeout: 1000 }));
        if (!(await canGo())) {
          // tap the first answer that lets the user go on
          const ids: string[] = await page.evaluate(() => (window as any).__app.journey.screen().card?.buttons.map((b: any) => b.id) ?? []);
          for (const b of ids) {
            await page.click(`[data-test="btn-${b}"]`);
            if (((await page.locator('#root').getAttribute('data-view')) ?? '') !== v) break;
            if (await canGo()) break;
            if (await page.locator('[data-test="again"]').count()) await page.click('[data-test="again"]');
          }
        }
        if (await canGo()) await next.click();
        else if (((await page.locator('#root').getAttribute('data-view')) ?? '') === v) {
          console.log(`stuck on ${v}`);
          break;
        }
      }
      console.log(`${bike.id} ${vp.width}x${vp.height}: ${n} screenshots`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`Screenshots in ${OUT}`);
