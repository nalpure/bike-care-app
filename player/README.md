# Player: guide for agents

The player is the web app that plays `build/bundle.json`. It uses Vite, TypeScript and three.js, with no UI framework and no backend. Read this before you change anything under `player/`. Content agents do not need it.

It holds no repair text and no bike-specific logic (CLAUDE.md, hard rule 1). Everything shown comes from the bundle. When the bundle lacks something, write a schema request; don't hard-code it. UI wording without repair advice is fine.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server; reads `build/bundle.json` live (run `npm run check` after content changes) |
| `npm run build` | Static site in `dist/`; publishing is described in `docs/sharing.md` |
| `npm run typecheck` | `tsc` for the tools and the player |
| `npm test` | Vitest: build tool tests and `player/test/` (engine, all profile journeys, 3D registry). On Windows only through `npm test` |
| `npm run test:e2e` | Builds the player, clicks every profile journey in headless Chromium (portrait and landscape), compares endings with `build/report.md`. Screenshots in `player/e2e/shots/`. `-- --no-build` reuses `dist/` |
| `npm run shots` | After `npm run build`: walks the rear-shifting tutorial for a road bike in a stand and a city bike upside down, with one screenshot per card after the camera settles. Use it to look at 3D changes. `-- --only road` limits it to one bike. Output in `player/e2e/shots/slow/` |
| `npm run manifest` | Writes `build/3d-manifest.json` from `player/src/stage/registry.ts`; `npm run check` validates content against it |

Before you commit: `npm run check`, `npm test`, `npm run test:e2e`, then look at a few screenshots (in the shots folders, use the Read tool on the PNGs). Run commands from the repo root.

## How it fits together

```
build/bundle.json --fetch--> engine/content.ts (Content: lookups, text filling)
                                   |
tools/lib/resolve.ts  ----->  engine/journey.ts (Journey: state machine, no DOM) <--- engine/store.ts (localStorage)
tools/lib/conditions.ts            |  screen(): Screen  (what to show; one union type)
                                   v
                              ui/app.ts (shell, tabs, overlays) -> ui/flow.ts (journey screens, card) / ui/home.ts
                                   |  stage.show(StageView)
                                   v
                              stage/three-stage.ts (ThreeStage)  or  ui/stage.ts (PlaceholderStage)
```

- **engine/** has no DOM. `Journey.screen()` returns the current `Screen` (question, choice, tools, card, exit, job, shop, done, …). The UI calls actions (`tap`, `next`, `back`, `answerFact`, `choose`, `exitShowHow`, …) through `app.act()` and renders again. The journey never plans steps: `tools/lib/resolve.ts` is shared with the build, so the app and the reviewed output can't drift apart. Change it only with both in mind.
- **ui/** renders one screen at a time with `h()` from `dom.ts`. `flow.ts` has every journey screen; one card component serves inspections, steps and checks. `#root[data-view]` names the screen (`journey:card:<id>`); the e2e tests and `window.__app` (the App) rely on it.
- **stage/** is the 3D view. Its element is created once and moved into each card, so the canvas carries on while the text changes. On an exit reached while something is still apart, the stage shows how the bike is held. Without WebGL it shows a text box; if three.js can't start at all, `main.ts` falls back to `PlaceholderStage`.
- **Storage:** `store.ts`, key `bike-app/v1`, wrapped so the app works without localStorage. It holds bikes and their facts, to-do items, notes and settings (text only, notice seen).

## The 3D stage (`player/src/stage/`)

| File | Holds |
| --- | --- |
| `registry.ts` | Pure data, and the source of 3D names. `NODES` lists every name content may use (tag label, name, aliases, one line on what the part does). `NODE_PARTS` maps a node that stands for several meshes. Also `VIEWS`, `CLIPS`, `MOTIONS`, and `LABEL_SCENES` (state label -> how the bike is held, what is hidden) |
| `bike.ts` | `bikeSpec(facts)`: which bike to draw (category -> frame, bar, fork, barrel position, kickstand; gear type -> derailleur or one sprocket; speeds -> sprockets). `BikeModel`: builds the meshes. `add(id, geometry, …)` registers a part under its node id, and `anchors` are where tags attach. Also the stand, hook and rope, and the derailleur layout (`setDer`, `layout`) |
| `chain.ts` | The chain path around chainring, sprocket and pulleys |
| `views.ts` | Named camera poses. `whole_bike` is in world space; close-ups are in bike space, so they follow a lifted, hung or flipped bike |
| `anim.ts` | Named clips (`shift-to-smallest`, `limit-screw-align`, `b-gap-adjust`, `cable-tension-shift`, …) and the generic motions. A `rotate` on a screw or the barrel adjuster plays the matching clip in the given direction |
| `three-stage.ts` | `ThreeStage`: scene, lights and the prototype's r128 look (colour management off, lights × π), the pose for each way of holding the bike (`poseVals`), focus fade, tags (stacked so they don't overlap), caption, explore mode, replay, solutions |

### Changing the 3D bike: recipe

1. Shape or proportions of a part: edit `BikeModel` in `bike.ts`. Keep the part id; content refers to it.
2. A new part that content may name: add it to `NODES` (and `NODE_PARTS` if it groups meshes), build it in `bike.ts` with that id, then run `npm run manifest` and `npm run check`. `player/test/stage.test.ts` fails until every node is built and the manifest matches.
3. Renaming a node used by content: rename it in `content/` and `registry.ts` together, then run the manifest and the check.
4. Which bike the facts produce: `bikeSpec` in `bike.ts`. Write a new rule as a comment there and list it in your handoff file.
5. Camera: `views.ts`. Holding poses: `LABEL_SCENES` plus `poseVals` in `three-stage.ts`. Look and lights: `three-stage.ts`.
6. Check it: `npm run build && npm run shots`, look at the PNGs, then run the full test set above.

The prototype in `legacy/Bikefix-garage-guide v2.html` is the visual reference. Keep its look.

### Known 3D shortcomings

- The `derailleur_from_behind` view (L and H screw checks): the tyre fills much of the frame and the derailleur is small and off-centre, worst with the bike upside down. You can't really judge "in line with the sprocket". Best fix: a closer camera, or a target nearer the pulley.
- `derailleur_side_close` (B gap): the gap is small on a phone.
- Cargo bikes are drawn as city bikes; hub gears and gearboxes as one sprocket; there is no full-suspension frame.
- The garage has no 3D preview of the bike (the prototype had one on the bike sheet).
- With reduced motion the camera and the pose jump; animations still loop.

## Other known gaps

- Shop search and the Shop tab are placeholders by design. The assistant panel only shows the context it would receive.
- The bike sheet labels facts by their question until SR-02 is decided; question pictures are grey tiles until SR-03.
- Swipe (`attachSwipe` in `flow.ts`) works for touch only and is not covered by the e2e test.
- `npm audit` reports a ReDoS in `picomatch` (dev tools only, nothing in `dist/`).

## Decisions behind the player

Owner decisions are in `docs/decisions.md`; open schema requests in `docs/schema-requests.md`. Smaller choices are explained in comments where they are implemented.
