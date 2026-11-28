# Map of the repo

Every agent reads this first. It says where things are and which guide or skill to load; how an area works is in that area's `CLAUDE.md`, next to its code. Load only the guide for your task.

## How data flows

```
 content/ + profiles/ + schema/ ──► npm run check ──► build/bundle.json ───────► player/ (the app)
 repair text (YAML), test bikes,    (tools/check.ts)   build/review/  what reviewers read
 the JSON Schema of every field            ▲           build/report.md  paths, times, shop share, rules
                                           │
 player/src/stage/registry.ts ──► npm run manifest ──► build/3d-manifest.json  (the 3D names content may use)

 assets-src/ (source models) ──► npm run parts ──► player/public/parts/ (parts library) ──► player/src/stage/ (3D view)
                                 npm run parts:mounts, parts:rig ──► player/src/stage/mounts.ts, rd-rig.ts
```

- All repair knowledge lives in `content/`; the player reads only the bundle (hard rule 1). It evaluates conditions with the build tool's own code (`tools/lib/conditions.ts`, `resolve.ts`), so the app and the reviewed output cannot drift apart. Nothing is planned on the phone.
- The test bikes' journeys run twice: in the build (`tools/lib/journeys.ts`, written to `build/review/journeys/`) and in the player tests, which compare the app with them.
- The words content, build tool and app share (fact, check, card, job, flow, finding …): `docs/architecture/content-model.md`.

## Areas and folders

| Area | Folders |
| --- | --- |
| Content | `content/` (one file per job in `jobs/`, shared blocks beside it), `profiles/` (test bikes), `schema/` (every field) |
| Build tool | `tools/` (`check.ts`, `lib/`, `walk.ts`, `review.ts`, `test/`) |
| App | `player/` (`src/engine/` journey and storage, no DOM; `src/ui/` screens; `test/`, `e2e/`) |
| 3D view | `player/src/stage/` (also `library.md`, `gaps.md`) |
| Parts library | `tools/assets/`, `assets-src/` (source models, CC BY; `overview.md` has the owner's notes on each) |

- **Generated, never edited by hand:** `build/`, `player/public/parts/`, `player/src/stage/mounts.ts`, `player/src/stage/rd-rig.ts`.
- `reviews/ledger.yaml`: review sign-offs. `scratch/`: git-ignored, yours (`npm run clean` empties it). `legacy/`: the old prototype, reference only, never imported. `wishlist.md`: agents' ideas for faster work.

## Which guide, which skill

| Task | Guide | Skill |
| --- | --- | --- |
| Tutorials, diagnoses, the routine check, facts, cards, checks, test bikes | `content/CLAUDE.md`, `schema/` for fields | `change-content` |
| The build tool, its rules, the review output | `tools/CLAUDE.md` | |
| App behaviour: screens, navigation, journeys, storage | `player/CLAUDE.md`, then `src/engine/CLAUDE.md` or `src/ui/CLAUDE.md` | |
| The 3D view: bike drawing, camera, animations | `player/src/stage/CLAUDE.md` | `check-3d` |
| The parts library, measuring or inspecting a source model | `tools/assets/CLAUDE.md` | `new-part` (add a part) |
| Publish the test build | `docs/sharing.md` | `deploy-test-build` |
| Before every commit | | `verify` |
| The end of every task | | `finish-task` |

## Commands

`npm run check` (validate, expand, simulate, write `build/`; must pass before a task is done; errors print `ERROR <file>:<line> | <id> | <rule> | <message>`, fix them from the message), `npm test` (build tool and player tests), `npm run typecheck`, `npm run dev` / `npm run build` (run the app / static build in `dist/`), `npm run clean`. By area: `walk`, `review` in the `change-content` skill; `test:e2e`, `shots` in `player/CLAUDE.md`; `parts*`, `manifest` in `tools/assets/CLAUDE.md`.

## Tools that already exist

Look first, then write. These needs came up again and again:

| You need | Use |
| --- | --- |
| node names, sizes, boxes, true piece sizes of a source model | `tools/assets/explore/` (`tree.mjs`, `bbox.mjs`, `islands.mjs`) |
| a picture of a source model or GLB | `tools/assets/explore/shot.mjs` |
| axes, pins and mounting points measured on a model | `tools/assets/measure/` (extend it, do not write a second one) |
| parts out of the huge hardtail STEP | `tools/assets/explore/step-extract.mjs` |
| to prove a 3D refactor changed nothing | `tools/stage-digest.ts` |
| pictures of the running app | `npm run shots` (3D views), `npm run test:e2e` (journeys) |
| a content path as the user sees it | `npm run walk` |

A probe you need only once goes in `scratch/`. One you needed twice gets a header comment (what it does, how to call it) and moves into the tool folder above, or is deleted.

## Docs

| File | What it holds |
| --- | --- |
| `docs/idea.md` | the owner's intent: what the app should be (read it when your guide says so or the task is about what the app should do) |
| `docs/decisions.md` | the owner's decisions; they win over `idea.md` |
| `docs/open.md` | agents' choices the owner has not seen yet, and questions for the owner |
| `docs/schema-requests.md` | what the schema cannot express yet (hard rule 2) |
| `docs/sharing.md` | publishing the test build, how testers send feedback |
| `docs/architecture/content-model.md` | the shared words, and how checks, findings, jobs and flows fit |
| `docs/architecture/planned.md` | plans agreed with the owner that are not built yet |
| `content/review/<job>.md` | doubts about mechanics, for a mechanic |
