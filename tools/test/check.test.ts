// Tests of the build tool. Each test breaks one rule on purpose in a copy of the real content
// and expects a one-line error that names the file, the id and the rule.

import { existsSync } from 'node:fs';
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
    expect(t.paths).toHaveLength(21);
    expect(t.paths.filter((p) => p.variant.ending === 'complete').map((p) => p.id)).toEqual([
      'derailleur.mechanical.stand',
      'derailleur.mechanical.hang',
      'derailleur.mechanical.upside-down',
      'derailleur.mechanical.ground',
    ]);
    expect(t.paths.filter((p) => p.variant.ending === 'jump')).toHaveLength(3);
    expect(t.exits.map((e) => e.exit.kind)).toEqual(Array(6).fill('not_covered'));
    const d = r.flows!.diagnoses.find((f) => f.id === 'gears-shift-badly')!;
    expect(d.paths).toHaveLength(6);

    const endings = Object.fromEntries([...r.profiles.values()].flatMap((p) => p.results.map((x) => [`${x.profile}/${x.journey}`, x.ending])));
    expect(endings).toEqual({
      'city-derailleur-no-stand/slow-shifting-upside-down': 'tutorial complete',
      'city-derailleur-no-stand/bent-derailleur': 'shop: Have the rear gears checked',
      'e-trekking-hub-gear/hub-gear-not-covered': 'not covered (gears-shift-badly)',
      'road-bike-stand/chain-touches-spokes': 'stop, jump ahead, bike put back, shop',
      'road-bike-stand/routine-check-dirty-chain': '1 to-do item(s)',
      'unknown-bike/test-rides': 'tutorial complete',
    });
  });

  it('writes the bundle, the report and the walkthroughs', () => {
    const b = sandbox();
    const r = b.run(true);
    expect(show(r)).toBe('');
    for (const rel of [
      'build/bundle.json',
      'build/report.md',
      'build/walkthroughs/adjust-rear-shifting/derailleur.mechanical.stand.md',
      'build/walkthroughs/gears-shift-badly/derailleur.mechanical--no-hit.md',
      'build/walkthroughs/routine-check/routine-check.md',
      'build/walkthroughs/profiles/unknown-bike.md',
    ]) {
      expect(existsSync(join(b.root, rel)), rel).toBe(true);
    }
    const bundle = JSON.parse(r.bundle!);
    expect(bundle.unverified).toBe(true);
    expect(bundle.tutorials[0].cases[0].cases[0].case.sequence.length).toBeGreaterThan(5);
  });

  it('is deterministic', () => {
    const a = runCheck(REPO, { write: false });
    const b = runCheck(REPO, { write: false });
    expect(a.report).toBe(b.report);
    expect(a.bundle).toBe(b.bundle);
  });
});

describe('rules broken on purpose', () => {
  it('a fourth button', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => step(d, 'check-cable-tension').buttons.push({ label: 'It makes a strange noise', text: 'Listen again.' }))
      .run();
    const e = errorsOf(r, 'max-buttons');
    expect(e, show(r)).toHaveLength(1);
    expect(e[0].file).toBe('content/steps/rear-shifting.yaml');
    expect(e[0].id).toBe('step check-cable-tension');
    expect(e[0].message).toContain('at most 3');
  });

  it('a stop reached with the bike held, without show_how_from', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => {
        const b = step(d, 'check-all-gears').buttons.find((x: any) => x.stop);
        delete b.show_how_from;
      })
      .run();
    const e = errorsOf(r, 'stop-needs-show-how-from');
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

  it('a show_how_from that does not lie ahead', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => (step(d, 'check-all-gears').buttons.find((x: any) => x.stop).show_how_from = 'find-barrel-adjuster'))
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

  it('a stop in a step that is not a safety check', () => {
    const r = sandbox()
      .edit('content/steps/rear-shifting.yaml', (d) => {
        const b = step(d, 'check-cable-tension').buttons[0];
        delete b.text;
        delete b.solution;
        b.stop = 'Take it to a shop.';
      })
      .run();
    expect(errorsOf(r, 'block-stop-only-in-safety-checks'), show(r)).toHaveLength(1);
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
      .edit('profiles/city-derailleur-no-stand.yaml', (d) => delete d.profile.journeys[0].tutorial_sees['check-low-limit'])
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
        step(d, 'check-cable-tension').buttons.push({ label: 'Fourth', text: 'x' });
        step(d, 'check-high-limit').tools.required = ['sonic-screwdriver'];
      })
      .run();
    expect(r.issues.errors.length).toBeGreaterThan(0);
    for (const i of r.issues.errors) expect(formatIssue(i)).toMatch(ERROR_LINE);
  });
});
});
