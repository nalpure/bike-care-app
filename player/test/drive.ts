// Drives a profile journey through the player's engine, the way the owner in the profile would tap.
// Shared by the logic test (journeys.test.ts) and kept free of DOM code.
//
// The profile says what the owner knows, answers, has, sees and taps. The driver answers
// exactly that; any screen the profile does not answer fails the journey.

import { Content } from '../src/engine/content.js';
import { Journey, Session, type Screen, type Start } from '../src/engine/journey.js';
import { memoryKV, Store } from '../src/engine/store.js';

export interface Driven {
  ending: string;
  minutes: number;
  screens: string[];
  blocks: number;
  error?: string;
}

export function startOf(j: any): Start {
  if (j.start.diagnosis) return { diagnosis: j.start.diagnosis, params: j.params };
  if (j.start.tutorial) return { tutorial: j.start.tutorial, params: j.params };
  return { check: j.start.check };
}

export function drive(c: Content, profile: any, j: any): Driven {
  const store = new Store(memoryKV());
  const bike = store.addBike(profile.name, profile.facts ?? {});
  store.setTools(profile.tools ?? []);
  const journey = new Journey(c, store, bike, new Session(), startOf(j));
  const out: Driven = { ending: '', minutes: 0, screens: [], blocks: 0 };
  const fail = (msg: string) => {
    out.error = msg;
    out.ending = 'incomplete profile';
    return out;
  };
  let lastCard = '';
  let jumped = false;
  let fromJob = '';
  for (let guard = 0; guard < 400; guard++) {
    const s: Screen = journey.screen();
    out.screens.push(s.kind === 'card' ? `card ${s.card.id}` : s.kind);
    switch (s.kind) {
      case 'position': {
        const v = j.params?.[s.param];
        if (!v) return fail(`no params.${s.param}`);
        journey.answerPosition(s.param, v);
        break;
      }
      case 'question': {
        const answers = profile.answers ?? {};
        if (!(s.key in answers)) return fail(`question ${s.key} has no answer`);
        journey.answerFact(s.key, answers[s.key]);
        break;
      }
      case 'tool-question':
        journey.answerTool(s.tool, (profile.tools ?? []).includes(s.tool));
        break;
      case 'choice': {
        const v = j.choices?.[s.choice.id];
        if (!v) return fail(`run choice ${s.choice.id} has no answer`);
        journey.choose(s.choice.id, v);
        break;
      }
      case 'keep':
        // The owner goes on without saving; the answers still count for this flow.
        journey.keepSkip();
        break;
      case 'parts':
        journey.partsOk();
        break;
      case 'tools':
        journey.startTutorial();
        break;
      case 'card': {
        const card = s.card;
        lastCard = card.id;
        const sees = card.flowKind === 'tutorial' ? j.tutorial_sees ?? {} : j.sees ?? {};
        const want = sees[card.id];
        if (card.chosen === undefined) {
          if (want !== undefined) {
            if (!card.buttons.some((b) => b.id === want)) return fail(`card ${card.id} has no button ${want}`);
            journey.tap(want);
          } else if (!card.nextEnabled) {
            return fail(`card ${card.id} needs a tap, but the journey names none`);
          }
        }
        let now = journey.screen();
        // Where Next answers, a problem the owner tapped is fixed and Next goes on.
        if (now.kind === 'card' && now.card.nextAnswers && now.card.chosenTone === 'bad') out.blocks++;
        if (now.kind === 'card' && !now.card.nextEnabled) {
          // A block: after the fix, the owner taps the good state and goes on.
          out.blocks++;
          const good = now.card.buttons.find((b) => {
            journey.tap(b.id);
            const after = journey.screen();
            if (after.kind === 'card' && after.card.nextEnabled) return true;
            journey.back();
            return false;
          });
          if (!good) return fail(`card ${card.id} blocks and has no good state`);
          now = journey.screen();
        }
        if (now.kind === 'card') journey.next();
        break;
      }
      case 'exit': {
        if (s.canJump) {
          if (j.after_stop === 'show_how') {
            jumped = true;
            journey.exitShowHow();
            break;
          }
          if (j.after_stop === 'find_shop') {
            out.ending = `stop at ${lastCard}`;
            out.minutes = journey.minutes;
            return out;
          }
          return fail(`stop at ${lastCard} with a jump, but no after_stop`);
        }
        out.ending = s.exitKind === 'not_needed' ? `not needed at ${lastCard}` : lastCard ? `exit (${s.exitKind}) at ${lastCard}` : `${s.exitKind} before the first step`;
        out.minutes = journey.minutes;
        return out;
      }
      case 'not-covered':
        out.ending = journey.stageKind === 'diag' ? `not covered (${journey.flowId})` : 'not covered';
        out.minutes = journey.minutes;
        return out;
      case 'job': {
        const choice = s.diy ? j.job_choice : 'shop';
        if (!choice) return fail(`job screen ${s.job.id} without job_choice`);
        fromJob = s.job.title;
        if (choice === 'diy') journey.jobDiy();
        else journey.jobShop();
        break;
      }
      case 'shop':
        out.ending = jumped ? (s.summary.stillSet.length ? 'jump ahead, but something is still set' : 'stop, jump ahead, bike put back, shop') : `shop: ${fromJob || s.summary.title}`;
        out.minutes = journey.minutes;
        return out;
      case 'done':
        out.ending = 'tutorial complete';
        out.minutes = journey.minutes;
        return out;
      case 'todo':
        out.ending = s.items.length ? `${s.items.length} to-do item(s)` : 'no to-do items';
        out.minutes = journey.minutes;
        return out;
      case 'closed':
        return fail('the journey closed without an ending');
    }
  }
  return fail('more than 400 screens');
}
