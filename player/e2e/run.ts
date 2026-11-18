// Browser walk: builds the player, serves dist/ and clicks through every profile journey on a
// phone-sized screen, the way the profile's owner would. Saves a screenshot of every screen to
// player/e2e/shots/ and checks that each journey ends where build/report.md says it ends.
//
//   npm run test:e2e                  all journeys, portrait, plus landscape screenshots
//   npm run test:e2e -- --no-build    reuse dist/

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import YAML from 'yaml';

const REPO = resolve(import.meta.dirname, '../..');
const SHOTS = join(REPO, 'player/e2e/shots');
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;

interface Result { id: string; ending: string; expected: string; error?: string }

function expectedEndings(): Map<string, string> {
  const md = readFileSync(join(REPO, 'build/report.md'), 'utf8');
  const sec = md.slice(md.indexOf('## Profiles'));
  const out = new Map<string, string>();
  for (const line of sec.split('\n')) {
    const m = /^\| \[([^\]]+)\]\([^)]*\) \| (.+?) \| (.+?) \| \d+ min \|/.exec(line);
    if (m) out.set(`${m[1]}|${m[2]}`, m[3]);
  }
  return out;
}

async function view(page: Page): Promise<string> {
  return (await page.locator('#root').getAttribute('data-view')) ?? '';
}

async function click(page: Page, test: string): Promise<void> {
  await page.locator(`[data-test="${test}"]`).first().click();
}

async function setUpBike(page: Page, p: any): Promise<void> {
  await page.locator('.tabbar button', { hasText: 'Garage' }).click();
  await page.fill('[data-test="new-bike-name"]', p.name.slice(0, 32));
  await click(page, 'add-bike');
  for (const [k, v] of Object.entries<any>(p.facts ?? {})) {
    const chip = page.locator(`[data-test="fact-${k}-${v}"]`);
    if (await chip.count()) await chip.click();
    else {
      await page.fill(`[data-test="fact-${k}"]`, String(v));
      await page.locator(`[data-test="fact-${k}"]`).press('Enter');
      await page.locator(`[data-test="fact-${k}"]`).blur();
    }
  }
  await page.locator('.tabbar button', { hasText: 'Repair' }).click();
}

async function walk(page: Page, p: any, j: any, shotDir: string): Promise<{ ending: string; error?: string }> {
  let n = 0;
  const shot = async (name: string) => page.screenshot({ path: join(shotDir, `${String(++n).padStart(2, '0')}-${name.replace(/[^a-z0-9-]+/gi, '_')}.png`) });
  if (j.start.diagnosis) await click(page, `diagnosis-${j.start.diagnosis}`);
  else if (j.start.tutorial) await click(page, `tutorial-${j.start.tutorial}`);
  else await click(page, 'routine');
  let lastCard = '';
  let jumped = false;
  let fromJob = '';
  let inTutorial = !!j.start.tutorial;
  for (let guard = 0; guard < 200; guard++) {
    const v = await view(page);
    const [, kind, id] = v.split(':');
    await shot(`${kind}${id ? `-${id}` : ''}`);
    if (kind === 'question') {
      const ans = p.answers?.[id];
      if (ans === undefined) return { ending: 'incomplete profile', error: `question ${id}` };
      await click(page, `answer-${ans}`);
    } else if (kind === 'position') {
      await click(page, `pos-${j.params?.pos}`);
    } else if (kind === 'choice') {
      inTutorial = true;
      const opt = Object.values<any>(j.choices ?? {})[0];
      await click(page, `choice-${opt}`);
    } else if (kind === 'tools') {
      for (const el of await page.locator('[data-test^="tool-"]').all()) {
        const tool = (await el.getAttribute('data-test'))!.slice(5);
        const on = (await el.getAttribute('aria-checked')) === 'true';
        if (on !== (p.tools ?? []).includes(tool)) await el.click();
      }
      await shot('tools-ticked');
      await click(page, 'start');
    } else if (kind === 'card') {
      lastCard = id;
      const flow = await page.locator('article.step').getAttribute('data-flow');
      const sees = flow === 'tutorial' ? j.tutorial_sees ?? {} : j.sees ?? {};
      const want = sees[id];
      const hasVerdict = (await page.locator('[data-test="verdict"]').count()) > 0;
      if (!hasVerdict && want !== undefined) {
        await click(page, `btn-${want}`);
        await shot(`card-${id}-tapped`);
        if (!(await view(page)).startsWith('journey:card')) continue;
      }
      const next = page.locator('[data-test="next"]');
      if (await next.isDisabled()) {
        // A block: after the fix the owner taps a good state.
        const ids = await page.locator('article.step').evaluate(() => (window as any).__app.journey.screen().card.buttons.map((b: any) => b.id));
        let ok = false;
        for (const b of ids) {
          if (await page.locator('[data-test="again"]').count()) await click(page, 'again');
          await click(page, `btn-${b}`);
          if (await next.isEnabled() && (await view(page)).startsWith('journey:card')) {
            ok = true;
            break;
          }
        }
        if (!ok) return { ending: 'incomplete profile', error: `blocked at ${id}` };
        await shot(`card-${id}-fixed`);
      }
      if ((await view(page)).startsWith('journey:card')) await next.click();
    } else if (kind === 'exit') {
      const canJump = (await page.locator('[data-test="show-how"]').count()) > 0;
      if (canJump && j.after_stop === 'show_how') {
        jumped = true;
        await click(page, 'show-how');
        continue;
      }
      const exitKind = await page.locator('h1.h2q').textContent();
      const kindId = ({ 'Do not ride': 'unsafe', 'Not supported yet': 'not_covered', 'Not needed': 'not_needed', 'A shop has to do this': 'shop_only' } as any)[exitKind ?? ''];
      if (canJump) return { ending: `stop at ${lastCard}` };
      return { ending: kindId === 'not_needed' ? `not needed at ${lastCard}` : lastCard ? `exit (${kindId}) at ${lastCard}` : `${kindId} before the first step` };
    } else if (kind === 'not-covered') {
      return { ending: inTutorial ? 'not covered' : `not covered (${j.start.diagnosis})` };
    } else if (kind === 'job') {
      fromJob = (await page.locator('h1.h2q').textContent()) ?? '';
      const diy = (await page.locator('[data-test="diy"]').count()) > 0;
      if (diy && j.job_choice === 'diy') await click(page, 'diy');
      else await click(page, 'shop');
    } else if (kind === 'shop') {
      return { ending: jumped ? 'stop, jump ahead, bike put back, shop' : `shop: ${fromJob}` };
    } else if (kind === 'done') {
      return { ending: 'tutorial complete' };
    } else if (kind === 'todo') {
      const items = await page.locator('[data-test^="todo-"]').count();
      const ending = items ? `${items} to-do item(s)` : 'no to-do items';
      // The to-do item opens its job, and a guide where there is one.
      const guide = page.locator('[data-test="todo-adjust-rear-shifting"]');
      if (await guide.count()) {
        await guide.click();
        await shot('todo-job');
        await click(page, 'diy');
        await shot('todo-tutorial');
        if (!/^journey:(choice|question)/.test(await view(page))) return { ending, error: 'the to-do item did not open its tutorial' };
      }
      return { ending };
    } else {
      return { ending: `unexpected screen ${v}` };
    }
  }
  return { ending: 'too many screens' };
}

/** Feedback note, assistant panel, bike sheet and notes export, on a phone in portrait. */
async function extras(browser: import('playwright').Browser): Promise<Result> {
  const id = 'extras/feedback-assistant-garage';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const dir = join(SHOTS, 'portrait', 'extras');
  mkdirSync(dir, { recursive: true });
  try {
    await page.goto(URL);
    await click(page, 'notice-ok');
    await page.addStyleTag({ content: '.toast { display: none !important; }' });
    await click(page, 'tutorial-adjust-rear-shifting');
    await click(page, 'answer-derailleur');
    await click(page, 'answer-mechanical');
    await click(page, 'choice-stand');
    await click(page, 'start');
    await click(page, 'note');
    await page.fill('[data-test="note-text"]', 'Which side is behind?');
    await page.screenshot({ path: join(dir, '01-note.png') });
    await click(page, 'note-save');
    await click(page, 'assistant');
    await page.screenshot({ path: join(dir, '02-assistant.png') });
    await page.keyboard.press('Escape');
    await click(page, 'text-only');
    await page.screenshot({ path: join(dir, '03-text-only.png') });
    await click(page, 'close');
    await page.locator('.tabbar button', { hasText: 'Notes' }).click();
    await page.screenshot({ path: join(dir, '04-notes.png') });
    const exported = await page.locator('[data-test="notes-export"]').inputValue();
    await page.locator('.tabbar button', { hasText: 'Garage' }).click();
    await page.screenshot({ path: join(dir, '05-garage.png') });
    await page.locator('[data-test="bike-unknown"]').click();
    await page.screenshot({ path: join(dir, '06-bike-sheet.png'), fullPage: true });
    await page.locator('[data-test="bike-name"]').fill('Blue city bike');
    await page.locator('[data-test="bike-name"]').blur();
    await page.screenshot({ path: join(dir, '07-bike-named.png') });
    const want = ['Review unit: card:inspection:derailleur-alignment', 'Flow: adjust-rear-shifting', 'drive.gear_type=derailleur', 'Which side is behind?'];
    const missing = want.filter((w) => !exported.includes(w));
    const named = (await page.locator('.wh .t b').textContent()) === 'Blue city bike';
    return { id, ending: 'ok', expected: 'ok', error: missing.length ? `notes export lacks: ${missing.join('; ')}` : named ? undefined : 'naming the unknown bike failed' };
  } catch (e: any) {
    return { id, ending: 'crashed', expected: 'ok', error: String(e?.message ?? e).split('\n')[0] };
  } finally {
    await ctx.close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (!args.includes('--no-build')) {
    const b = spawnSync(process.execPath, [join(REPO, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'player/vite.config.ts', '--logLevel', 'warn'], { cwd: REPO, stdio: 'inherit' });
    if (b.status) process.exit(b.status);
  }
  const server = spawn(process.execPath, [join(REPO, 'node_modules/vite/bin/vite.js'), 'preview', '--config', 'player/vite.config.ts', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  // Software WebGL, so the 3D stage renders in headless Chromium on any machine.
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const expected = expectedEndings();
  const results: Result[] = [];
  rmSync(SHOTS, { recursive: true, force: true });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(URL)).ok) break;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    const profiles = readdirSync(join(REPO, 'profiles')).filter((f) => f.endsWith('.yaml'));
    for (const f of profiles) {
      const p = YAML.parse(readFileSync(join(REPO, 'profiles', f), 'utf8')).profile;
      for (const j of p.journeys) {
        for (const orient of ['portrait', 'landscape'] as const) {
          const size = orient === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
          const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
          const page = await ctx.newPage();
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
          await page.goto(URL);
          const dir = join(SHOTS, orient, `${p.id}__${j.id}`);
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, '00-notice.png') });
          await click(page, 'notice-ok');
          await setUpBike(page, p);
          // Toasts would cover the next screens in these fast clicks.
          await page.addStyleTag({ content: '.toast { display: none !important; }' });
          await page.screenshot({ path: join(dir, '00-home.png') });
          const r = await walk(page, p, j, dir).catch((e) => ({ ending: 'crashed', error: String(e?.message ?? e).split('\n')[0] }));
          if (orient === 'portrait') {
            const exp = expected.get(`${p.id}|${j.title}`) ?? '(not in report)';
            results.push({ id: `${p.id}/${j.id}`, ending: r.ending, expected: exp, error: r.error ?? (errors.length ? errors.join('; ') : undefined) });
          } else if (r.error || errors.length) {
            results.push({ id: `${p.id}/${j.id} (landscape)`, ending: r.ending, expected: r.ending, error: r.error ?? errors.join('; ') });
          }
          await ctx.close();
        }
      }
    }
    results.push(await extras(browser));
  } finally {
    await browser.close();
    server.kill();
  }
  let failed = 0;
  for (const r of results) {
    const ok = r.ending === r.expected && !r.error;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.id}: ${r.ending}${ok ? '' : ` (expected: ${r.expected})${r.error ? ` error: ${r.error}` : ''}`}`);
  }
  console.log(`\n${results.length - failed} of ${results.length} journeys end as in build/report.md. Screenshots in player/e2e/shots/.`);
  process.exit(failed ? 1 : 0);
}

main();
