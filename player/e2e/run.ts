// Browser walk: builds the player, serves dist/ and clicks through every profile journey on a
// phone-sized screen, the way the profile's owner would. Saves a screenshot of every screen to
// scratch/shots/e2e/ (npm run shots uses scratch/shots/slow/) and checks that each journey ends where build/report.md says it ends.
//
//   npm run test:e2e                  all journeys, portrait, plus landscape screenshots
//   npm run test:e2e -- --no-build    reuse dist/
//   npm run test:e2e -- --only nav    only the journeys whose id contains one of the comma-separated
//                                     words (e.g. `navigation`, `road-bike-stand/`), for re-runs while fixing
//
// The 3D view is drawn in software here (no graphics card), which is what makes this slow and
// keeps the machine busy. So the profile journeys run in text-only mode, except the ones in
// WITH_3D; the extras test the 3D view and keep it.

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import YAML from 'yaml';

const REPO = resolve(import.meta.dirname, '../..');
const SHOTS = join(REPO, 'scratch/shots/e2e');
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;

interface Result { id: string; ending: string; expected: string; error?: string }

/** Profile journeys that keep the 3D view (both orientations): a bike held in a stand, putting it back, and the test ride. */
const WITH_3D = new Set(['road-bike-stand/chain-falls-off-on-test-ride']);

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

/** The screen once it is no longer `from`: the card column moves on only when its scroll has come to rest. */
async function viewAfter(page: Page, from: string, ms = 3000): Promise<string> {
  const end = Date.now() + ms;
  let v = await view(page);
  while (v === from && Date.now() < end) {
    await page.waitForTimeout(100);
    v = await view(page);
  }
  return v;
}

async function click(page: Page, test: string): Promise<void> {
  // The guides sit in a collapsed list on the repair menu.
  if (test.startsWith('tutorial-')) {
    const g = page.locator('details.guides');
    if ((await g.count()) && !(await g.evaluate((d: HTMLDetailsElement) => d.open))) await g.locator('summary').click();
  }
  await page.locator(`[data-test="${test}"]`).first().click();
}

/**
 * A one-finger drag by touch (the browser's own touch events, like a thumb), for the swipe tests.
 * The text box scrolls with it; headless Chrome does not snap after these events, so the card
 * column settles by itself once the box is still (`ui/flow.ts`).
 */
async function swipe(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, p?: [number, number]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p[0], y: p[1] }] : [] });
  await send('touchStart', from);
  for (let i = 1; i <= 8; i++) await send('touchMove', [from[0] + ((to[0] - from[0]) * i) / 8, from[1] + ((to[1] - from[1]) * i) / 8]);
  await send('touchEnd');
  await cdp.detach();
  await page.waitForTimeout(150);
}

/** The first screen of a flow: the profile's test bike from the garage, or an unknown bike. */
async function pickBike(page: Page, p: any, demoIds: string[]): Promise<void> {
  if (demoIds.includes(p.id)) await click(page, `pick-${p.id}`);
  else {
    await click(page, 'pick-unknown');
    await click(page, 'unknown-questions');
  }
}

async function walk(page: Page, p: any, j: any, shotDir: string, demoIds: string[]): Promise<{ ending: string; error?: string }> {
  let n = 0;
  const shot = async (name: string) => page.screenshot({ path: join(shotDir, `${String(++n).padStart(2, '0')}-${name.replace(/[^a-z0-9-]+/gi, '_')}.png`) });
  if (j.start.diagnosis) await click(page, `diagnosis-${j.start.diagnosis}`);
  else if (j.start.tutorial) await click(page, `tutorial-${j.start.tutorial}`);
  else await click(page, 'routine');
  await shot('pick');
  await pickBike(page, p, demoIds);
  let lastCard = '';
  let jumped = false;
  let fromJob = '';
  let inTutorial = !!j.start.tutorial;
  for (let guard = 0; guard < 200; guard++) {
    const v = await view(page);
    const [, kind, id] = v.split(':');
    await shot(`${kind}${id ? `-${id}` : ''}`);
    if (kind === 'keep') {
      await click(page, 'keep-skip');
    } else if (kind === 'question') {
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
        // An exit, or a tap that moved on by itself (an inspection without a default).
        if ((await view(page)) !== v) continue;
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
    const errors: string[] = [];
    const expect = (ok: boolean, what: string) => ok || errors.push(what);
    // the 3D parts' licence (CC BY 4.0) needs this credit in the test build notice, with both links
    const credits = (await page.textContent('[data-test="credits"]')) ?? '';
    expect(credits.includes('3D parts based on "Rigid Bike [Touring Bike]"') && credits.includes('by Mohamed Farhan') && credits.includes('CC BY 4.0') && credits.includes('Changed: split into parts, simplified, re-oriented.'), `credits line is wrong: ${credits}`);
    const hrefs = await page.$$eval('[data-test="credits"] a', (as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.join(' ') === 'https://skfb.ly/pAzTT http://creativecommons.org/licenses/by/4.0/', `credits links are wrong: ${hrefs.join(' ')}`);
    await click(page, 'notice-ok');
    await page.addStyleTag({ content: '.toast { display: none !important; }' });
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });
    const repair = () => page.locator('.tabbar button', { hasText: 'Repair' }).click();

    // An unknown bike, answering the questions, saved under a name the user enters.
    await click(page, 'tutorial-adjust-rear-shifting');
    await shot('01-pick');
    await click(page, 'pick-unknown');
    await shot('02-unknown');
    await click(page, 'unknown-questions');
    // Help behind the question mark, ending with the line about the assistant.
    expect(await page.locator('[data-test="help-text"]').isHidden(), 'the help is open before it is asked for');
    await click(page, 'help');
    expect(/assistant can help/.test((await page.locator('[data-test="help-text"]').textContent()) ?? ''), 'the help does not mention the assistant');
    await shot('02b-help');
    await click(page, 'answer-derailleur');
    await click(page, 'answer-mechanical');
    expect(await view(page) === 'journey:keep:', 'no keep screen after the questions');
    expect(await page.locator('[data-test="keep-save"]').isDisabled(), 'a new bike could be saved without a name');
    await page.fill('[data-test="keep-name"]', 'Blue city bike');
    await shot('03-keep-new');
    await click(page, 'keep-save');
    await click(page, 'choice-stand');
    expect(await page.locator('[data-test="tier-needed"]').count() === 1, 'the tools screen has no "Needed" tier');
    await shot('03b-tools');
    await click(page, 'start');
    await click(page, 'note');
    await page.fill('[data-test="note-text"]', 'Which side is behind?');
    await shot('04-note');
    await click(page, 'note-save');
    await click(page, 'assistant');
    await shot('05-assistant');
    await page.keyboard.press('Escape');
    await click(page, 'text-only');
    await shot('06-text-only');
    await click(page, 'close');
    await page.locator('.tabbar button', { hasText: 'Notes' }).click();
    expect(await page.locator('[data-test="note-group"]').count() === 1, 'the notes are not grouped by screen');
    await shot('07-notes');
    const exported = await page.locator('[data-test="notes-export"]').inputValue();
    const want = ['Screen: card:inspection:derailleur-alignment', 'Flow: adjust-rear-shifting', 'Last steps:', 'Details', 'drive.gear_type=derailleur', 'Which side is behind?', 'Bike: Blue city bike'];
    const missing = want.filter((w) => !exported.includes(w));
    expect(!missing.length, `notes export lacks: ${missing.join('; ')}`);

    // The saved bike is in the garage with what was learned; the next flow offers it.
    await page.locator('.tabbar button', { hasText: 'Garage' }).click();
    const saved = page.locator('.card', { hasText: 'Blue city bike' });
    expect(await saved.count() === 1, 'the new bike is not in the garage');
    await shot('08-garage');
    await repair();
    await click(page, 'tutorial-adjust-rear-shifting');
    await page.locator('.list button', { hasText: 'Blue city bike' }).click();
    expect(await view(page) === 'journey:choice:', `the saved bike was asked again (${await view(page)})`);
    await click(page, 'back');
    expect((await view(page)) === 'pick:list', 'back from the first screen does not return to the bike choice');
    await click(page, 'back');

    // The complete bike: found among the test bikes.
    await click(page, 'diagnosis-gears-shift-badly');
    await click(page, 'pick-unknown');
    await click(page, 'unknown-complete');
    await page.fill('[data-test="form-brand"]', 'Corvana');
    await page.fill('[data-test="form-model"]', 'SL 3');
    await page.fill('[data-test="form-year"]', '1900');
    await click(page, 'lookup');
    expect(await page.locator('[data-test="form-error"]').count() === 1, 'a model year of 1900 was accepted');
    await page.fill('[data-test="form-year"]', '2020');
    await shot('09-complete-form');
    await click(page, 'lookup');
    expect(await page.locator('[data-test="lookup-found"]').count() === 1, 'the lookup did not find the Corvana');
    await shot('10-lookup-found');
    await click(page, 'lookup-use');
    expect(await view(page) === 'journey:keep:', 'no offer to keep the looked-up bike');
    expect((await page.locator('[data-test="keep-name"]').inputValue()) === 'Corvana Strada SL 3', 'the looked-up name is not suggested');
    await click(page, 'keep-skip');
    await click(page, 'back');
    await click(page, 'back');
    await click(page, 'back');

    // The complete bike: not found, so the questions follow.
    await click(page, 'unknown-complete');
    await page.fill('[data-test="form-brand"]', 'Acme');
    await page.fill('[data-test="form-model"]', 'Roadster');
    await click(page, 'lookup');
    expect(await page.locator('[data-test="lookup-none"]').count() === 1, 'an unknown bike was found');
    await shot('11-lookup-none');
    await click(page, 'lookup-questions');
    expect((await view(page)).startsWith('journey:question:'), `no questions after a failed lookup (${await view(page)})`);
    // Back leads out the way the user came: question, result, form, unknown bike, bike choice, home.
    for (let i = 0; i < 5; i++) await click(page, 'back');
    expect(await view(page) === 'home', `back did not lead home (${await view(page)})`);

    // Delete a bike by swiping it to the left; a warning comes first.
    await page.locator('.tabbar button', { hasText: 'Garage' }).click();
    const row = page.locator('.swipe', { hasText: 'Blue city bike' }).locator('.front');
    const box = (await row.boundingBox())!;
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 140, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    await shot('12-swiped');
    await page.locator('.swipe.open .del').click();
    await shot('13-delete-warning');
    await click(page, 'confirm-ok');
    expect(await page.locator('.card', { hasText: 'Blue city bike' }).count() === 0, 'the swiped bike was not deleted');
    return { id, ending: 'ok', expected: 'ok', error: errors.length ? errors.join('; ') : undefined };
  } catch (e: any) {
    return { id, ending: 'crashed', expected: 'ok', error: String(e?.message ?? e).split('\n')[0] };
  } finally {
    await ctx.close();
  }
}

/** The bike page: preview, the four tabs, editing a fact, the geometry check, colour, a red service item, delete. */
async function bikePage(browser: import('playwright').Browser): Promise<Result> {
  const id = 'extras/bike-page';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const dir = join(SHOTS, 'portrait', 'bike-page');
  mkdirSync(dir, { recursive: true });
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await click(page, 'notice-ok');
    await page.addStyleTag({ content: '.toast { display: none !important; }' });
    const expect = (ok: boolean, what: string) => ok || errors.push(what);
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });
    const fact = (key: string) => page.evaluate((k) => (window as any).__app.store.bike('road-bike-stand').facts[k], key);
    await page.locator('.tabbar button', { hasText: 'Garage' }).click();
    expect(await page.locator('.bikecard img.thumb').count() > 0, 'the garage list has no pictures of the bikes');
    await shot('01-garage');
    await click(page, 'bike-road-bike-stand');
    await page.waitForTimeout(600);
    expect(await page.locator('[data-test="preview"] canvas').count() === 1, 'no 3D preview on the bike page');
    await shot('02-characteristics');

    // The preview opens to full screen and closes again (button and Escape); the assistant hides meanwhile.
    const vp = page.viewportSize()!;
    const fills = async () => {
      const r = await page.locator('[data-test="stage"]').boundingBox();
      return !!r && Math.abs(r.width - vp.width) < 2 && Math.abs(r.height - vp.height) < 2;
    };
    await click(page, 'preview-full');
    await page.waitForTimeout(300);
    expect(await fills(), 'the 3D preview did not open to full screen');
    expect(!(await page.locator('[data-test="assistant"]').isVisible()), 'the assistant button shows over the full-screen 3D view');
    await shot('02b-preview-full');
    await click(page, 'preview-full');
    expect(!(await fills()), 'the close button did not end the full screen');
    await click(page, 'preview-full');
    await page.keyboard.press('Escape');
    expect(!(await fills()), 'Escape did not end the full screen');
    expect(await view(page) === 'bike:road-bike-stand', `Escape in full screen left the bike page (${await view(page)})`);

    // Characteristics: tap a line, change the answer.
    await page.locator('[data-test="row-bike.ebike"] button.fline').click();
    await click(page, 'fact-bike.ebike-true');
    expect(await fact('bike.ebike') === true, 'the e-bike answer was not changed');

    // Components: groups with their model facts; a group opens to its facts.
    await click(page, 'tab-components');
    await shot('03-components');
    await click(page, 'group-drive');
    expect(await page.locator('[data-test="row-drive.cassette_model"]').count() === 1, 'the drivetrain group does not list its facts');
    await page.locator('[data-test="row-drive.cassette_model"] button.fline').click();
    await page.fill('[data-test="fact-drive.cassette_model"]', 'Test 11-32');
    await click(page, 'fact-save');
    expect(await fact('drive.cassette_model') === 'Test 11-32', 'a component model was not saved');
    await click(page, 'group-back');

    // Geometry: a value outside the range, and one that does not fit the others, are refused.
    await click(page, 'tab-geometry');
    await page.locator('[data-test="row-geometry.stack_mm"] button.fline').click();
    await page.fill('[data-test="fact-geometry.stack_mm"]', '400');
    await click(page, 'fact-save');
    expect(/between 450 and 720/.test((await page.locator('[data-test="fact-error"]').textContent()) ?? ''), 'a stack of 400 mm was not refused with the range');
    expect(await fact('geometry.stack_mm') === 560, 'the refused stack was stored');
    await page.fill('[data-test="fact-geometry.stack_mm"]', '580');
    await click(page, 'fact-save');
    expect(await fact('geometry.stack_mm') === 580, 'a stack of 580 mm was not saved');
    await page.locator('[data-test="row-geometry.reach_mm"] button.fline').click();
    await page.fill('[data-test="fact-geometry.reach_mm"]', '520');
    await click(page, 'fact-save');
    expect(/clearly longer/.test((await page.locator('[data-test="fact-error"]').textContent()) ?? ''), 'a reach almost as long as the top tube was accepted');
    await shot('04-geometry-refused');

    // Colour.
    await click(page, 'colour-c0392b');
    expect(await fact('bike.colour') === '#c0392b', 'the frame colour was not saved');

    // Service: nothing is known without the weekly distance; a long time on the bike turns it red.
    await click(page, 'tab-service');
    expect(await page.locator('[data-test="red-banner"]').count() === 0, 'a red banner on a new bike');
    await shot('05-service-unknown');
    await page.evaluate(() => {
      const a = (window as any).__app;
      a.store.bike('road-bike-stand').added = '2025-01-01';
      a.store.save();
    });
    await page.fill('[data-test="km-week"]', '100');
    await click(page, 'km-save');
    expect(await page.locator('[data-test="red-banner"]').count() === 1, 'no red banner for an overdue job');
    expect(await page.locator('[data-test="service-chain-care"] [data-light="red"]').count() === 1, 'the overdue job is not red');
    await shot('06-service-red');
    await page.locator('.wh .ib').click();
    expect(await page.locator('.bikecard [data-test="red-banner"]').count() === 1, 'no red banner in the garage list');
    await shot('07-garage-red');

    // Delete from the bike page, with the warning.
    await click(page, 'bike-road-bike-stand');
    await click(page, 'remove-bike');
    await click(page, 'confirm-ok');
    expect(await page.locator('[data-test="bike-road-bike-stand"]').count() === 0, 'the bike was not deleted');
    return { id, ending: 'ok', expected: 'ok', error: errors.length ? errors.join('; ') : undefined };
  } catch (e: any) {
    await shot_fail(page, dir);
    return { id, ending: 'crashed', expected: 'ok', error: String(e?.message ?? e).split('\n')[0] };
  } finally {
    await ctx.close();
  }
}

/** Menu, swipe up for the next step, back by the screen edge and by the browser, and the assistant button. */
async function navigation(browser: import('playwright').Browser): Promise<Result> {
  const id = 'extras/navigation';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const dir = join(SHOTS, 'portrait', 'navigation');
  mkdirSync(dir, { recursive: true });
  try {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await click(page, 'notice-ok');
    await page.addStyleTag({ content: '.toast { display: none !important; }' });
    const expect = (ok: boolean, what: string) => ok || errors.push(what);
    const shot = (name: string) => page.screenshot({ path: join(dir, `${name}.png`) });

    // The repair menu: symptoms first, the check as a card, the guides collapsed.
    expect(await page.locator('details.guides[open]').count() === 0, 'the guides are open by default');
    expect(await page.locator('.symptoms [data-test^="diagnosis-"]').count() > 0, 'no symptoms on the repair menu');
    await shot('01-menu');

    // The assistant button: drag it to the left edge; it stays there on every screen.
    const fab = page.locator('[data-test="assistant"]');
    const c0 = (await fab.boundingBox())!;
    await page.mouse.move(c0.x + c0.width / 2, c0.y + c0.height / 2);
    await page.mouse.down();
    await page.mouse.move(60, 300, { steps: 6 });
    await page.mouse.move(20, 300, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect((await fab.getAttribute('data-side')) === 'left', 'the assistant button did not stick to the left edge');
    expect(await page.locator('.modal').count() === 0, 'dragging the assistant button opened it');
    await shot('02-assistant-left');
    await page.evaluate(() => ((window as any).__fab = document.querySelector('.assist')));
    await page.locator('.tabbar button', { hasText: 'Garage' }).click();
    expect((await fab.getAttribute('data-side')) === 'left', 'the assistant button moved to another side on the garage screen');
    // One element on every screen, so it does not slide in from its default place on a new screen.
    expect(await page.evaluate(() => document.querySelector('.assist') === (window as any).__fab), 'a new screen made a new assistant button');

    // A card: the text box is a column of cards (ui/flow.ts). Swipe up for the next step; the 3D view does not count.
    await page.locator('.tabbar button', { hasText: 'Repair' }).click();
    await click(page, 'diagnosis-gears-shift-badly');
    await click(page, 'pick-road-bike-stand');
    expect((await view(page)).startsWith('journey:card'), `no card after choosing the bike (${await view(page)})`);
    const first = await view(page);
    const slots = () => page.evaluate(() => [...document.querySelectorAll('.guide > .slot')].map((s) => s.className.replace('slot ', '').replace(' lit', '')).join(','));
    expect(!(await slots()).includes('prev'), `the first card has a card above it (${await slots()})`);
    await page.locator('[data-test^="btn-"]').first().click();
    expect((await slots()) === 'cur,next', `after the answer the next card is not drawn below (${await slots()})`);
    expect(await page.locator('.guide > .slot.next [data-test]').count() === 0, 'the next card carries test ids (taps would reach it)');
    const guide = (await page.locator('.guide').boundingBox())!;
    const mid = guide.x + guide.width / 2;
    const stage = await page.locator('.stage').boundingBox();
    if (stage) await swipe(page, [stage.x + stage.width / 2, stage.y + stage.height - 20], [stage.x + stage.width / 2, stage.y + 20]);
    await page.waitForTimeout(700);
    expect(await view(page) === first, 'a swipe on the 3D view went to the next step');
    expect(await page.locator('.cardside .progress').count() === 1, 'no progress bar beside the text');
    await swipe(page, [mid, guide.y + guide.height - 30], [mid, guide.y + 20]);
    const second = await viewAfter(page, first);
    expect(second !== first && second.startsWith('journey:card'), `a swipe up did not go to the next step (${first} -> ${second})`);
    expect((await slots()).startsWith('prev,cur'), `the previous card is not drawn above (${await slots()})`);
    // The assistant button keeps clear of Back and Next.
    const clear = await page.evaluate(() => {
      const a = document.querySelector('.assist')!.getBoundingClientRect();
      return [...document.querySelectorAll('.pager .btn')].every((b) => {
        const r = b.getBoundingClientRect();
        return a.right <= r.left || a.left >= r.right || a.bottom <= r.top || a.top >= r.bottom;
      });
    });
    expect(clear, 'the assistant button covers Back or Next');
    await shot('03-card-after-swipe');
    // A card waiting for an answer: the next card shows only its top ("locked") or not at all, and a swipe up stays.
    expect(await page.locator('[data-test="next"]').isDisabled(), 'Next is enabled before the second card is answered');
    expect(!(await slots()).split(',').includes('next'), `the next card is open before the answer (${await slots()})`);
    await swipe(page, [mid, guide.y + guide.height - 30], [mid, guide.y + 20]);
    await page.waitForTimeout(900);
    expect(await view(page) === second, `a swipe up went on before the answer (${await view(page)})`);
    // Swipe down for the previous step: back to the first card, with its answer still there. Also
    // when the text is taller than the box.
    await page.addStyleTag({ content: '.guide { flex: none !important; height: 160px !important; }' });
    expect(await page.evaluate(() => { const g = document.querySelector('.guide')!; return g.scrollHeight > g.clientHeight; }), 'the shortened text box does not scroll');
    // the view at the top of the card (shrinking the box left it further down)
    await page.evaluate(() => { const g = document.querySelector<HTMLElement>('.guide')!; g.scrollTop = g.querySelector<HTMLElement>('.slot.cur')!.offsetTop; });
    await page.waitForTimeout(300);
    const g2 = (await page.locator('.guide').boundingBox())!;
    await swipe(page, [mid, g2.y + 20], [mid, g2.y + g2.height - 20]);
    await viewAfter(page, second);
    await page.evaluate(() => document.querySelectorAll('style').forEach((s) => s.textContent?.includes('height: 160px') && s.remove()));
    expect(await view(page) === first, `a swipe down did not go to the previous step (${second} -> ${await view(page)})`);
    expect(await page.locator('[data-test="verdict"]').count() === 1, 'the swipe down did not keep the answer on the previous card');
    await shot('04-card-after-swipe-down');
    const g3 = (await page.locator('.guide').boundingBox())!;
    await swipe(page, [mid, g3.y + g3.height - 30], [mid, g3.y + 20]);
    expect(await viewAfter(page, first) === second, `a second swipe up did not go to the next step (${await view(page)})`);
    // Next and Back go the same way (the column scrolls there).
    await click(page, 'back');
    expect(await viewAfter(page, second) === first, `Back did not go to the previous step (${await view(page)})`);
    await click(page, 'next');
    expect(await viewAfter(page, first) === second, `Next did not go to the next step (${await view(page)})`);

    // Back by the left screen edge, as the arrow does.
    await swipe(page, [4, 400], [280, 410]);
    expect(await view(page) === first, `the edge swipe did not go back (${await view(page)})`);
    // Back by the browser's own back (a button, or Safari's edge swipe).
    await page.waitForTimeout(800); // the app ignores a browser back right after its own edge swipe
    await page.goBack().catch(() => undefined);
    await page.waitForTimeout(150);
    // On a card, Back first undoes the tap, as the arrow does.
    expect(await page.locator('[data-test="verdict"]').count() === 0, 'the browser back did not undo the tap on the card');
    await swipe(page, [4, 400], [280, 410]);
    expect(await view(page) === 'pick:list', `the edge swipe on the first card did not leave it (${await view(page)})`);
    await swipe(page, [4, 400], [280, 410]);
    expect(await view(page) === 'home', `the edge swipe on the bike choice did not lead home (${await view(page)})`);
    // No edge swipe on a main tab: nothing to go back to.
    await swipe(page, [4, 400], [280, 410]);
    expect(await view(page) === 'home', 'an edge swipe on the repair menu changed the screen');
    return { id, ending: 'ok', expected: 'ok', error: errors.length ? errors.join('; ') : undefined };
  } catch (e: any) {
    await shot_fail(page, dir);
    return { id, ending: 'crashed', expected: 'ok', error: String(e?.message ?? e).split('\n')[0] };
  } finally {
    await ctx.close();
  }
}

/**
 * A laptop (no touch, the 3D view on): the touchpad or mouse wheel scrolls the card column, the
 * next card waiting below, one card per turn. Over and over without moving the pointer, which
 * used to stall when every card replaced the text box under it.
 */
async function laptop(browser: import('playwright').Browser): Promise<Result> {
  const id = 'extras/laptop-wheel';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const dir = join(SHOTS, 'laptop', 'extras');
  mkdirSync(dir, { recursive: true });
  const expect = (ok: boolean, what: string) => ok || errors.push(what);
  try {
    await page.goto(URL);
    await click(page, 'notice-ok');
    await click(page, 'diagnosis-gears-shift-badly');
    await click(page, 'pick-road-bike-stand');
    const first = await view(page);
    await page.locator('[data-test^="btn-"]').first().click();
    const g = (await page.locator('.guide').boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    // A long card may take more than one turn of the wheel.
    const wheelTo = async (dy: number, want: string) => {
      for (let i = 0; i < 6 && (await view(page)) !== want; i++) {
        await page.mouse.wheel(0, dy);
        await viewAfter(page, await view(page), 1500);
      }
      return view(page);
    };
    await page.mouse.wheel(0, 400);
    const second = await viewAfter(page, first);
    expect(second !== first && second.startsWith('journey:card'), `the wheel did not go to the next step (${first} -> ${second})`);
    await page.screenshot({ path: join(dir, '01-after-wheel.png') });
    let wv = await wheelTo(-400, first);
    expect(wv === first, `the wheel did not go back to the previous step (${second} -> ${wv})`);
    wv = await wheelTo(400, second);
    expect(wv === second, `the wheel did not go to the next step again (${first} -> ${wv})`);
    return { id, ending: 'ok', expected: 'ok', error: errors.length ? errors.join('; ') : undefined };
  } catch (e: any) {
    await shot_fail(page, dir);
    return { id, ending: 'crashed', expected: 'ok', error: String(e?.message ?? e).split('\n')[0] };
  } finally {
    await ctx.close();
  }
}

async function shot_fail(page: Page, dir: string): Promise<void> {
  await page.screenshot({ path: join(dir, 'failed.png') }).catch(() => undefined);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? (args[oi + 1] ?? '').split(',').filter(Boolean) : null;
  if (only && !only.length) {
    console.error('--only needs a word, e.g. --only navigation');
    process.exit(2);
  }
  const wanted = (id: string) => !only || only.some((w) => id.includes(w));
  if (!args.includes('--no-build')) {
    const b = spawnSync(process.execPath, [join(REPO, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'player/vite.config.ts', '--logLevel', 'warn'], { cwd: REPO, stdio: 'inherit' });
    if (b.status) process.exit(b.status);
  }
  const server = spawn(process.execPath, [join(REPO, 'node_modules/vite/bin/vite.js'), 'preview', '--config', 'player/vite.config.ts', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore' });
  // Software WebGL, so the 3D stage renders in headless Chromium on any machine.
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const expected = expectedEndings();
  const results: Result[] = [];
  if (!only) rmSync(SHOTS, { recursive: true, force: true });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(URL)).ok) break;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    const demoIds: string[] = JSON.parse(readFileSync(join(REPO, 'build/bundle.json'), 'utf8')).demo_bikes.map((d: any) => d.id);
    const profiles = readdirSync(join(REPO, 'profiles')).filter((f) => f.endsWith('.yaml'));
    for (const f of profiles) {
      const p = YAML.parse(readFileSync(join(REPO, 'profiles', f), 'utf8')).profile;
      for (const j of p.journeys) {
        const jid = `${p.id}/${j.id}`;
        if (!wanted(jid)) continue;
        for (const orient of ['portrait', 'landscape'] as const) {
          const size = orient === 'portrait' ? { width: 390, height: 844 } : { width: 844, height: 390 };
          const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
          const page = await ctx.newPage();
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
          await page.goto(URL);
          const dir = join(SHOTS, orient, `${p.id}__${j.id}`);
          rmSync(dir, { recursive: true, force: true });
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: join(dir, '00-notice.png') });
          await click(page, 'notice-ok');
          // Toasts would cover the next screens in these fast clicks.
          await page.addStyleTag({ content: '.toast { display: none !important; }' });
          if (!WITH_3D.has(jid)) await page.evaluate(() => (window as any).__app.setTextOnly(true));
          await page.screenshot({ path: join(dir, '00-home.png') });
          const r = await walk(page, p, j, dir, demoIds).catch((e) => ({ ending: 'crashed', error: String(e?.message ?? e).split('\n')[0] }));
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
    if (wanted('extras/feedback-assistant-garage')) results.push(await extras(browser));
    if (wanted('extras/bike-page')) results.push(await bikePage(browser));
    if (wanted('extras/navigation')) results.push(await navigation(browser));
    if (wanted('extras/laptop-wheel')) results.push(await laptop(browser));
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
  console.log(`\n${results.length - failed} of ${results.length} journeys end as in build/report.md. Screenshots in scratch/shots/e2e/.`);
  if (only) console.log(`Only the journeys matching ${only.join(', ')}: run the whole set once before you commit.`);
  if (!results.length) {
    console.log('No journey matched.');
    process.exit(1);
  }
  process.exit(failed ? 1 : 0);
}

main();
