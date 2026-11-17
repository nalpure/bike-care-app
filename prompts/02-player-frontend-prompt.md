# Prompt 2: the player (frontend to test and share)

## Goal

Build a mobile-first web app that plays `build/bundle.json` and can be shared with friends as a link. The tutorials themselves must feel like the prototype in `legacy/Bikefix-garage-guide v2.html`: one step per screen, a pinned 3D view, highlighted and tappable parts, short clear animations, quick swiping. Also keep a garage, similar to the prototype. You may change anything else as much as you want, but don't spend effort on the shop menus, they may stay a placeholder.

Read `CLAUDE.md`, `docs/idea.md`, `docs/approach.md` (sections "Tutorial rules" and "Player and 3D"), the change files `docs/idea-changes.md` and `docs/approach-changes.md` (they win over the originals), and the prototype's source first. Run `npm run check`, then read `build/review/trees/adjust-rear-shifting.md` (the structure of a tutorial) and two or three files in `build/review/journeys/` (what a user journey contains, screen by screen). `npm run walk -- --list` and `npm run walk -- <path-id>` show any single path.

## Rules

- The player holds no repair text and no bike-specific logic. Everything shown comes from the bundle. If the bundle lacks something you need, write it to `docs/schema-requests.md`; do not hard-code it.
- Vite, TypeScript, three.js. No backend. State in the browser's local storage, wrapped so the app still works when storage is unavailable.
- The player evaluates the bundle's simple conditions. It never plans or reorders steps.
- The player does not re-implement the build's logic; it imports it, so the app and the reviewed output cannot drift apart. Use `tools/lib/conditions.ts` as it is. Move the resolver in `tools/lib/expand.ts` (case selection, procedure implementations, conditional steps, button sets, exits, jump targets, skips) into a shared module that works on `build/bundle.json` instead of the YAML files, and make the build tool use the same module. `npm run check` and `npm test` must pass unchanged after this refactor, and `build/` must not change.

## Screens

1. **Home.** The bike in use (or "Unknown bike"), a list of symptoms, a list of tutorials, "Routine check", and the to-do list for this bike.
2. **Garage, minimal.** Add a bike with a name only. Facts fill in as flows ask. Show and edit the stored facts on a simple sheet, like the prototype's bike record.
3. **Pre-steps,** generated from what a flow needs and skipped when already known: brake or wheel position if the flow has one, missing route facts one question per screen with picture answers and "I'll check later", "Is this needed?", parts, run choices (such as how to hold the bike: options with their note, warning and "recommended" mark; an option that needs a tool shows it), tool picker. Never ask a fact that no condition reads, and never ask a fact marked `ask: never`.
4. **Card.** One component for inspections, steps and checks: 3D stage on top, the card's `title`, text with placeholders filled from known facts (fallback wording otherwise), `details` lines when their facts are known, up to three state buttons, the tapped button's text, "Show solution" when it has one, Next. Swipe and buttons both work. Going back is allowed by hand; nothing jumps back by itself. A button with `skips` leaves out the named later steps.
5. **Progress bar** over the user's own path. It only moves forward, by Next or by the jump-ahead button.
6. **Block.** Next stays disabled until a good state is tapped.
7. **Exit screens,** one per exit kind (`unsafe`, `not_covered`, `not_needed`, `shop_only`; see `approach-changes.md` AC-23 for the buttons of each). When the exit has `show_how_from` and something is apart, the primary button is "Show me how to put it back". The jump-ahead shows a small note that the user jumped ahead in the same tutorial, runs to the end of the sequence, skips `finish`, and ends with the shop summary.
   - **No check twice** (AC-20): an inspection the user already answered in this session is not shown again before the first step of a tutorial; its earlier answer decides the outcome.
   - **Standing warnings:** while a state label with a `warning` is set, show it on every card.
8. **Job screen** after a diagnosis hit or from the to-do list: "Do it myself" with time for this bike and difficulty, and "Take it to a shop" with the text to tell the mechanic, the findings, and the price range (or "no estimate yet").
9. **Not covered.** A clear message that this bike, part or symptom is not covered yet, with "Find a shop" and "Ask the assistant".
10. **Assistant button** floating on every screen. For now it opens a panel that shows the context it would receive (flow, step, facts, state) and says the assistant is not connected yet.
11. **Test notice** on first start: this is a test build and the repair content is not checked by a mechanic.
12. **Feedback.** A small button on every card that saves a note with the flow, the step or inspection id, its review unit id (for example `card:step:check-high-limit`), the path so far and the bike facts, and a screen that exports all notes as text to copy or send. The unit id lets a note be matched to the review files and the ledger.

## 3D

- Take the bike generator, camera moves, highlighting, labels, explore mode, replay and text-only mode from the prototype and split them into modules. Keep the visual quality.
- Parts are named nodes. `focus` highlights nodes, `view` picks a named camera position, session state hides parts that are off the bike.
- Animations come in two kinds: generic motions on a node (`rotate`, `push`, `pull`, `slide`, `squeeze`, `remove`, `insert`) and named clips kept in a clip registry. Port the prototype's limit-screw and cable-tension animations as named clips.
- Export the list of node names, views and clips to `build/3d-manifest.json` so `npm run check` can verify that content only refers to things that exist. Until then the check uses `schema/3d-catalog.yaml`, which was seeded from the prototype and is already used by the content: provide those names, or rename them in the content and the catalog together.
- If a step names a node, view or clip the player lacks, show the whole bike without highlight and log a warning. Never crash, never block the text.
- Parts are chosen by facts where the prototype already supports it (bike type, handlebar, stand or upside down).

## How to work

- Work in small milestones and commit after each: (1) bundle loading and the card with text only, (2) diagnosis, job screen, to-do list, not covered, (3) pre-steps and the tool picker, (4) 3D stage ported, (5) focus, views, clips, state, (6) stop and jump ahead, (7) feedback and the static build.
- After each milestone, start the app, walk through the journey of every file in `profiles/` in a headless mobile-size browser, and take screenshots. Look at them yourself and fix what is broken or ugly before going on.
- Add an automated test that walks every profile journey to its end without errors. Drive it from the journeys in `profiles/` (`sees`, `job_choice`, `choices`, `tutorial_sees` by button id, `after_stop`), and check that each journey ends where `npm run check` says it ends (`build/report.md`, Profiles).
- Do not stop to ask. Record assumptions in `docs/assumptions.md`.

## Done when

- `npm run build` produces a static site that works from a plain file host, on a phone, in both orientations.
- Every profile journey can be completed, including: a not-covered bike, a bike that turns out unsupported during the tutorial (no barrel adjuster), a diagnosis that ends at a shop, a block, an unsafe exit with jump ahead, a check that is not repeated after the diagnosis, and a routine check that creates a to-do item which opens its tutorial.
- Swapping in a changed bundle changes the app without touching player code.
- `docs/sharing.md` explains in a few lines how to publish the build and how testers send their feedback notes.

## Out of scope

Accounts, backend, real assistant, shop search, payments, German texts, native app packaging.
