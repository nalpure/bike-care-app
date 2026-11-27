// Tests of the build tool. Each test breaks one rule on purpose in a copy of the real content
// and expects a one-line error that names the file, the id and the rule.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatIssue } from '../lib/issues.js';
import { runCheck } from '../lib/run.js';
import { errorsOf, REPO, Sandbox, show, step } from './helpers.js';

let box: Sandbox | undefined;
const sandbox = () => (box = new Sandbox());
/** An unsafe exit on a safety check done while the bike is held (no content has one since 2026-11-26). */
const heldStop = (showHowFrom?: string) => (d: any) =>
  step(d, 'check-low-limit-by-hand').buttons.push({
    id: 'caught',
    label: 'It catches in the spokes',
    exit: { kind: 'unsafe', text: 'Do not ride. Take it to a shop.', ...(showHowFrom ? { show_how_from: showHowFrom } : {}) },
  });

/** The job file of the golden example. */
const JOB = 'content/jobs/adjust-rear-shifting.yaml';

const ERROR_LINE = /^ERROR [^\s|]+(:\d+)? \| [^|]+ \| [a-z0-9-]+ \| .+$/;

describe('npm run check', () => {
afterEach(() => {
  box?.dispose();
  box = undefined;
});

describe('the real content', () => {
  it('passes, with the expected paths and journeys', () => {
    const r = runCheck(REPO, { write: false });
    expect(show(r)).toBe('');
    const t = r.flows!.tutorials.find((f) => f.id === 'adjust-rear-shifting')!;
    expect(t.paths).toHaveLength(24);
    expect(t.paths.filter((p) => p.variant.ending === 'complete').map((p) => p.id)).toEqual([
      'derailleur.mechanical.stand',
      'derailleur.mechanical.stand--barrel-adjuster-present-cant-find',
      'derailleur.mechanical.hang',
      'derailleur.mechanical.hang--barrel-adjuster-present-cant-find',
      'derailleur.mechanical.upside-down',
      'derailleur.mechanical.upside-down--barrel-adjuster-present-cant-find',
      'derailleur.mechanical.ground',
      'derailleur.mechanical.ground--barrel-adjuster-present-cant-find',
    ]);
    // The follow-up is left out of the plain path and shown on the path through "I cannot find it".
    const shown = (id: string) => {
      const v = t.paths.find((p) => p.id === id)!.variant;
      return v.items.filter((_x, i) => !v.hidden[i]).map((x) => x.id);
    };
    expect(shown('derailleur.mechanical.stand')).not.toContain('barrel-adjuster-search');
    expect(shown('derailleur.mechanical.stand--barrel-adjuster-present-cant-find')).toContain('barrel-adjuster-search');
    // no stop is reached while the bike is held (2026-11-26), so no path jumps ahead
    expect(t.paths.filter((p) => p.variant.ending === 'jump')).toHaveLength(0);
    expect(t.exits.map((e) => e.exit.kind)).toEqual(Array(6).fill('not_covered'));
    const d = r.flows!.diagnoses.find((f) => f.id === 'gears-shift-badly')!;
    expect(d.paths).toHaveLength(6);
    expect(d.exits).toHaveLength(6);

    const endings = Object.fromEntries([...r.profiles.values()].flatMap((p) => p.results.map((x) => [`${x.profile}/${x.journey}`, x.ending])));
    expect(endings).toEqual({
      'city-derailleur-no-stand/slow-shifting-upside-down': 'tutorial complete',
      'city-derailleur-no-stand/bent-derailleur': 'shop: Have the rear gears checked',
      'city-derailleur-no-stand/routine-check-slow-shifting': '1 to-do item(s)',
      'e-trekking-hub-gear/hub-gear-not-covered': 'not covered (gears-shift-badly)',
      'road-bike-stand/chain-falls-off-on-test-ride': 'exit (unsafe) at test-ride-gears',
      'road-bike-stand/no-barrel-adjuster': 'exit (not_covered) at barrel-adjuster-search',
      'road-bike-stand/routine-check-dirty-chain': '1 to-do item(s)',
      'unknown-bike/test-rides': 'tutorial complete',
    });
  });

  it('never asks a fact marked ask: never, and does not double the paths for it', () => {
    const r = runCheck(REPO, { write: false });
    // No content branches on an ask: never fact today, so add one: the job does not cover hex screws.
    const r2 = sandbox()
      .edit(JOB, (d) => {
        const cv = d.job.covers;
        cv.when['drive.rear_derailleur_screws'] = ['cross', 'unknown'];
        cv.not_covered.push({ when: { 'drive.rear_derailleur_screws': ['hex'] }, text: 'Not covered.' });
      })
      .run();
    expect(r2.issues.errors.map(formatIssue)).toEqual([]);
    const unknown = r2.profiles.get('unknown-bike')!;
    expect(unknown.markdown).not.toContain('rear_derailleur_screws');
    expect(unknown.results[0].questions).toBe(2);
    const t = r2.flows!.tutorials[0];
    const stand = t.paths.find((p) => p.id === 'derailleur.mechanical.stand')!;
    expect(stand.combo.alt['drive.rear_derailleur_screws']).toEqual(['cross', 'unknown']);
    expect(r.profiles.get('unknown-bike')!.results[0].questions).toBe(2);
  });

  it('checks show nodes like focus nodes, rejects one listed in both, and carries show into the bundle', () => {
    const ok = sandbox()
      .edit(JOB, (d) => { step(d, 'check-high-limit').show = ['frame', 'chain']; })
      .edit('content/inspections.yaml', (d) => { d.inspections[0].show = ['frame']; })
      .run();
    expect(show(ok)).toBe('');
    const b = JSON.parse(ok.bundle!);
    expect(b.steps.find((s: any) => s.id === 'check-high-limit').show).toEqual(['frame', 'chain']);
    expect(b.inspections[0].show).toEqual(['frame']);

    const unknown = sandbox()
      .edit(JOB, (d) => { step(d, 'check-high-limit').show = ['frame', 'no_such_part']; })
      .run();
    const [e] = errorsOf(unknown, 'unknown-node');
    expect(unknown.issues.errors).toHaveLength(1);
    expect(formatIssue(e)).toMatch(ERROR_LINE);
    expect(formatIssue(e)).toContain('Show node "no_such_part"');

    const both = sandbox()
      .edit(JOB, (d) => { step(d, 'check-high-limit').show = ['upper_pulley']; })
      .run();
    expect(both.issues.errors).toHaveLength(1);
    expect(formatIssue(errorsOf(both, 'show-and-focus')[0])).toContain('list it once, in focus');
  });

  it('does not repeat an inspection answered earlier in the session, but re-checks after the work', () => {
    // No tutorial calls an inspection after the work any more, so the test puts one in the finish.
    const r = sandbox()
      .edit(JOB, (d) => {
        const inspect = { inspect: 'shift-test-ride', outcomes: { fine: 'continue', 'slow-to-bigger': 'continue', 'slow-to-smaller': 'continue' } };
        d.flow.finish.unshift({ branch: { 'wheel-free': [inspect], 'test-rides': [] } });
      })
      .run();
    expect(show(r)).toBe('');
    const md = r.profiles.get('city-derailleur-no-stand')!.markdown;
    expect(md).toContain('`derailleur-alignment` · not shown again');
    // The finish test ride comes after the work, so it is shown again although the diagnosis asked it.
    expect(md).toMatch(/##### \d+\. Test ride the gears · `shift-test-ride`/);
  });

  it('writes the bundle, the report and the review files, but no single paths', () => {
    const b = sandbox();
    const r = b.run(true);
    expect(show(r)).toBe('');
    for (const rel of [
      'build/bundle.json',
      'build/report.md',
      'build/review/index.md',
      'build/review/cards.md',
      'build/review/trees/adjust-rear-shifting.md',
      'build/review/trees/gears-shift-badly.md',
      'build/review/trees/routine-check.md',
      'build/review/journeys/unknown-bike.md',
    ]) {
      expect(existsSync(join(b.root, rel)), rel).toBe(true);
    }
    expect(existsSync(join(b.root, 'build/walkthroughs'))).toBe(false);
    const bundle = JSON.parse(r.bundle!);
    expect(bundle.unverified).toBe(true);
    expect(bundle.tutorials[0].cases[0].case.sequence.length).toBeGreaterThan(5);
  });

  it('is deterministic', () => {
    const a = runCheck(REPO, { write: false });
    const b = runCheck(REPO, { write: false });
    expect(a.report).toBe(b.report);
    expect(a.bundle).toBe(b.bundle);
  });
});

describe('review units and the ledger', () => {
  const unit = (r: ReturnType<typeof runCheck>, id: string) => r.review.find((s) => s.unit.id === id)!;
  const sign = (b: Sandbox, id: string, hash: string, role: string) =>
    writeFileSync(join(b.root, 'reviews/ledger.yaml'), `reviews:\n  - { unit: "${id}", hash: "${hash}", role: ${role}, by: "test", date: "2026-11-17", verdict: approved }\n`);

  it('lists every card, tree and journey once', () => {
    const r = runCheck(REPO, { write: false });
    const ids = r.review.map((s) => s.unit.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('card:step:check-high-limit');
    expect(ids).toContain('card:inspection:derailleur-alignment');
    expect(ids).toContain('card:choice:hold_bike');
    expect(ids).toContain('tree:tutorial:adjust-rear-shifting');
    expect(ids).toContain('journey:road-bike-stand/chain-falls-off-on-test-ride');
    // Each step appears once in the card sheet, however many paths use it.
    const cards = r.outputs!.files.get('build/review/cards.md')!;
    expect(cards.match(/`check-high-limit`/g)?.length ?? 0).toBeLessThanOrEqual(2);
  });

  it('a sign-off holds while the unit is unchanged', () => {
    const b = sandbox();
    mkdirSync(join(b.root, 'reviews'));
    const before = b.run();
    const card = unit(before, 'card:step:check-high-limit');
    sign(b, card.unit.id, card.unit.hash, 'mechanic');
    const after = b.run();
    expect(show(after)).toBe('');
    expect(unit(after, 'card:step:check-high-limit').byRole.mechanic.status).toBe('approved');
    expect(unit(after, 'card:step:check-high-limit').byRole.beginner.status).toBe('unreviewed');
  });

  it('rewording a step invalidates its card and the journeys that show it, not the flow tree', () => {
    const b = sandbox();
    mkdirSync(join(b.root, 'reviews'));
    const before = b.run();
    const card = unit(before, 'card:step:check-b-gap').unit;
    const tree = unit(before, 'tree:tutorial:adjust-rear-shifting').unit;
    writeFileSync(join(b.root, 'reviews/ledger.yaml'), `reviews:
  - { unit: "${card.id}", hash: "${card.hash}", role: mechanic, by: "test", date: "2026-11-17", verdict: approved }
  - { unit: "${tree.id}", hash: "${tree.hash}", role: mechanic, by: "test", date: "2026-11-17", verdict: approved }
`);
    b.edit(JOB, (d) => (step(d, 'check-b-gap').text = 'Look from the side at the small gap between the upper toothed wheel and the largest sprocket. Keep the screwdriver at hand.'));
    const after = b.run();
    expect(unit(after, card.id).byRole.mechanic.status).toBe('changed');
    expect(unit(after, tree.id).byRole.mechanic.status).toBe('approved');
    expect(unit(after, 'journey:road-bike-stand/chain-falls-off-on-test-ride').unit.hash).not.toBe(unit(before, 'journey:road-bike-stand/chain-falls-off-on-test-ride').unit.hash);
  });

  it('reordering steps invalidates the flow tree', () => {
    const b = sandbox();
    const before = b.run();
    b.edit(JOB, (d) => {
      const i = d.flow.work.indexOf('check-b-gap');
      const [item] = d.flow.work.splice(i, 1);
      d.flow.work.splice(i + 1, 0, item);
    });
    const after = b.run();
    expect(unit(after, 'tree:tutorial:adjust-rear-shifting').unit.hash).not.toBe(unit(before, 'tree:tutorial:adjust-rear-shifting').unit.hash);
  });

  it('warns about a ledger entry for a unit that no longer exists', () => {
    const b = sandbox();
    mkdirSync(join(b.root, 'reviews'));
    sign(b, 'card:step:gone', 'abcdefabcdef', 'mechanic');
    const r = b.run();
    expect(r.issues.warnings.some((w) => w.rule === 'ledger-unknown-unit')).toBe(true);
  });
});

describe('job files', () => {
  /** A second job with a flow of one way, written as a file in the sandbox. */
  const second = (b: Sandbox, name: string, body: string) =>
    writeFileSync(join(b.root, `content/jobs/${name}.yaml`), `job:\n  id: ${name}\n  title: "Test job"\n  difficulty: 1\n  shop: { tell: "Test.", price_eur: "<range>", price_source: "<source, date>" }\n${body}`);

  it('expands each way into its case and points issues in a branch at the line of the item', () => {
    const r = sandbox()
      .edit(JOB, (d) => (d.flow.work[0].branch['test-rides'][1] = 'no-such-card'))
      .run();
    const [e] = errorsOf(r, 'unknown-step');
    expect(e, show(r)).toBeDefined();
    expect(e.file).toBe(JOB);
    // the sandbox wrote the file back without comments, so the line is found by its text
    const lines = readFileSync(join(box!.root, JOB), 'utf8').split('\n');
    expect(lines[e.line! - 1]).toContain('no-such-card');
  });

  it('a branch names every way, and only ways', () => {
    const unknown = sandbox()
      .edit(JOB, (d) => {
        const b = d.flow.work[0].branch;
        b.ground = b['test-rides'];
        delete b['test-rides'];
      })
      .run();
    const [e] = errorsOf(unknown, 'branch-ways');
    expect(formatIssue(e), show(unknown)).toMatch(ERROR_LINE);
    expect(e.message).toContain('names ground, which is not a way and misses test-rides');
    box!.dispose();
    const none = sandbox()
      .edit(JOB, (d) => delete d.flow.ways)
      .run();
    expect(errorsOf(none, 'branch-ways')[0]?.message, show(none)).toContain('needs the ways');
  });

  it('a job with a flow of one way, and a job with only a header', () => {
    const b = sandbox();
    second(b, 'one-way', 'flow:\n  work: [only-card]\ncards:\n  - { id: only-card, kind: action, title: "Do it", minutes: 1, text: "Do it." }\n');
    writeFileSync(join(b.root, 'content/jobs/header-only.yaml'), 'job:\n  id: header-only\n  title: "Shop only"\n  shop: { tell: "Test.", price_eur: "<range>", price_source: "<source, date>" }\n');
    const r = b.run();
    expect(show(r)).toBe('');
    const bundle = JSON.parse(r.bundle!);
    const t = bundle.tutorials.find((x: any) => x.id === 'one-way');
    expect(t.cases).toEqual([{ case: { name: 'main', sequence: [{ step: 'only-card' }], finish: [] } }]);
    expect(bundle.jobs.find((j: any) => j.id === 'one-way')).toMatchObject({ tutorial: 'one-way' });
    expect(bundle.jobs.find((j: any) => j.id === 'header-only').tutorial).toBeUndefined();
    expect(bundle.tutorials.some((x: any) => x.id === 'header-only')).toBe(false);
  });

  it('a flow needs a difficulty, and the file is named after its job', () => {
    const b = sandbox();
    writeFileSync(join(b.root, 'content/jobs/no-level.yaml'), 'job:\n  id: no-level\n  title: "x"\n  shop: { tell: "Test.", price_eur: "<range>", price_source: "<source, date>" }\nflow:\n  work: [check-b-gap]\n');
    writeFileSync(join(b.root, 'content/jobs/wrong-name.yaml'), 'job:\n  id: other-name\n  title: "x"\n  shop: { tell: "Test.", price_eur: "<range>", price_source: "<source, date>" }\n');
    const r = b.run();
    expect(errorsOf(r, 'missing-key').some((e) => e.file === 'content/jobs/no-level.yaml' && e.message.includes('difficulty')), show(r)).toBe(true);
    expect(errorsOf(r, 'job-file-name')[0]?.file).toBe('content/jobs/wrong-name.yaml');
  });

  it('card ids are unique across cards, inspections and procedures', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        d.cards.push({ ...step(d, 'check-b-gap'), id: 'derailleur-alignment' });
        d.cards.push({ ...step(d, 'check-b-gap'), id: 'park-bike' });
      })
      .run();
    const e = errorsOf(r, 'duplicate-id');
    expect(e.map((x) => x.message).join(' '), show(r)).toContain('step "park-bike" is already defined in content/steps/holding.yaml');
    box!.dispose();
    const r2 = sandbox()
      .edit(JOB, (d) => d.cards.push({ ...step(d, 'check-b-gap'), id: 'derailleur-alignment' }))
      .run();
    expect(errorsOf(r2, 'duplicate-id')[0]?.message, show(r2)).toContain('has the id of an inspection');
  });

  it("a job's own card is used only by its own flow", () => {
    const b = sandbox();
    second(b, 'borrows', 'flow:\n  work: [check-b-gap]\n');
    const r = b.run();
    const [e] = errorsOf(r, 'card-outside-job');
    expect(e?.file, show(r)).toBe('content/jobs/borrows.yaml');
    expect(e.message).toContain('goes in content/steps/');
  });

  it('warns when the cards are not in the order the flow first uses them', () => {
    const r = sandbox()
      .edit(JOB, (d) => d.cards.push(d.cards.shift()))
      .run();
    expect(show(r)).toBe('');
    const w = r.issues.warnings.filter((x) => x.rule === 'card-order');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('Card shift-to-smallest-sprocket should come before card ride-to-smallest-sprocket');
  });
});

describe('rules broken on purpose', () => {
  it('a fourth button', () => {
    const r = sandbox()
      .edit(JOB, (d) => step(d, 'check-cable-tension').buttons.push({ id: 'noise', label: 'It makes a strange noise', text: 'Listen again.' }, { id: 'hum', label: 'It hums', text: 'Listen again.' }))
      .run();
    const e = errorsOf(r, 'max-buttons');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].file).toBe(JOB);
    expect(e[0].id).toBe('step check-cable-tension');
    expect(e[0].message).toContain('at most 3');
  });

  it('an exit reached with the bike held, without show_how_from', () => {
    const r = sandbox()
      .edit(JOB, heldStop())
      .run();
    const e = errorsOf(r, 'exit-needs-show-how-from');
    expect(e.length, show(r)).toBe(3); // stand, hang, upside down
    expect(e[0].file).toBe(JOB);
    expect(e[0].id).toContain('check-low-limit-by-hand');
    expect(e.map((x) => x.message).join(' ')).toMatch(/bike_in_stand/);
  });

  it('an unknown tool', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-high-limit').tools.required = ['sonic-screwdriver']))
      .run();
    const e = errorsOf(r, 'unknown-tool');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].id).toBe('step check-high-limit');
    expect(e[0].message).toContain('sonic-screwdriver');
  });

  it('a tool on the list that the text never names', () => {
    const r = sandbox()
      .edit('content/steps/holding.yaml', (d) => (step(d, 'turn-bike-upright').tools = { helpful: ['work-mat'] }))
      .run();
    const e = errorsOf(r, 'tool-not-mentioned');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].id).toBe('step turn-bike-upright');
    expect(e[0].message).toContain('work-mat');
  });

  it('a tool set option that reads a fact the app would ask', () => {
    const r = sandbox()
      .edit('content/tools.yaml', (d) => (d.tool_sets[0].options[0].when = { 'drive.gear_type': ['derailleur'] }))
      .run();
    const e = errorsOf(r, 'tool-set-when');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].id).toBe('tool set derailleur-screw-tool');
  });

  it('a show_how_from that does not lie ahead', () => {
    const r = sandbox()
      .edit(JOB, heldStop('shift-to-smallest-sprocket'))
      .run();
    expect(errorsOf(r, 'show-how-from-not-ahead').length, show(r)).toBeGreaterThan(0);
  });

  it('a path that ends with the bike still upside down', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        for (const it of d.flow.work) if (it.branch) it.branch['wheel-free'] = it.branch['wheel-free'].filter((x: any) => x.procedure !== 'release-bike');
      })
      .run();
    const e = errorsOf(r, 'end-with-state');
    expect(e.length, show(r)).toBe(3);
    expect(e.map((x) => x.message).join(' ')).toContain('bike_upside_down');
  });

  it('a step that runs while a state it forbids holds', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-high-limit').forbidden_while = ['bike_in_stand']))
      .run();
    const e = errorsOf(r, 'forbidden-while');
    expect(e.length, show(r)).toBe(1);
    expect(e[0].message).toContain('bike_in_stand');
  });

  it('a combination with no case and no not_covered', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        const cv = d.job.covers;
        cv.not_covered = cv.not_covered.filter((x: any) => !x.when['drive.gear_type']?.includes('gearbox'));
      })
      .run();
    // Reported once for the tutorial and once for the diagnosis that shares the job's covers.
    const e = errorsOf(r, 'coverage');
    expect(e.map((x) => x.id).sort(), show(r)).toEqual(['diagnosis gears-shift-badly', 'tutorial adjust-rear-shifting']);
    expect(e[0].message).toContain('drive.gear_type=gearbox');
    expect(e[0].file).toBe(JOB);
  });

  it('an unsafe exit in a step that is not a safety check', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        const b = step(d, 'check-cable-tension').buttons[0];
        delete b.text;
        delete b.solution;
        b.exit = { kind: 'unsafe', text: 'Do not ride. Take it to a shop.' };
      })
      .run();
    expect(errorsOf(r, 'unsafe-only-in-safety-checks'), show(r)).toHaveLength(1);
  });

  it('a not-needed exit on a plain check is allowed and adds a path', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        step(d, 'check-cable-tension').buttons.push({
          id: 'smooth',
          label: 'Every shift is quick and quiet',
          exit: { kind: 'not_needed', text: 'Your gears are fine. Put the bike back on its wheels.', show_how_from: 'release-bike' },
        });
      })
      .run();
    expect(show(r)).toBe('');
    const ids = r.flows!.tutorials[0].paths.map((p) => p.id);
    expect(ids).toContain('derailleur.mechanical.stand--not-needed-check-cable-tension-smooth--jump');
  });

  it('a step without a title, and a button without an id', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        delete step(d, 'check-b-gap').title;
        delete step(d, 'check-b-gap').buttons[1].id;
      })
      .run();
    const msgs = errorsOf(r, 'missing-key').map((e) => e.message).join('\n');
    expect(msgs).toContain('"title"');
    expect(msgs).toContain('"id"');
  });

  it('two buttons with the same id', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-b-gap').buttons[1].id = 'touching'))
      .run();
    expect(errorsOf(r, 'duplicate-id'), show(r)).toHaveLength(1);
  });

  it('a diagnosis that uses an inspection that is not hands-off', () => {
    const r = sandbox()
      .edit('content/inspections.yaml', (d) => (d.inspections.find((x: any) => x.id === 'chain-condition').hands_off = false))
      .run();
    const e = errorsOf(r, 'hands-off-only');
    expect(e.length, show(r)).toBe(2); // the diagnosis and the routine check
  });

  it('a condition on a fact without a question', () => {
    const r = sandbox()
      .edit('content/facts.yaml', (d) => delete d.facts.find((x: any) => x.key === 'drive.shifting').question)
      .run();
    expect(errorsOf(r, 'fact-needs-question').length, show(r)).toBeGreaterThan(0);
  });

  it('a fact group without an entry, and a group without facts', () => {
    const r = sandbox()
      .edit('content/facts.yaml', (d) => {
        d.facts.find((x: any) => x.key === 'bike.colour').key = 'frame.colour';
        d.fact_groups.push({ id: 'brakes', label: { en: 'Brakes' }, icon: 'brake' });
      })
      .run();
    const e = errorsOf(r, 'fact-group');
    expect(e.map((x) => x.id).sort(), show(r)).toEqual(['fact frame.colour', 'fact group brakes']);
  });

  it('a number outside its range, in the facts and in a profile', () => {
    const r = sandbox()
      .edit('content/facts.yaml', (d) => (d.facts.find((x: any) => x.key === 'geometry.wheel_bsd_mm').max = 600))
      .edit('profiles/road-bike-stand.yaml', (d) => (d.profile.facts['geometry.stack_mm'] = 900))
      .run();
    const e = errorsOf(r, 'fact-range').map((x) => `${x.id} ${x.message}`);
    expect(e, show(r)).toContain('fact geometry.wheel_bsd_mm Fact geometry.wheel_bsd_mm: 622 is outside … to 600.');
    expect(e, show(r)).toContain('profile road-bike-stand Fact geometry.stack_mm: 900 is outside 450 to 720.');
  });

  it('a placeholder without fallback wording', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-b-gap').text += ' See the manual for {drive.rear_derailleur_model}.'))
      .run();
    expect(errorsOf(r, 'placeholder-fallback'), show(r)).toHaveLength(1);
  });

  it('an inspection sets only facts no condition reads, to allowed values', () => {
    const r = sandbox()
      .edit('content/inspections.yaml', (d) => {
        const st = d.inspections.find((i: any) => i.id === 'barrel-adjuster-present').states;
        st[0].sets = { 'drive.shifting': 'mechanical' };
        st[1].sets = { 'drive.barrel_adjuster': 'handlebar' };
      })
      .run();
    expect(errorsOf(r, 'sets-fact').length, show(r)).toBe(1);
    expect(errorsOf(r, 'condition-value').length, show(r)).toBe(1);
  });

  it('a follow-up is another inspection, and its outcomes match its states', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        const o = d.flow.checks.find((c: any) => c.inspect === 'barrel-adjuster-present').outcomes;
        o['cant-find'].inspect = 'barrel-adjuster-present';
      })
      .run();
    expect(errorsOf(r, 'follow-up').length, show(r)).toBe(1);
    box!.dispose();
    const r2 = sandbox()
      .edit(JOB, (d) => {
        const o = d.flow.checks.find((c: any) => c.inspect === 'barrel-adjuster-present').outcomes;
        delete o['cant-find'].outcomes['on-cable'];
        o['cant-find'].outcomes['found'] = 'continue';
      })
      .run();
    expect(errorsOf(r2, 'outcomes-match-states').length, show(r2)).toBe(2);
  });

  it('a journey on a bike that already knows the fact does not see the check', () => {
    const r = sandbox()
      .edit('profiles/city-derailleur-no-stand.yaml', (d) => {
        d.profile.facts['drive.barrel_adjuster'] = 'inline';
        delete d.profile.journeys.find((j: any) => j.id === 'slow-shifting-upside-down').tutorial_sees['barrel-adjuster-present'];
      })
      .run();
    expect(show(r)).toBe('');
    const md = r.profiles.get('city-derailleur-no-stand')!.results.find((x) => x.journey === 'slow-shifting-upside-down')!.markdown;
    expect(md).toContain("`barrel-adjuster-present` · not shown: the bike's facts answer it");
    expect(md).toContain("`barrel-adjuster-search` · not shown: the bike's facts answer it");
  });

  it("a tutorial's checks use only hands-off inspections", () => {
    const r = sandbox()
      .edit('content/inspections.yaml', (d) => (d.inspections.find((i: any) => i.id === 'barrel-adjuster-present').hands_off = false))
      .run();
    expect(errorsOf(r, 'hands-off-only').some((e) => e.message.includes("tutorial's checks")), show(r)).toBe(true);
  });

  it('an unknown key, including on: which YAML 1.2 keeps as a string', () => {
    const r = sandbox()
      .replace(JOB, '      outcomes:\n        straight: continue', '      on:\n        straight: continue')
      .run();
    const e = errorsOf(r, 'unknown-key');
    expect(e.length, show(r)).toBeGreaterThan(0);
    expect(e[0].message).toContain('unknown key "on"');
  });

  it('two buttons of a step with the same result', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        const s = step(d, 'test-ride-gears');
        s.buttons[1].exit = { ...s.buttons[0].exit };
      })
      .run();
    const e = errorsOf(r, 'same-outcome');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].id).toBe('step test-ride-gears');
    expect(e[0].message).toContain('"The chain jumps or falls off"');
  });

  it('two states of an inspection call that end the same way; several continues are fine', () => {
    const exit = { kind: 'shop_only', text: 'Your gears still do not shift cleanly. A shop can check it.' };
    const r = sandbox()
      .edit(JOB, (d) => {
        const inspect = { inspect: 'shift-test-ride', outcomes: { fine: 'continue', 'slow-to-bigger': { exit }, 'slow-to-smaller': { exit: { ...exit } } } };
        d.flow.finish.unshift({ branch: { 'wheel-free': [inspect], 'test-rides': [] } });
      })
      .run();
    const e = errorsOf(r, 'same-outcome');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].message).toContain('"slow-to-bigger" and "slow-to-smaller"');
  });

  it('a valid skip adds a path without the skipped step', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-b-gap').buttons[0].skips = ['check-cable-tension']))
      .run();
    expect(show(r)).toBe('');
    const skip = r.flows!.tutorials[0].paths.find((p) => p.id === 'derailleur.mechanical.stand--skip-check-b-gap-touching');
    expect(skip, r.flows!.tutorials[0].paths.map((p) => p.id).join('\n')).toBeDefined();
    expect(skip!.variant.items.map((i) => i.id)).not.toContain('check-cable-tension');
  });

  it('a skip over a safety check', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-high-limit').buttons[0].skips = ['check-low-limit-by-hand']))
      .run();
    const e = errorsOf(r, 'skip-unsafe');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].id).toBe('step check-high-limit');
  });

  it('a skip of a step that is not ahead', () => {
    const r = sandbox()
      .edit(JOB, (d) => (step(d, 'check-b-gap').buttons[0].skips = ['shift-to-smallest-sprocket']))
      .run();
    expect(errorsOf(r, 'skip-not-ahead').length, show(r)).toBeGreaterThan(0);
  });

  it('a profile journey that reaches an unanswered question', () => {
    const r = sandbox()
      .edit('profiles/unknown-bike.yaml', (d) => (d.profile.answers = {}))
      .run();
    const e = errorsOf(r, 'profile-missing-answer');
    expect(e.length, show(r)).toBeGreaterThan(0);
    expect(e[0].file).toBe('profiles/unknown-bike.yaml');
    expect(e[0].message).toContain('drive.gear_type');
  });

  it('a profile journey that reaches a safety check without saying what the owner taps', () => {
    const r = sandbox()
      // an old-style step (no question): the buttons decide the path, so a journey must say which one
      .edit(JOB, (d) => {
        const s = step(d, 'check-low-limit-by-hand');
        delete s.question;
        s.buttons.unshift({ id: 'in-line', label: 'In line with the largest sprocket', text: 'The inner limit is safe.' });
      })
      .edit('profiles/road-bike-stand.yaml', (d) => (d.profile.journeys[0].tutorial_sees['check-low-limit-by-hand'] = 'in-line'))
      .edit('profiles/unknown-bike.yaml', (d) => (d.profile.journeys[0].tutorial_sees['check-low-limit-by-hand'] = 'in-line'))
      .edit('profiles/city-derailleur-no-stand.yaml', (d) => delete d.profile.journeys[0].tutorial_sees['check-low-limit-by-hand'])
      .run();
    expect(errorsOf(r, 'profile-missing-sees'), show(r)).toHaveLength(1);
  });

  it('a step with a question needs no answer in a journey: Next means the goal is met', () => {
    const r = sandbox()
      .edit('profiles/city-derailleur-no-stand.yaml', (d) => delete d.profile.journeys[0].tutorial_sees['check-low-limit'])
      .run();
    expect(show(r)).toBe('');
    const res = [...r.profiles.values()].flatMap((p) => p.results).find((x) => x.journey === 'slow-shifting-upside-down')!;
    expect(res.ending).toBe('tutorial complete');
  });

  it('a step with a question has 1 to 3 problem answers, and needs at least one', () => {
    const one = sandbox()
      .edit(JOB, (d) => step(d, 'check-high-limit').buttons.splice(1))
      .run();
    expect(errorsOf(one, 'check-needs-buttons'), show(one)).toHaveLength(0);
    box!.dispose();
    const none = sandbox()
      .edit(JOB, (d) => (step(d, 'check-b-gap').question = 'Not right?'))
      .edit(JOB, (d) => step(d, 'check-b-gap').buttons.splice(0))
      .run();
    expect(errorsOf(none).length, show(none)).toBeGreaterThan(0);
  });

  it("an inspection's default must continue in every tutorial call, and a journey may not tap it", () => {
    const r = sandbox()
      .edit('content/inspections.yaml', (d) => {
        // a follow-up is checked like any call: its default may not exit
        const i = d.inspections.find((x: any) => x.id === 'barrel-adjuster-search');
        i.default = 'not-found';
      })
      .run();
    expect(errorsOf(r, 'default-continues').length, show(r)).toBeGreaterThan(0);
    box!.dispose();
    const r2 = sandbox()
      .edit('content/inspections.yaml', (d) => {
        const i = d.inspections.find((x: any) => x.id === 'derailleur-alignment');
        i.default = 'straight';
        i.question = 'Looks bent?';
      })
      .run();
    // road-bike-stand / no-barrel-adjuster names "straight" in tutorial_sees; Next means it now
    const e = errorsOf(r2, 'unknown-button');
    expect(e.length, show(r2)).toBeGreaterThan(0);
    expect(e[0].message).toContain('Leave tutorial_sees.derailleur-alignment out');
  });

  it('writes no bundle when there are errors', () => {
    const b = sandbox().edit(JOB, (d) => (step(d, 'check-high-limit').tools.required = ['sonic-screwdriver']));
    const r = b.run(true);
    expect(r.issues.errors.length).toBeGreaterThan(0);
    expect(existsSync(join(b.root, 'build/bundle.json'))).toBe(false);
  });

  it('prints every error on one line with file, id and rule', () => {
    const r = sandbox()
      .edit(JOB, (d) => {
        step(d, 'check-cable-tension').buttons.push({ id: 'fourth', label: 'Fourth', text: 'x' });
        step(d, 'check-high-limit').tools.required = ['sonic-screwdriver'];
      })
      .run();
    expect(r.issues.errors.length).toBeGreaterThan(0);
    for (const i of r.issues.errors) expect(formatIssue(i)).toMatch(ERROR_LINE);
  });
});
});
