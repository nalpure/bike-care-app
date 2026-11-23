# Bike maintenance app: repo guide for agents

A phone app that helps a beginner diagnose and fix their bike step by step, with a 3D view of the part. All repair knowledge is YAML in `content/`; `npm run check` validates it and writes `build/bundle.json`; the web app in `player/` plays the bundle. The 3D parts come from source models in `assets-src/` via `tools/assets/`. Mechanics are unverified drafts.

## Which task are you doing?

Load only the guide for your task. Each area has its own `CLAUDE.md` that loads when you work in that folder; the "read first" docs are listed there, not here. Do not read the other areas.

| Task | Go to |
| --- | --- |
| Write or change tutorials, diagnoses, facts, steps, profiles | `content/CLAUDE.md` (also `schema/` for fields) |
| Change the build tool, checks, review output | `tools/CLAUDE.md` |
| Change app behaviour: screens, navigation, journeys, storage | `player/CLAUDE.md`, then `player/src/engine/` or `player/src/ui/` |
| Change the 3D view: bike drawing, camera, animations | `player/src/stage/CLAUDE.md` |
| Change the 3D parts library, or measure or inspect a source model | `tools/assets/CLAUDE.md` |
| Add a part to the 3D library | the `new-part` skill |

One task per session. If your task needs a second area (say a new 3D node that content uses), do the first part, commit, and say in your final message what the next part is.

`docs/open.md` lists what is undecided; read it before changing something it mentions. The product background is `docs/idea.md`, the owner's decisions `docs/decisions.md`; `docs/approach.md` is partly out of date (decisions.md says where). Read them only when your area guide says so or the task is about what the app should do.

## Layout

Folder map: `README.md`. Generated, never edited by hand: `build/`, `player/public/parts/`, `player/src/stage/mounts.ts`, `player/src/stage/rd-rig.ts`. `scratch/` is git-ignored and yours. `legacy/` is reference only, never imported.

## Commands

- `npm run check`  validate, expand, simulate, write `build/`. Must pass before any task is done. Errors print one per line: `ERROR <file>:<line> | <id> | <rule> | <message>`; fix them from the message, you should not need to read the build tool.
- `npm test`       automated tests of the build tool (`tools/test/`) and the player (`player/test/`).
- `npm run dev` / `npm run build`  run the player locally / static build in `dist/`.
- `npm run clean`  delete `scratch/` and `dist/`.
- More, by area: content (`walk`, `review`) in `content/CLAUDE.md`; player (`test:e2e`, `shots`) in `player/CLAUDE.md`; 3D parts (`parts*`, `manifest`) in `tools/assets/CLAUDE.md`.

Use the `verify` skill before you commit.

## Environment (Windows)

- In the Bash tool, Node is not on PATH: prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Run tests only through `npm test`, never `npx vitest` (Vitest fails on the lower-case drive letter VS Code uses; `tools/run-tests.mjs` fixes it).

## Before you write a script or a helper

Look first, then write. The same few needs came up again and again and already have a tool:

| You need | Use |
| --- | --- |
| node names, sizes, boxes, true piece sizes of a source model | `tools/assets/explore/` (`tree.mjs`, `bbox.mjs`, `islands.mjs`) |
| a picture of a source model or GLB | `tools/assets/explore/shot.mjs` |
| axes, pins and mounting points measured on a model | `tools/assets/measure/` (extend it, do not write a second one) |
| parts out of the huge hardtail STEP | `tools/assets/explore/step-extract.mjs` |
| to prove a 3D refactor changed nothing | `tools/stage-digest.ts` |
| pictures of the running app | `npm run shots` (3D views), `npm run test:e2e` (journeys) |
| a content path as the user sees it | `npm run walk` |

- A probe you need only once goes in `scratch/`. One you needed twice gets a header comment (what it does, how to call it) and moves into the tool folder above, or is deleted.
- Edit files with the Edit tool. Do not write patch scripts.
- Pictures cost far more context than text. Prefer a check that prints numbers. Look at a few critical pictures only (see `player/CLAUDE.md`); never keep pictures outside `scratch/`.

## Working on a task

There are no session prompt files and no handoff files. The state of the work lives in four places only:

- **`git log`**: what was done. Commit in logical steps with clear messages.
- **`docs/open.md`**: your own choices and your questions to the owner (below).
- **`docs/decisions.md`**: what the owner decided.
- **The area guides**: how things work. When you learn something the next agent would otherwise pay for again (a trap, a measured fact), add one line to the guide of that area, not to a log.

**Notify the owner.** The owner is often away from the screen. Call `PushNotification` (load it with ToolSearch if needed) as your last action when (a) the task or a part of it is done, or (b) you need an answer before you can go on. One line under 200 characters that leads with what they must do or what happened, e.g. "Tutorial rewrite done, check passes, 2 questions in docs/open.md" or "Need a decision: keep 784 mm bars?". No notification for routine progress. The tool skips itself when the owner is at the terminal; that is fine.

**Wishlist.** When you are done, add an entry to `wishlist.md` only if something slowed you down that could be fixed, or you have an idea that would make future work faster; by default add nothing, only what adds real value. Give each entry an importance from 1 (nice to have) to 3 (costs every session).

A large task: read, then propose the plan in a few lines and the split into parts; the owner answers, and each part ends in commits that leave `npm run check` and `npm test` passing, so a fresh session can start from `git log` and this file.

## Decisions

- **Your own choices are not decisions.** When you choose something without the owner, take the cautious default, carry on, and add it to "Choices made without the owner" in `docs/open.md` (what, the default, where, two lines) and to your final message. Questions you could not settle go under "Questions for the owner" with a recommended answer. Never write your own choice into `decisions.md`, `idea.md` or `approach.md`. Keep `open.md` short: remove an item once the owner has answered it.
- **An owner decision** that will matter for future work gets one or two lines in `docs/decisions.md`, with the date. Say so in your final message. Do not record what the code, the schema or a guide already shows.
- **A doubt about mechanics** goes to `content/review/<job>.md`, never into the content as a fact.
- **A missing schema construct** goes to `docs/schema-requests.md` (hard rule 2).

## Git

Commit in logical steps and push every commit to `origin` right away.

Two sessions may run at the same time in separate checkouts (a git worktree on its own branch, pushing to `main`). Before every push run `git pull --rebase origin main`, then `git push origin HEAD:main`. If files in `build/` conflict, take either side, run `npm run manifest` and `npm run check` again, and commit the result. Never resolve a conflict in `build/` by hand.

## Hard rules

These apply to every task. The numbering is the repo's: rules 4, 5, 6, 11 and 12 are about writing content and live in `content/CLAUDE.md`.

1. Repair content lives in `content/` only. The player contains no repair text and no bike-specific logic.
2. Do not invent schema constructs. If the schema cannot express something, add an entry to `docs/schema-requests.md` and use the closest allowed form. A schema change the owner asks for is not inventing.
3. Never invent safety values (torque, fluid, wear limits, part compatibility). Use a placeholder with wording that sends the user to the part. Dimensions used only to draw (tooth shape, chain width) are drawing data, never presented as facts about a part.
7. Not everything is covered. Any bike, part or symptom outside the content ends on a clear "not covered yet" screen that offers a shop and the assistant. Never show a guess.
8. Do not stop to ask the owner in the middle of a task. Take the cautious default, continue, and report the choice (see Decisions). Questions you have before starting go to the owner in one batch.
9. Mechanics in this repo are unverified drafts. The test build shows a notice saying so.
10. Texts are written in English, short, one action per step, easy to translate into German.
