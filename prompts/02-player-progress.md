# Prompt 2: progress and handoff

Read this after `prompts/02-player-frontend-prompt.md` when you continue the player in a fresh context.
The work is split into three parts, with the context cleared in between (owner decision, 2026-11-17).

| Part | Scope | Status |
| --- | --- | --- |
| 1 | Shared resolver; milestones 1–3; the logic of milestone 6 (exits, jump ahead); journey tests | **done** (2026-11-17) |
| 2 | Milestones 4–5: 3D stage ported from the prototype, focus, views, clips, state, `build/3d-manifest.json` | **done** (2026-11-17) |
| 3 | Milestone 7 (static build polish, `docs/sharing.md`), exit screens with 3D, final screenshot pass in both orientations | next |

## Owner decisions for this prompt

- Stack: Vite + TypeScript + three.js, no UI framework (plain TS renders each screen). No React, no Next.js.
- Hosting: Netlify for now. `docs/sharing.md` (part 3) describes Netlify (drag `dist/` onto Netlify Drop, or `netlify deploy --prod --dir dist`; the repo stays private) and, as the alternative when access must be limited, Cloudflare Pages with Cloudflare Access (free up to 50 users, email one-time PIN). The build already ships `robots.txt` and a `noindex` meta tag.
- Feedback notes: copied or shared as text by the tester; no address built in.
- Playwright with Chromium is a dev dependency. The logic walk is in `npm test`; the browser walk is `npm run test:e2e`.
- `tools/lib/journeys.ts` stays an independent implementation; the player tests compare against it.

## What exists

- `tools/lib/resolve.ts`: the resolver and path enumeration, shared by build and player, working on bundle data.
- `player/src/engine/`: no DOM. `content.ts`, `store.ts`, `journey.ts` (the state machine). Each card's `stage` carries `focus`, `view`, `animation`, `labels` (after the card) and `labelsBefore`.
- `player/src/ui/`: `app.ts` (shell, overlays), `home.ts`, `flow.ts` (every journey screen and the card; calls `stage.show()` with the card id, tapped button and bike name), `stage.ts` (the `Stage` interface and the text `PlaceholderStage`, used when the 3D stage cannot start), `dom.ts`.
- `player/src/stage/` (part 2, AC-27):
  - `registry.ts`: pure data. Every node (with tag label, name, aliases, one-line "what it does"), which parts a node stands for, views, clips, motions, and `LABEL_SCENES` (state label -> how the bike is held). `manifest()` is what `npm run manifest` writes to `build/3d-manifest.json`.
  - `bike.ts`: `bikeSpec(facts)` (ported `toBike`; category -> frame, bar, fork, barrel position, kickstand; gear type -> derailleur or one sprocket; `drive.rear_speeds` -> sprockets) and `BikeModel` (ported `buildBike`, `buildStand`, `updateDer`; plus hook and rope, crankset and hubs that turn, the chain that runs along its path).
  - `chain.ts` (ported `buildPath`), `views.ts` (named camera poses; `whole_bike` in world space, close-ups in bike space so they follow a lifted or turned bike).
  - `anim.ts`: clips `shift-to-smallest`, `shift-to-largest`, `limit-screw-align`, `b-gap-adjust`, `cable-tension-shift`, and the generic motions. A rotate on `h_screw`, `l_screw`, `b_screw` or `barrel_adjuster` plays the matching clip in the given direction (A-28). Motions on `bike` animate between ways of holding it.
  - `three-stage.ts`: `ThreeStage` implements `Stage`. r128 look kept (colour management off, lights x pi). Pose from labels (union of before and after during a step), focus fade by context groups, tags, caption, ghost marker and turn arrow, explore mode with OrbitControls and the part card, replay (restarts the step animation), solutions (play `card.solution` in turn, loop). Unknown names: whole bike, no highlight, `console.warn` once. No WebGL: a text box with the parts in focus.
- `tools/export-3d-manifest.ts` (`npm run manifest`). `npm run check` reports "3D names checked against: build/3d-manifest.json".
- Content: the H screw, B screw and cable solutions in `content/steps/rear-shifting.yaml` are generic rotate motions with a direction (a clip takes no direction; build rule `animation-kind`).
- Tests: `player/test/stage.test.ts` (manifest equals registry, catalog names provided, every node built, every view, clip and motion plays, directions) besides the part 1 tests. `player/e2e/run.ts` launches Chromium with SwiftShader flags so WebGL renders headless.
- Docs: AC-27; assumptions A-26 to A-30; schema requests SR-05 (state label scene), SR-06 (part names in content), SR-07 (direction vocabulary).

## Part 3: what to do

1. Exit screens with 3D: the exit, not-covered and done screens have no stage yet. Decide whether an exit with something apart shows the stage (bike still held, what to put back highlighted). Keep it optional: the screen must read well without it.
2. Milestone 7: static build polish (`npm run build`, open `dist/` from a plain file host, phone in both orientations), `docs/sharing.md` (Netlify and Cloudflare Pages + Access, how testers send notes).
3. Final screenshot pass in both orientations. The e2e screenshots are taken right after each click, so fades and camera flights are often mid-way; for a careful look wait about 2 s per card (a small script that drives `window.__app` is quick to write). Look at: the B gap view (`derailleur_side_close`, the gap bar is small), tags that overlap on close views, the from-behind view (the tyre takes a lot of room), landscape on a short phone.
4. After each step: `npm run check`, `npm test`, `npm run test:e2e` (from the repo root, never with the shell inside `player/e2e/shots/`), look at the screenshots, fix, commit.

## Known gaps and notes

- Shop search and the Shop tab are placeholders by design.
- The bike sheet labels facts by their question until SR-02 is decided; question pictures are grey tiles until SR-03.
- The garage has no 3D preview of the bike (the prototype had one on the bike sheet); not required.
- Cargo bikes are drawn as city bikes; hub gears and gearboxes simply (one sprocket); there is no full-suspension frame (no fact selects it).
- With reduced motion the camera and the bike's pose jump instead of flying; animations still loop, as in the prototype.
- After changing `registry.ts`, run `npm run manifest` and `npm run check`; the stage test fails until the manifest matches.
- The e2e test does not swipe; swipe is wired in `flow.ts` (`attachSwipe`) for touch pointers only.
- `npm audit` reports a ReDoS in `picomatch` (dev tools only, nothing in `dist/`).
- On Windows run Vitest only through `npm test` (see the repo memory about the drive letter).
