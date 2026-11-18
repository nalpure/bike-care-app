# Bike maintenance app: repo guide for agents

Read `docs/idea.md` (what the app is) and `docs/approach.md` (how content and player work) before any task, each together with its change file: `docs/idea-changes.md` and `docs/approach-changes.md`. The change files use the same sections as the originals and win where they disagree. All of these win over anything in `legacy/`.

## Layout

```
docs/            idea.md, approach.md, idea-changes.md, approach-changes.md,
                 assumptions.md, schema-requests.md, sharing.md (publishing test builds)
legacy/          old prototype HTML and the brake pad YAML drafts. Reference only, never imported.
schema/          JSON Schema for every content file (*.schema.json), 3d-catalog.yaml
content/         facts.yaml, choices.yaml, states.yaml, tools.yaml, inspections.yaml, jobs.yaml,
                 steps/, procedures.yaml, tutorials/<job>/, diagnoses/, checks/, review/
profiles/        test bikes (facts, answers, tools, journeys), one YAML each. Only for review.
reviews/         ledger.yaml: sign-offs of review units (append only, via npm run review -- sign)
tools/           build script: validate, expand, simulate, review files, bundle (tools/check.ts),
                 walk.ts (paths on demand), review.ts (review status and sign-off).
                 tools/lib/conditions.ts and tools/lib/resolve.ts are shared with the player:
                 dependency-free, they work on bundle data. Change them only with both in mind.
build/           generated, never edited by hand: bundle.json, report.md, 3d-manifest.json,
                 review/ (index.md, cards.md, trees/, journeys/); paths/ is on demand and not committed
player/          the web app (Vite, TypeScript, three.js). Read player/README.md before changing it.
.claude/         subagent definitions, commands, hooks for the content workflow
```

The golden example is the symptom "My gears don't shift cleanly": `content/diagnoses/gears-shift-badly.yaml`, `content/tutorials/adjust-rear-shifting/`, and what it produces in `build/review/`.

## Commands

- `npm run check`  validate, expand, simulate, write `build/`. Must pass before any task is done.
- `npm test`       automated tests of the build tool (`tools/test/`) and the player (`player/test/`).
- `npm run walk -- --list` / `npm run walk -- <path-id>`   render paths on demand.
- `npm run review -- status` / `npm run review -- sign <unit> --role <role> --by <name>`   review units and sign-offs.
- `npm run dev`    start the player locally.
- `npm run build`  static build of the player for sharing (`dist/`).
- `npm run manifest`  write `build/3d-manifest.json` (the 3D nodes, views and clips content may use) from the player's registry.
- `npm run test:e2e`  build the player and click through every profile journey in a phone-sized browser; screenshots in `player/e2e/shots/`.

Errors print one per line: `ERROR <file>:<line> | <id> | <rule> | <message>`. Fix them from the message; you should not need to read the build tool.

## Reviewing content

Review units, not paths: cards (`build/review/cards.md`), flow trees (`build/review/trees/`) and profile journeys (`build/review/journeys/`). Each has a hash; a sign-off in `reviews/ledger.yaml` holds while the hash is unchanged. Findings name the unit id, and the path id when it came from a single path. Never edit the ledger by hand except to append; never sign a unit you did not read.

## Recording decisions

- A decision that changes, extends or clarifies `idea.md` or `approach.md` goes into `docs/idea-changes.md` or `docs/approach-changes.md`, under the same section heading as in the original, with the next free id, the date, who decided, what the original says, what holds now, and why. Owner decisions about intent and user experience go to `idea-changes.md`; how it is built goes to `approach-changes.md`.
- An assumption you make without the owner goes to `docs/assumptions.md` (hard rule 8).
- A doubt about mechanics goes to `content/review/<job>.md`, never into the content as a fact.

## Git

Commit in logical steps and push every commit to `origin` (`git push`) right away.

## Hard rules

1. Repair content lives in `content/` only. The player contains no repair text and no bike-specific logic.
2. Do not invent schema constructs. If the schema cannot express something, add an entry to `docs/schema-requests.md` and use the closest allowed form.
3. Never invent safety values (torque, fluid, wear limits, part compatibility). Use a placeholder with wording that sends the user to the part.
4. At most three state buttons per screen. Labels describe what the user sees, never a technical judgement.
5. `block` and `exit: { kind: unsafe }` only in safety checks and inspection calls. Any exit (unsafe, not_covered, not_needed, shop_only) reached with something apart (or the bike not ready to ride) names what to put back and has `show_how_from`.
6. Diagnoses and the routine check use only `hands_off` inspections.
7. Not everything is covered. Any bike, part or symptom outside the content ends on a clear "not covered yet" screen that offers a shop and the assistant. Never show a guess.
8. Do not stop to ask the owner. Write the assumption with a cautious default to `docs/assumptions.md` and continue.
9. Mechanics in this repo are unverified drafts. The test build shows a notice saying so.
10. Texts are written in English, short, one action per step, easy to translate into German.
11. Ask only what changes the steps. A fact read by a condition must have a question, unless it is `ask: never` (a beginner cannot tell; it comes only from the bike's data). Any other fact is only used in text when it is known (`{fact.key|fallback}` or `details`).
12. Never the same check twice in a session. An inspection the user already answered is not shown again before the work starts; after the work, a check is a re-check and is shown.
