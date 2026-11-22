# Bike maintenance app: repo guide for agents

Before any task, read `docs/idea.md` (what the app should be) and `docs/decisions.md` (owner decisions since then, and where `approach.md` is out of date). For work on content or the build tool, also read `docs/approach.md`, sections "Building blocks" to "Build tool". These win over anything in `legacy/`.

Each area has its own guide, loaded when you work there: `content/CLAUDE.md` (writing content), `tools/CLAUDE.md` (build tool), `player/CLAUDE.md` (the app and the 3D view). If you were given a session prompt in `prompts/`, read it and its plan before starting.

## Layout

```
docs/            idea.md, approach.md, decisions.md, schema-requests.md, sharing.md (publishing test builds)
legacy/          old prototype HTML and the brake pad YAML drafts. Reference only, never imported.
assets-src/      source 3D models (CC BY, see each credit.txt); the parts library is built from them by tools/assets/
schema/          JSON Schema for every content file (*.schema.json). The reference for every field.
content/         facts.yaml, choices.yaml, states.yaml, tools.yaml, inspections.yaml, jobs.yaml,
                 steps/, procedures.yaml, tutorials/<job>/, diagnoses/, checks/, review/
profiles/        test bikes (facts, answers, tools, journeys), one YAML each
reviews/         ledger.yaml: sign-offs of review units (append only, via npm run review -- sign)
tools/           build tool (tools/check.ts), walk.ts (paths on demand), review.ts (review status and sign-off),
                 assets/ (parts library: library.yaml, build-library.ts, check-library.ts, explore/ scripts)
build/           generated, never edited by hand: bundle.json, report.md, 3d-manifest.json,
                 review/ (index.md, cards.md, trees/, journeys/); paths/ is on demand and not committed
player/          the web app (Vite, TypeScript, three.js)
prompts/         session prompts and their handoff files (*-progress.md). 01 and 02 are done and only history.
.claude/skills/  verify (check, tests, e2e, screenshots), handoff (write the progress file, commit, push)
```

The golden example is the symptom "My gears don't shift cleanly": `content/diagnoses/gears-shift-badly.yaml`, `content/tutorials/adjust-rear-shifting/`, and what it produces in `build/review/`.

## Commands

- `npm run check`  validate, expand, simulate, write `build/`. Must pass before any task is done.
- `npm test`       automated tests of the build tool (`tools/test/`) and the player (`player/test/`).
- `npm run walk -- --list` / `npm run walk -- <path-id>`   render paths on demand.
- `npm run review -- status` / `npm run review -- sign <unit> --role <role> --by <name>`   review units and sign-offs.
- `npm run dev`    start the player locally.
- `npm run build`  static build of the player for sharing (`dist/`).
- `npm run parts`  build the 3D parts library (`player/public/parts/`) from `assets-src/`; `npm run parts:check` compares every part with its source model and checks the budget.
- `npm run parts:mounts`  measure where the crank, saddle, collar, stem, bar and grips mount on the built library and write `player/src/stage/mounts.ts`.
- `npm run parts:rig`  measure the derailleur rig on the source model and write `player/src/stage/rd-rig.ts`.
- `npm run manifest`  write `build/3d-manifest.json` (the 3D nodes, views and clips content may use) from the player's registry.
- `npm run test:e2e`  build the player and click through every profile journey in a phone-sized browser; screenshots in `player/e2e/shots/`.

Errors print one per line: `ERROR <file>:<line> | <id> | <rule> | <message>`. Fix them from the message; you should not need to read the build tool. Use the `verify` skill before you commit and the `handoff` skill at the end of a session part.

## Environment (Windows)

- In the Bash tool, Node is not on PATH: prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Run tests only through `npm test`, never `npx vitest` (Vitest fails on the lower-case drive letter VS Code uses; `tools/run-tests.mjs` fixes it).

## Reviewing content

Review units, not paths: cards (`build/review/cards.md`), flow trees (`build/review/trees/`) and profile journeys (`build/review/journeys/`). Each has a hash; a sign-off in `reviews/ledger.yaml` holds while the hash is unchanged. Findings name the unit id, and the path id when it came from a single path. Never edit the ledger by hand except to append; never sign a unit you did not read.

## Decisions

- **Your own choices never go into `docs/`.** When you choose something without the owner, take the cautious default, carry on, and list the choice (what, the default, where) in your handoff file and your final message. The owner decides whether it stays.
- **An owner decision** that will matter for future work gets one or two lines in `docs/decisions.md`, with the date. Say so in your final message. Do not record what the code, the schema or a guide already shows.
- **A doubt about mechanics** goes to `content/review/<job>.md`, never into the content as a fact.
- **A missing schema construct** goes to `docs/schema-requests.md` (hard rule 2).

## Git

Commit in logical steps and push every commit to `origin` right away.

Two sessions may run at the same time in separate checkouts (a git worktree on its own branch, pushing to `main`). Before every push run `git pull --rebase origin main`, then `git push origin HEAD:main`. If files in `build/` conflict, take either side, run `npm run manifest` and `npm run check` again, and commit the result. Never resolve a conflict in `build/` by hand.

## Hard rules

1. Repair content lives in `content/` only. The player contains no repair text and no bike-specific logic.
2. Do not invent schema constructs. If the schema cannot express something, add an entry to `docs/schema-requests.md` and use the closest allowed form. A session prompt may give you a schema change to make; that is not inventing.
3. Never invent safety values (torque, fluid, wear limits, part compatibility). Use a placeholder with wording that sends the user to the part.
4. At most three state buttons per screen. Labels describe what the user sees, never a technical judgement.
5. `block` and `exit: { kind: unsafe }` only in safety checks and inspection calls. Any exit (unsafe, not_covered, not_needed, shop_only) reached with something apart (or the bike not ready to ride) names what to put back and has `show_how_from`.
6. Diagnoses and the routine check use only `hands_off` inspections.
7. Not everything is covered. Any bike, part or symptom outside the content ends on a clear "not covered yet" screen that offers a shop and the assistant. Never show a guess.
8. Do not stop to ask the owner in the middle of a task. Take the cautious default, continue, and report the choice (see Decisions). Questions you have before starting go to the owner in one batch.
9. Mechanics in this repo are unverified drafts. The test build shows a notice saying so.
10. Texts are written in English, short, one action per step, easy to translate into German.
11. Ask only what changes the steps. A fact read by a condition must have a question, unless it is `ask: never` (a beginner cannot tell; it comes only from the bike's data). Any other fact is only used in text when it is known (`{fact.key|fallback}` or `details`).
12. Never the same check twice in a session. An inspection the user already answered is not shown again before the work starts; after the work, a check is a re-check and is shown.
