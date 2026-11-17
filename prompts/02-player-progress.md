# Prompt 2: progress and handoff

Read this after `prompts/02-player-frontend-prompt.md` when you continue the player in a fresh context.
The work is split into three parts, with the context cleared in between (owner decision, 2026-11-17).

| Part | Scope | Status |
| --- | --- | --- |
| 1 | Shared resolver; milestones 1–3; the logic of milestone 6 (exits, jump ahead); journey tests | **done** (2026-11-17) |
| 2 | Milestones 4–5: 3D stage ported from the prototype, focus, views, clips, state, `build/3d-manifest.json` | next |
| 3 | Milestone 7 (static build polish, `docs/sharing.md`), exit screens with 3D, final screenshot pass in both orientations | open |

## Owner decisions for this prompt

- Stack: Vite + TypeScript + three.js, no UI framework (plain TS renders each screen). No React, no Next.js.
- Hosting: Netlify for now. `docs/sharing.md` (part 3) describes Netlify (drag `dist/` onto Netlify Drop, or `netlify deploy --prod --dir dist`; the repo stays private) and, as the alternative when access must be limited, Cloudflare Pages with Cloudflare Access (free up to 50 users, email one-time PIN). The build already ships `robots.txt` and a `noindex` meta tag.
- Feedback notes: copied or shared as text by the tester; no address built in.
- Playwright with Chromium is a dev dependency. The logic walk is in `npm test`; the browser walk is `npm run test:e2e`.
- `tools/lib/journeys.ts` stays an independent implementation; the player tests compare against it.

## What exists

- `tools/lib/resolve.ts`: the resolver and path enumeration, shared by build and player, working on bundle data. The build maps bundle objects back to YAML lines (`tools/lib/bundle.ts`). `build/` did not change in the refactor.
- `player/src/engine/`: no DOM. `content.ts` (bundle lookups, text filling), `store.ts` (local storage, wrapped; bikes, findings, to-dos, notes), `journey.ts` (the state machine for diagnosis, routine check, job screen, tutorial pre-steps and cards, exits, jump ahead, skips, no check twice, back by hand with snapshots).
- `player/src/ui/`: `app.ts` (shell, tabs, overlays: notice, assistant, feedback), `home.ts` (home, garage, bike sheet, shop placeholder, notes), `flow.ts` (every journey screen and the card), `stage.ts` (the `Stage` interface and a text placeholder), `dom.ts`.
- The bundle is fetched at start (`./bundle.json`); `player/vite.config.ts` serves it in dev and copies it into `dist/`.
- Tests: `player/test/journeys.test.ts` (every profile journey through the engine; ending and minutes equal `npm run check`), `player/test/engine.test.ts` (skips, standing warnings, block, progress), `tools/test/resolve.test.ts` (resolver on the written bundle equals the build). `player/e2e/run.ts` clicks every journey in portrait and landscape and checks endings against `build/report.md`.
- Docs: assumptions A-16 to A-25, schema requests SR-02 to SR-04.

## Part 2: what to do

1. Port the prototype's 3D (`legacy/Bikefix-garage-guide v2.html`, from about line 1264: `buildPath`, the three.js setup, bike generator `toBike`, camera flights, highlight and fade, tags, tappable parts with `META` names, explore mode, replay) into `player/src/stage/` modules. Implement the existing `Stage` interface in `player/src/ui/stage.ts` (its `el` must persist across renders so the canvas stays pinned) and swap it in `player/src/main.ts`. Keep the visual quality; three.js is now r187 from npm (watch colour management and light intensity changes since r128).
2. Name the nodes, views and clips exactly as in `schema/3d-catalog.yaml`, or rename in content and catalog together. Port `limit-screw-align`, `b-gap-adjust`, `cable-tension-shift`, `shift-to-smallest`, `shift-to-largest` as named clips; the generic motions are `rotate, push, pull, slide, squeeze, remove, insert`.
3. A missing node, view or clip: whole bike, no highlight, `console.warn`, never a crash.
4. Parts by facts where the prototype supports it (`bike.category` -> frame and handlebar; stand or upside down from the run choice; the stage receives `facts` and `labels`).
5. Session state hides parts: there is no label -> node mapping in the content yet. Add a schema request (or propose `nodes_hidden` on state labels) and use the closest form; today's labels are `bike_in_stand`, `bike_hung`, `bike_upside_down` (show the stand, the hook, or the bike turned over).
6. Export `build/3d-manifest.json` (nodes, views, clips, motions) from the player's registry with a script, and make sure `npm run check` passes with it (the loader in `tools/lib/content.ts` already prefers it).
7. "Show solution" plays `card.solution` on the stage; the replay button replays the step animation.
8. After each milestone: `npm run check`, `npm test`, `npm run test:e2e` (from the repo root, never with the shell inside `player/e2e/shots/`), look at the screenshots, fix, commit.

## Known gaps and notes

- Shop search and the Shop tab are placeholders by design.
- The bike sheet labels facts by their question until SR-02 is decided; question pictures are grey tiles until SR-03.
- The e2e test does not swipe; swipe is wired in `flow.ts` (`attachSwipe`) for touch pointers only.
- `npm audit` reports a ReDoS in `picomatch` (dev tools only, nothing in `dist/`).
- On Windows run Vitest only through `npm test` (see the repo memory about the drive letter).
