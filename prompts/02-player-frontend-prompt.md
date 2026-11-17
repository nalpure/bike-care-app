# Prompt 2: the player (frontend to test and share)

## Goal

Build a mobile-first web app that plays `build/bundle.json` and can be shared with friends as a link. The tutorials themselves must feel like the prototype in `legacy/Bikefix-garage-guide v2.html`: one step per screen, a pinned 3D view, highlighted and tappable parts, short clear animations, quick swiping. Also keep a garage, similar to the prototype. You may change anything else as much as you want, but don't spend effort on the shop menus, they may stay a placeholder.

Read `CLAUDE.md`, `docs/idea.md`, `docs/approach.md` (sections "Tutorial rules" and "Player and 3D") and the prototype's source first. Run `npm run check` and read two or three files in `build/walkthroughs/profiles/` to see what a user journey contains.

## Rules

- The player holds no repair text and no bike-specific logic. Everything shown comes from the bundle. If the bundle lacks something you need, write it to `docs/schema-requests.md`; do not hard-code it.
- Vite, TypeScript, three.js. No backend. State in the browser's local storage, wrapped so the app still works when storage is unavailable.
- The player evaluates the bundle's simple conditions. It never plans or reorders steps.

## Screens

1. **Home.** The bike in use (or "Unknown bike"), a list of symptoms, a list of tutorials, "Routine check", and the to-do list for this bike.
2. **Garage, minimal.** Add a bike with a name only. Facts fill in as flows ask. Show and edit the stored facts on a simple sheet, like the prototype's bike record.
3. **Pre-steps,** generated from what a flow needs and skipped when already known: brake or wheel position if the flow has one, missing route facts one question per screen with "I'll check later", "Is this needed?", parts, tool picker.
4. **Card.** One component for inspections, steps and checks: 3D stage on top, text, up to three state buttons, the tapped button's text, "Show solution" when it has one, Next. Swipe and buttons both work. Going back is allowed by hand; nothing jumps back by itself.
5. **Progress bar** over the user's own path. It only moves forward, by Next or by the jump-ahead button.
6. **Block.** Next stays disabled until a good state is tapped.
7. **Stop screen.** The message, a primary button "Show me how to put it back" when the stop has `show_how_from`, and "Find a shop". The jump-ahead shows a small note that the user jumped ahead in the same tutorial, runs to the end of the sequence, skips `finish`, and ends with the shop summary.
8. **Job screen** after a diagnosis hit or from the to-do list: "Do it myself" with time for this bike and difficulty, and "Take it to a shop" with the text to tell the mechanic, the findings, and the price range (or "no estimate yet").
9. **Not covered.** A clear message that this bike, part or symptom is not covered yet, with "Find a shop" and "Ask the assistant".
10. **Assistant button** floating on every screen. For now it opens a panel that shows the context it would receive (flow, step, facts, state) and says the assistant is not connected yet.
11. **Test notice** on first start: this is a test build and the repair content is not checked by a mechanic.
12. **Feedback.** A small button on every card that saves a note with the flow, step and bike facts, and a screen that exports all notes as text to copy or send.

## 3D

- Take the bike generator, camera moves, highlighting, labels, explore mode, replay and text-only mode from the prototype and split them into modules. Keep the visual quality.
- Parts are named nodes. `focus` highlights nodes, `view` picks a named camera position, session state hides parts that are off the bike.
- Animations come in two kinds: generic motions on a node (`rotate`, `push`, `pull`, `slide`, `squeeze`, `remove`, `insert`) and named clips kept in a clip registry. Port the prototype's limit-screw and cable-tension animations as named clips.
- Export the list of node names, views and clips to `build/3d-manifest.json` so `npm run check` can verify that content only refers to things that exist.
- If a step names a node, view or clip the player lacks, show the whole bike without highlight and log a warning. Never crash, never block the text.
- Parts are chosen by facts where the prototype already supports it (bike type, handlebar, stand or upside down).

## How to work

- Work in small milestones and commit after each: (1) bundle loading and the card with text only, (2) diagnosis, job screen, to-do list, not covered, (3) pre-steps and the tool picker, (4) 3D stage ported, (5) focus, views, clips, state, (6) stop and jump ahead, (7) feedback and the static build.
- After each milestone, start the app, walk through the journey of every file in `profiles/` in a headless mobile-size browser, and take screenshots. Look at them yourself and fix what is broken or ugly before going on.
- Add an automated test that walks every profile journey to its end without errors.
- Do not stop to ask. Record assumptions in `docs/assumptions.md`.

## Done when

- `npm run build` produces a static site that works from a plain file host, on a phone, in both orientations.
- Every profile journey can be completed, including: a not-covered bike, a diagnosis that ends at a shop, a block, a stop with jump ahead, and a routine check that creates a to-do item which opens its tutorial.
- Swapping in a changed bundle changes the app without touching player code.
- `docs/sharing.md` explains in a few lines how to publish the build and how testers send their feedback notes.

## Out of scope

Accounts, backend, real assistant, shop search, payments, German texts, native app packaging.
