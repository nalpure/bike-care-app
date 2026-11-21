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
| `npm run parts` | Builds the parts library (`player/public/parts/library.glb`, `library.json`, `CREDITS.txt`) from `tools/assets/library.yaml` and the model in `assets-src/` |
| `npm run parts:check` | Renders every library part and its source nodes as silhouettes from 6 directions in headless Chromium and prints the overlap and box difference per part; fails on a bad shape or an over-budget library. `-- --shots` writes a PNG per part to `tools/assets/out/` (original left, library right) |
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
                                   |                                  ui/assistant.ts (floating button) / ui/edge.ts (edge swipe back)
                                   |  stage.show(StageView)
                                   v
                              stage/three-stage.ts (ThreeStage)  or  ui/stage.ts (PlaceholderStage)
```

- **engine/** has no DOM. `Journey.screen()` returns the current `Screen` (question, choice, tools, card, exit, job, shop, done, …). The UI calls actions (`tap`, `next`, `back`, `answerFact`, `choose`, `exitShowHow`, …) through `app.act()` and renders again. The journey never plans steps: `tools/lib/resolve.ts` is shared with the build, so the app and the reviewed output can't drift apart. Change it only with both in mind.
- **ui/** renders one screen at a time with `h()` from `dom.ts`. `flow.ts` has every journey screen; one card component serves inspections, steps and checks. `#root[data-view]` names the screen (`journey:card:<id>`); the e2e tests and `window.__app` (the App) rely on it.
- **stage/** is the 3D view. Its element is created once and moved into each card, so the canvas carries on while the text changes. On an exit reached while something is still apart, the stage shows how the bike is held. Without WebGL it shows a text box; if three.js can't start at all, `main.ts` falls back to `PlaceholderStage`.
- **Storage:** `store.ts`, key `bike-app/v2`, wrapped so the app works without localStorage. It holds the garage (`bikes[]`: name, facts, findings, `added`, `done` per job, `kmPerWeek`), the user's tools, notes and settings. No bike is "in use": every flow starts on `ui/pick.ts`. A first start and a reset fill the garage from the bundle's `demo_bikes`. Version 1 data is dropped, not migrated.
- **Navigation:** `App.backTarget()` says what Back does on the current screen (null on the main tabs); the arrow, the edge swipe (`ui/edge.ts`) and the browser's back (`popstate`; the app keeps one history entry while it can go back) all call `App.goBack()`. On a card, Next, the swipe up (`attachSwipeUp` in `flow.ts`, touch events on the text only) and the arrow keys go through `App.advance()`, which slides the text out before the next one slides in from below (not with reduced motion). The progress bar is vertical, left of the text.
- **Assistant button:** `ui/assistant.ts`, one button on every screen. Drag it; it sticks to the left or right edge and `store.data.assistant` keeps `{ side, y }`. `placeAssistant` moves it (not saved) out of the way of `PROTECTED` buttons and, where possible, text; add a selector there when a new screen has a button it must not cover.
- **Notes:** a note keeps the screen (`unit`, `title`), the bike, the flow and the last three steps (`last`); the whole `path` and the facts are under Details in the Notes tab and at the end of the exported text.
- **Bikes and flows:** `Journey` works on a copy of the chosen bike (or an unknown bike, `null`). What it learned reaches the garage only through the keep screen (`keepSave`, once per flow); findings and finished jobs reach the garage bike at once. `engine/bikes.ts` has the complete-bike lookup (a stub over `demo_bikes`), the range check and the geometry fit checks. `engine/service.ts` has the traffic lights.

## The 3D stage (`player/src/stage/`)

| File | Holds |
| --- | --- |
| `registry.ts` | Pure data, and the source of 3D names. `NODES` lists every name content may use (tag label, name, aliases, one line on what the part does, and `model_fact`: the text fact(s) with the part's model, shown in the garage preview). `NODE_PARTS` maps a node that stands for several meshes. Also `VIEWS`, `CLIPS`, `MOTIONS`, `LABEL_SCENES` (state label -> how the bike is held, what is hidden), and `previewNode` / `modelOf` for the preview tag |
| `spec.ts` | Constants, `BikeSpec` and `bikeSpec(facts)`: which bike to draw. The rules are in the comment above it (category, `bike.handlebar`, gear type, speeds, e-bike, `bike.colour`, `geometry.*`). Its dimensions (axle positions `rx`, `huby`, tyre `rt`, bottom bracket `bby`, frame points) are per bike; `RX`, `HUBY`, `RT`, `BBY` are only the defaults. Also `cassetteFor`, `geometryOf` and the frame-point helpers (`stayPts`, `batteryLine`, `gripOf`) |
| `bike.ts` | `BikeModel`: builds the meshes (frame, wheels, fork, stand, hook, name decal) and calls the builders below. `add(id, geometry, …)` registers a part under its node id, `anchors` are where tags attach, `turns` are the screws and the barrel adjuster with their axis. `setDer` moves the derailleur and lays the chain. Re-exports the names of `spec.ts`, `geo.ts` (`seg`, `disposeTree`), `derailleur.ts` and `drivetrain.ts` (`rAt`), so other files import from `bike.ts` |
| `geo.ts` | Geometry helpers: `tubeGeo`, `curveGeo`, `gearGeo` (pulleys), `slabGeo`, `hullShape`, `seg`, `plate`, `v3`, and the toothed parts: `toothOutline` (roller seats and flanks on the chain's pitch circle), `sprocketGeo` (carrier windows from 28 teeth, splined hole), `chainringGeo` (ring with 4 or 5 bolt tabs, one mesh centred on the axle) |
| `library.ts` | The parts library loader: `loadLibrary`, `hasLibrary`, `libGeo(name)` (see "Parts library" below) |
| `drivetrain.ts` | Chainring, cranks, sprockets (`buildCrankset`; the sprockets are one block, `cassetteG`, that turns with the chain, not with the wheel), the chain (`buildChain`: inner and outer plates, rollers and pin heads as two instanced meshes; `layoutCirc`, `layChain`), `nearestSprocket` and `rAt` |
| `derailleur.ts` | `derGeom` (hanger, body, links), `derPose` (body angle, cage, links), the turning points (`bodyBarrel`, `barrelTurn`), `buildDerailleur` and `moveDerailleur` (cage, links, cable ends) |
| `cockpit.ts` | `buildCockpit` (bar, brake levers, shifter) and `buildShiftCable` |
| `chain.ts` | The chain path around chainring, sprocket and pulleys, as a polyline and as exact pieces (arcs and runs); between wheels in different planes the chain bends sideways gently instead of cutting across |
| `pins.ts` | The chain as a ring of pins one pitch apart (chord): `layPins` lays them along the path from a first pin on the chainring, so on every wheel they sit exactly on the pitch circle; the sprocket block's angle follows from them. `chordLength` is the taut length of the chain around the path. The free run before the chainring sags with the leftover length. No three.js |
| `views.ts` | Named camera poses. `whole_bike` is in world space; close-ups are in bike space, so they follow a lifted, hung or flipped bike |
| `anim.ts` | Named clips (`shift-to-smallest`, `limit-screw-align`, `b-gap-adjust`, `cable-tension-shift`, …) and the generic motions. A `rotate` on a screw or the barrel adjuster plays the matching clip in the given direction |
| `three-stage.ts` | `ThreeStage`: scene, lights and the prototype's r128 look (colour management off, lights × π), the pose for each way of holding the bike (`poseVals`), focus fade, tags (stacked so they don't overlap), caption, explore mode, replay, solutions, and the garage preview (below) |

### Parts library

Real part shapes come from a CC BY model in `assets-src/`, split into pieces and simplified by `npm run parts` into `player/public/parts/library.glb` (one mesh per part, positions and indices only, quantized) with `library.json` (per part: source nodes, triangles before and after, box and size in mm; also the steering axis and angle) and `CREDITS.txt`. The app fetches the file at start (`main.ts` calls `loadLibrary()` before it creates the stage; if that fails it falls back to `PlaceholderStage`). Tests load it from disk in `player/test/setup-library.ts`.

- **Library space:** scene units (1 unit = 0.5 m), x forward, y up, z to the drive side, origin at the source's bottom bracket centre (`lib = 2 x (src.z, src.y, -src.x)`, metres). Parts are not moved to their own origin: measure turning and mounting points in this space and place parts from there. The front parts (stem, bar, grips) are stored turned straight.
- **API (`stage/library.ts`):** `LIB_NAMES`, `loadLibrary(bytes?)`, `hasLibrary()`, `libGeo(name)`: shared geometry in library space with creased normals (35°), `userData.lib = true`. Never dispose it; `disposeTree` skips it.
- **Library names are pieces, not registry nodes:** the builder maps pieces to nodes.
- **Credit:** the app must credit every model it uses (`CREDITS.txt` has the text).
- **Budgets:** at most 35k triangles and 1.5 MB for the library (`parts:check` fails above that).
- **Add or change a part:** edit `tools/assets/library.yaml` (source nodes by their original glTF names, materials to drop, `front`, the share of triangles to keep), add the name to `LIB_NAMES`, run `npm run parts`, then `npm run parts:check` (overlap of at least 0.97 and a box within 0.5 mm of the source, from 6 directions). Another source model is another yaml file and another `source:`.
- The tables in the yaml are drawing data (shapes), not facts about parts (hard rule 3).

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

1. Shape or proportions of a part: edit the builder in `bike.ts`, `drivetrain.ts`, `derailleur.ts` or `cockpit.ts`. Keep the part id; content refers to it.
2. A new part that content may name: add it to `NODES` (and `NODE_PARTS` if it groups meshes), build it with that id (`bike.ts` or the builder module of its area), then run `npm run manifest` and `npm run check`. `player/test/stage.test.ts` fails until every node is built and the manifest matches.
3. Renaming a node used by content: rename it in `content/` and `registry.ts` together, then run the manifest and the check.
4. Which bike the facts produce: `bikeSpec` in `spec.ts`. Write a new rule as a comment there and list it in your handoff file.
5. Camera: `views.ts`. Holding poses: `LABEL_SCENES` plus `poseVals` in `three-stage.ts`. Look and lights: `three-stage.ts`.
6. Check it: `npm run build && npm run shots`, look at the PNGs, then run the full test set above. `stage.test.ts` checks that the derailleur, chain and frame stay off the sprockets in every gear of every kind of bike, and that tyres clear the frame, also with extreme geometry.

The prototype in `legacy/Bikefix-garage-guide v2.html` is the visual reference. Keep its look.

### Known 3D shortcomings

- Sprockets, chainring and chain are drawn at real size, with real tooth shapes and links; the chain's pins sit in the tooth gaps of the chainring and of the sprocket it is on. The sizes (spacing, chain width, tooth counts of the common cassettes in `spec.ts`) are drawing values, not facts about parts. The sprockets are generated for each bike from its tooth counts. There is no narrow-wide tooth profile, no tooth chamfer (triangle budget), and the derailleur's pulleys do not spin yet. The derailleur's cage does not yet take up chain length like a real one (session D): the chain gets as many links as it needs in each gear, so the link count changes a little when shifting, and the free run before the chainring sags with what is left over.
- The derailleur (`derGeom`, `derPose`) is a simplified real one: the body turns about the hanger bolt only with the B screw, the parallelogram links swing on a slanted arc fitted to the cassette, and the cage turns about its pivot to keep the gap. On a wide-range cassette the cage swings at most 30° from its usual angle; beyond that the gap would open a little.
- Small mechanical parts (`OUTLINED` in `bike.ts`) are drawn with dark edge lines, and the lights are less even than the prototype's, so the shapes read with one colour or a highlight.
- Cargo bikes are drawn as city bikes; hub gears and gearboxes as one sprocket; there is no full-suspension frame, no front derailleur and no brakes at the wheels (only the levers).
- Geometry facts: top tube and wheelbase are not used (the front wheel follows the head angle with a 45 mm fork offset). An unusual combination moves a wheel away from the frame instead of drawing them touching.
- The garage preview uses the one shared stage, so only one bike can turn in 3D at a time; other bikes can be shown as `snapshot` pictures.
- With reduced motion the camera and the pose jump; animations still loop.

## Other known gaps

- Shop search and the Shop tab are placeholders by design. The assistant panel only shows the context it would receive.
- Question pictures are grey tiles until SR-03.
- The edge swipe works from the first 24 px of the left edge only. Safari on iOS has its own edge swipe there; the app keeps a history entry so that swipe also goes back in the app, and ignores a browser back within 0.7 s of its own swipe. Chrome on Android uses a system gesture the page never sees; it goes through the same history entry.
- Swipe up works with touch only (not a mouse drag); the e2e test sends touch events through the Chrome DevTools protocol.
- Service intervals are unverified placeholders from the content; the lights only mean something once they are checked.
- The bike page's 3D preview and the garage pictures need the 3D stage; with `PlaceholderStage` they are left out.
- `npm audit` reports a ReDoS in `picomatch` (dev tools only, nothing in `dist/`).

## Decisions behind the player

Owner decisions are in `docs/decisions.md`; open schema requests in `docs/schema-requests.md`. Smaller choices are explained in comments where they are implemented.
