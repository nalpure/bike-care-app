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
                              ui/app.ts (shell, tabs, overlays) -> ui/flow.ts (journey screens, card) / ui/home.ts (home, garage list)
                                   |                                  ui/pick.ts (which bike, before a flow) / ui/bike.ts (bike page) / ui/swipe.ts
                                   |  stage.show(StageView)
                                   v
                              stage/three-stage.ts (ThreeStage)  or  ui/stage.ts (PlaceholderStage)
```

- **engine/** has no DOM. `Journey.screen()` returns the current `Screen` (question, choice, tools, card, exit, job, shop, done, …). The UI calls actions (`tap`, `next`, `back`, `answerFact`, `choose`, `exitShowHow`, …) through `app.act()` and renders again. The journey never plans steps: `tools/lib/resolve.ts` is shared with the build, so the app and the reviewed output can't drift apart. Change it only with both in mind.
- **ui/** renders one screen at a time with `h()` from `dom.ts`. `flow.ts` has every journey screen; one card component serves inspections, steps and checks. `#root[data-view]` names the screen (`journey:card:<id>`); the e2e tests and `window.__app` (the App) rely on it.
- **stage/** is the 3D view. Its element is created once and moved into each card, so the canvas carries on while the text changes. On an exit reached while something is still apart, the stage shows how the bike is held. Without WebGL it shows a text box; if three.js can't start at all, `main.ts` falls back to `PlaceholderStage`.
- **Storage:** `store.ts`, key `bike-app/v2`, wrapped so the app works without localStorage. It holds the garage (`bikes[]`: name, facts, findings, `added`, `done` per job, `kmPerWeek`), the user's tools, notes and settings. No bike is "in use": every flow starts on `ui/pick.ts`. A first start and a reset fill the garage from the bundle's `demo_bikes`. Version 1 data is dropped, not migrated.
- **Bikes and flows:** `Journey` works on a copy of the chosen bike (or an unknown bike, `null`). What it learned reaches the garage only through the keep screen (`keepSave`, once per flow); findings and finished jobs reach the garage bike at once. `engine/bikes.ts` has the complete-bike lookup (a stub over `demo_bikes`), the range check and the geometry fit checks. `engine/service.ts` has the traffic lights.

## The 3D stage (`player/src/stage/`)

| File | Holds |
| --- | --- |
| `registry.ts` | Pure data, and the source of 3D names. `NODES` lists every name content may use (tag label, name, aliases, one line on what the part does, and `model_fact`: the text fact(s) with the part's model, shown in the garage preview). `NODE_PARTS` maps a node that stands for several meshes. Also `VIEWS`, `CLIPS`, `MOTIONS`, `LABEL_SCENES` (state label -> how the bike is held, what is hidden), and `previewNode` / `modelOf` for the preview tag |
| `bike.ts` | `bikeSpec(facts)`: which bike to draw. The rules are in the comment above it (category, `bike.handlebar`, gear type, speeds, e-bike, `bike.colour`, `geometry.*`). Its dimensions (axle positions `rx`, `huby`, tyre `rt`, bottom bracket `bby`, frame points) are per bike; `RX`, `HUBY`, `RT`, `BBY` are only the defaults. `BikeModel`: builds the meshes. `add(id, geometry, …)` registers a part under its node id, `anchors` are where tags attach, `turns` are the screws and the barrel adjuster with their axis. Also the stand, hook and rope, and the derailleur: `derGeom` (hanger, body, links), `layout` (where the upper pulley sits), `setDer` (moves cage, links and chain) |
| `chain.ts` | The chain path around chainring, sprocket and pulleys; between wheels in different planes the chain bends sideways gently instead of cutting across |
| `views.ts` | Named camera poses. `whole_bike` is in world space; close-ups are in bike space, so they follow a lifted, hung or flipped bike |
| `anim.ts` | Named clips (`shift-to-smallest`, `limit-screw-align`, `b-gap-adjust`, `cable-tension-shift`, …) and the generic motions. A `rotate` on a screw or the barrel adjuster plays the matching clip in the given direction |
| `three-stage.ts` | `ThreeStage`: scene, lights and the prototype's r128 look (colour management off, lights × π), the pose for each way of holding the bike (`poseVals`), focus fade, tags (stacked so they don't overlap), caption, explore mode, replay, solutions, and the garage preview (below) |

### Garage preview

`ThreeStage` has a preview mode for the garage: the whole bike drawn from one bike's facts, turning slowly; drag to turn it, pinch to zoom, tap a part for a tag with its generic name and, in small text, its model when the bike's facts know it.

```ts
stage.preview(facts, host, { name, onPick })   // shows the bike in host (an element with a size)
stage.endPreview()                             // optional: show() for a card also ends it
// onPick({ node, name, model }) on a tap on a part, onPick(null) on a tap beside the bike
stage.snapshot(facts, width, height, name)     // a still PNG (data URL) of any bike, or null
```

- There is one stage (one WebGL context). `preview` moves its element into `host`, like a card does; give `host` a width and height. Calling it again with another bike's facts redraws.
- For a list of bikes, use `snapshot`: the same camera, a transparent background, drawn without touching the live stage (a few milliseconds per bike; cache the result per bike and its facts).
- The tag shows `NODES[node].name` and `modelOf(node, facts)`: the values of the node's `model_fact` facts, joined. A tapped sprocket shows as the sprockets, the upper wheel as the derailleur (`previewNode`).
- `PlaceholderStage` (`ui/stage.ts`) has no preview; check `'preview' in stage` before calling it.
- Without WebGL the host shows a one-line note.

### Changing the 3D bike: recipe

1. Shape or proportions of a part: edit `BikeModel` in `bike.ts`. Keep the part id; content refers to it.
2. A new part that content may name: add it to `NODES` (and `NODE_PARTS` if it groups meshes), build it in `bike.ts` with that id, then run `npm run manifest` and `npm run check`. `player/test/stage.test.ts` fails until every node is built and the manifest matches.
3. Renaming a node used by content: rename it in `content/` and `registry.ts` together, then run the manifest and the check.
4. Which bike the facts produce: `bikeSpec` in `bike.ts`. Write a new rule as a comment there and list it in your handoff file.
5. Camera: `views.ts`. Holding poses: `LABEL_SCENES` plus `poseVals` in `three-stage.ts`. Look and lights: `three-stage.ts`.
6. Check it: `npm run build && npm run shots`, look at the PNGs, then run the full test set above. `stage.test.ts` checks that the derailleur, chain and frame stay off the sprockets in every gear of every kind of bike, and that tyres clear the frame, also with extreme geometry.

The prototype in `legacy/Bikefix-garage-guide v2.html` is the visual reference. Keep its look.

### Known 3D shortcomings

- The sprockets sit 1.25 times as far apart as on a real cassette, on a realistic chain line, so they still read on a phone; they are smooth discs, without teeth.
- The derailleur (`derGeom`, `derPose`) is a simplified real one: the body turns about the hanger bolt only with the B screw, the parallelogram links swing on a slanted arc fitted to the cassette, and the cage turns about its pivot to keep the gap. On a wide-range cassette the cage swings at most 30° from its usual angle; beyond that the gap would open a little.
- Small mechanical parts (`OUTLINED` in `bike.ts`) are drawn with dark edge lines, and the lights are less even than the prototype's, so the shapes read with one colour or a highlight.
- Cargo bikes are drawn as city bikes; hub gears and gearboxes as one sprocket; there is no full-suspension frame, no front derailleur and no brakes at the wheels (only the levers).
- Geometry facts: top tube and wheelbase are not used (the front wheel follows the head angle with a 45 mm fork offset). An unusual combination moves a wheel away from the frame instead of drawing them touching.
- The garage preview uses the one shared stage, so only one bike can turn in 3D at a time; other bikes can be shown as `snapshot` pictures.
- With reduced motion the camera and the pose jump; animations still loop.

## Other known gaps

- Shop search and the Shop tab are placeholders by design. The assistant panel only shows the context it would receive.
- Question pictures are grey tiles until SR-03.
- Service intervals are unverified placeholders from the content; the lights only mean something once they are checked.
- The bike page's 3D preview and the garage pictures need the 3D stage; with `PlaceholderStage` they are left out.
- `npm audit` reports a ReDoS in `picomatch` (dev tools only, nothing in `dist/`).

## Decisions behind the player

Owner decisions are in `docs/decisions.md`; open schema requests in `docs/schema-requests.md`. Smaller choices are explained in comments where they are implemented.
