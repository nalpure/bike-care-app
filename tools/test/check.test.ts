// Tests of the build tool. Each test breaks one rule on purpose in a copy of the real content
// and expects a one-line error that names the file, the id and the rule.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatIssue } from '../lib/issues.js';
import { runCheck } from '../lib/run.js';
import { errorsOf, REPO, Sandbox, show, step } from './helpers.js';

let box: Sandbox | undefined;
const sandbox = () => (box = new Sandbox());

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
    expect(t.paths).toHaveLength(25);
    expect(t.paths.filter((p) => p.variant.ending === 'complete').map((p) => p.id)).toEqual([
      'derailleur.mechanical.stand',
      'derailleur.mechanical.hang',
      'derailleur.mechanical.upside-down',
      'derailleur.mechanical.ground',
    ]);
    expect(t.paths.filter((p) => p.variant.ending === 'jump')).toHaveLength(3);
    expect(t.exits.map((e) => e.exit.kind)).toEqual(Array(7).fill('not_covered'));
    const d = r.flows!.diagnoses.find((f) => f.id === 'gears-shift-badly')!;
    expect(d.paths).toHaveLength(6);
    expect(d.exits).toHaveLength(8);

    const endings = Object.fromEntries([...r.profiles.values()].flatMap((p) => p.results.map((x) => [`${x.profile}/${x.journey}`, x.ending])));
    expect(endings).toEqual({
      'city-derailleur-no-stand/slow-shifting-upside-down': 'tutorial complete',
      'city-derailleur-no-stand/bent-derailleur': 'shop: Have the rear gears checked',
      'city-derailleur-no-stand/routine-check-slow-shifting': '1 to-do item(s)',
      'e-trekking-hub-gear/hub-gear-not-covered': 'not covered (gears-shift-badly)',
      'mtb-rapid-rise/rapid-rise-not-supported': 'not covered (gears-shift-badly)',
      'road-bike-stand/chain-touches-spokes': 'stop, jump ahead, bike put back, shop',
      'road-bike-stand/no-barrel-adjuster': 'exit (not_covered) at barrel-adjuster-present',
      'road-bike-stand/routine-check-dirty-chain': '1 to-do item(s)',
      'unknown-bike/test-rides': 'tutorial complete',
    });
  });

  it('never asks a fact marked ask: never, and does not double the paths for it', () => {
    const r = runCheck(REPO, { write: false });
    const unknown = r.profiles.get('unknown-bike')!;
    expect(unknown.markdown).not.toContain('rear_derailleur_type');
    expect(unknown.results[0].questions).toBe(2);
    const t = r.flows!.tutorials[0];
    const stand = t.paths.find((p) => p.id === 'derailleur.mechanical.stand')!;
    expect(stand.combo.alt['drive.rear_derailleur_type']).toEqual(['standard', 'unknown']);
  });

  it('does not repeat an inspection answered earlier in the session, but re-checks after the work', () => {
    const r = runCheck(REPO, { write: false });
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
    expect(bundle.tutorials[0].cases[0].cases[1].case.sequence.length).toBeGreaterThan(5);
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
    expect(ids).toContain('journey:road-bike-stand/chain-touches-spokes');
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
    b.edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-b-gap').text = 'Look from the side at the small gap between the upper toothed wheel and the largest sprocket. Keep the screwdriver at hand.'));
    const after = b.run();
    expect(unit(after, card.id).byRole.mechanic.status).toBe('changed');
    expect(unit(after, tree.id).byRole.mechanic.status).toBe('approved');
    expect(unit(after, 'journey:road-bike-stand/chain-touches-spokes').unit.hash).not.toBe(unit(before, 'journey:road-bike-stand/chain-touches-spokes').unit.hash);
  });

  it('reordering steps invalidates the flow tree', () => {
    const b = sandbox();
    const before = b.run();
    b.edit('content/tutorials/adjust-rear-shifting/cases/test-rides.yaml', (d) => {
      const i = d.sequence.findIndex((x: any) => x.step === 'check-b-gap');
      const [item] = d.sequence.splice(i, 1);
      d.sequence.splice(i + 1, 0, item);
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

describe('rules broken on purpose', () => {
  it('a fourth button', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => step(d, 'check-cable-tension').buttons.push({ id: 'noise', label: 'It makes a strange noise', text: 'Listen again.' }))
      .run();
    const e = errorsOf(r, 'max-buttons');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].file).toBe('content/steps/rear-shifting.yaml');
    expect(e[0].id).toBe('step check-cable-tension');
    expect(e[0].message).toContain('at most 3');
  });

  it('an exit reached with the bike held, without show_how_from', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => {
        const b = step(d, 'check-all-gears').buttons.find((x: any) => x.exit);
        delete b.exit.show_how_from;
      })
      .run();
    const e = errorsOf(r, 'exit-needs-show-how-from');
    expect(e.length, show(r)).toBe(3); // stand, hang, upside down
    expect(e[0].file).toBe('content/steps/rear-shifting.yaml');
    expect(e[0].id).toContain('check-all-gears');
    expect(e.map((x) => x.message).join(' ')).toMatch(/bike_in_stand/);
  });

  it('an unknown tool', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-high-limit').tools.required = ['sonic-screwdriver']))
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

  it('a show_how_from that does not lie ahead', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-all-gears').buttons.find((x: any) => x.exit).exit.show_how_from = 'shift-to-smallest-sprocket'))
      .run();
    expect(errorsOf(r, 'show-how-from-not-ahead').length, show(r)).toBeGreaterThan(0);
  });

  it('a path that ends with the bike still upside down', () => {
    const r = sandbox()
      .edit('content/tutorials/adjust-rear-shifting/cases/wheel-free.yaml', (d) => {
        d.sequence = d.sequence.filter((x: any) => x.procedure !== 'release-bike');
      })
      .run();
    const e = errorsOf(r, 'end-with-state');
    expect(e.length, show(r)).toBe(3);
    expect(e.map((x) => x.message).join(' ')).toContain('bike_upside_down');
  });

  it('a step that runs while a state it forbids holds', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-high-limit').forbidden_while = ['bike_in_stand']))
      .run();
    const e = errorsOf(r, 'forbidden-while');
    expect(e.length, show(r)).toBe(1);
    expect(e[0].message).toContain('bike_in_stand');
  });

  it('a combination with no case and no not_covered', () => {
    const r = sandbox()
      .edit('content/tutorials/adjust-rear-shifting/tutorial.yaml', (d) => {
        d.tutorial.cases = d.tutorial.cases.filter((x: any) => !x.when['drive.gear_type']?.includes('gearbox'));
      })
      .run();
    const e = errorsOf(r, 'coverage');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].message).toContain('drive.gear_type=gearbox');
    expect(e[0].file).toBe('content/tutorials/adjust-rear-shifting/tutorial.yaml');
  });

  it('an unsafe exit in a step that is not a safety check', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => {
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
      .edit('content/steps/rear-shifting.yaml', (d) => {
        const b = step(d, 'check-cable-tension').buttons.find((x: any) => x.id === 'smooth');
        b.exit = { kind: 'not_needed', text: 'Your gears are fine. Put the bike back on its wheels.', show_how_from: 'release-bike' };
        delete b.text;
      })
      // The step now decides the path, so profiles that reach it must say what the owner taps.
      .edit('profiles/city-derailleur-no-stand.yaml', (d) => (d.profile.journeys[0].tutorial_sees['check-cable-tension'] = 'slow-easier'))
      .edit('profiles/road-bike-stand.yaml', (d) => (d.profile.journeys[0].tutorial_sees['check-cable-tension'] = 'slow-harder'))
      .run();
    expect(show(r)).toBe('');
    const ids = r.flows!.tutorials[0].paths.map((p) => p.id);
    expect(ids).toContain('derailleur.mechanical.stand--not-needed-check-cable-tension-smooth--jump');
  });

  it('a step without a title, and a button without an id', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => {
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
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-b-gap').buttons[1].id = 'small-gap'))
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

  it('a placeholder without fallback wording', () => {
    const r = sandbox()
      .replace('content/steps/rear-shifting.yaml', '{drive.rear_derailleur_model|your derailleur}', '{drive.rear_derailleur_model}')
      .run();
    expect(errorsOf(r, 'placeholder-fallback'), show(r)).toHaveLength(1);
  });

  it('an unknown key, including on: which YAML 1.2 keeps as a string', () => {
    const r = sandbox()
      .replace('content/tutorials/adjust-rear-shifting/cases/wheel-free.yaml', '    outcomes:\n      straight: continue', '    on:\n      straight: continue')
      .run();
    const e = errorsOf(r, 'unknown-key');
    expect(e.length, show(r)).toBeGreaterThan(0);
    expect(e[0].message).toContain('unknown key "on"');
  });

  it('a valid skip adds a path without the skipped step', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-b-gap').buttons[0].skips = ['check-cable-tension']))
      .run();
    expect(show(r)).toBe('');
    const skip = r.flows!.tutorials[0].paths.find((p) => p.id === 'derailleur.mechanical.stand--skip-check-b-gap-small-gap');
    expect(skip, r.flows!.tutorials[0].paths.map((p) => p.id).join('\n')).toBeDefined();
    expect(skip!.variant.items.map((i) => i.id)).not.toContain('check-cable-tension');
  });

  it('a skip over a safety check', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-b-gap').buttons[0].skips = ['check-all-gears']))
      .run();
    const e = errorsOf(r, 'skip-unsafe');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].id).toBe('step check-b-gap');
  });

  it('a skip of a step that is not ahead', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-b-gap').buttons[0].skips = ['shift-to-smallest-sprocket']))
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
      .edit('profiles/city-derailleur-no-stand.yaml', (d) => delete d.profile.journeys[0].tutorial_sees['check-low-limit-by-hand'])
      .run();
    expect(errorsOf(r, 'profile-missing-sees'), show(r)).toHaveLength(1);
  });

  it('writes no bundle when there are errors', () => {
    const b = sandbox().edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-high-limit').tools.required = ['sonic-screwdriver']));
    const r = b.run(true);
    expect(r.issues.errors.length).toBeGreaterThan(0);
    expect(existsSync(join(b.root, 'build/bundle.json'))).toBe(false);
  });

  it('prints every error on one line with file, id and rule', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => {
        step(d, 'check-cable-tension').buttons.push({ id: 'fourth', label: 'Fourth', text: 'x' });
        step(d, 'check-high-limit').tools.required = ['sonic-screwdriver'];
      })
      .run();
    expect(r.issues.errors.length).toBeGreaterThan(0);
    for (const i of r.issues.errors) expect(formatIssue(i)).toMatch(ERROR_LINE);
  });
});
});
