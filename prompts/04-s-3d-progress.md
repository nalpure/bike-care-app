# Session S (3D view): progress

## Status

Finished (one part). Tasks 1–6 done, including the optional geometry fit.

## Done

All in `f61a775` (pushed to `main`):

- **Derailleur:** a hanger plate on the drive-side dropout, which now sits just outside the smallest sprocket (the drive-side stays bend out to it). A body (B-knuckle) on the hanger bolt with the H and L screws on its back and the B screw on its head against a tab of the hanger. Parallelogram links that swing in the plane seen from behind, a P-knuckle, and a cage with two plates and toothed pulleys. The barrel adjuster sits on top of the body (drop bar) or on the trigger shifter. New test: derailleur, chain and frame stay off the sprockets in every gear (5–13 speeds, road, city and MTB cassettes).
- **Bottom bracket:** 70 mm below the axles on road bikes, 65 mm on city bikes, 45 mm on MTBs (was 150 mm). Chain, stand, kickstand, battery, cable and views follow `B.bby`.
- **Cockpit:** `bike.handlebar` picks the bar, else the kind of bike as before. A drop bar gets hoods, brake lever blades and a shift paddle on the right. Flat and riser bars get a brake lever on each side and a trigger shifter with thumb and release levers. The drop bar already showed on road bikes; it was small and cut off at the edge of `drive_side`.
- **Views:** `derailleur_from_behind` (also used by `derailleur-alignment`) is close, straight behind, at pulley height, and works upside down. `derailleur_side_close` fills the picture with the pulley-to-sprocket gap. `barrel_adjuster_close` on a trigger shifter now looks from the front and inside. No new view names.
- **Garage preview and snapshot** (below), the frame colour from `bike.colour`, and the frame fitted to `geometry.*` within plausible ranges, with a test using extreme values.
- `player/README.md`: 3D file table, a "Garage preview" section, the recipe, "Known 3D shortcomings".

## Owner feedback round (derailleur look, chainstay, chain twist)

Done in `2df5622` (finished in a second session after the first was interrupted):

- **Derailleur body:** `derGeom` / `derPose` in `bike.ts`. The body turns about the hanger bolt within 45°, two link plates swing inwards, the P-knuckle carries the cage, and the cage plates are rounded slabs. The H, L and B screws and the barrel adjuster sit on the body and move with it (`turnable(..., parent)`; `poseArrow` in `three-stage.ts` follows them).
- **Cassette and chainstay:** sprockets at 1.25 × real spacing (by speed count), centred on a chain line of 100–115 mm; the chainring sits on it. Chainstays on both sides bend out once behind the chainring (`stayPts`), and the axle runs from dropout to dropout.
- **Chain twist:** each link's width stays across the bike (`setDer`).
- The owner's answer to question 1: the long body is fine.

Choices without the owner: the 1.25 factor and the chain line values; the body's turning range (45°) and cage angles (-35° to -55°); the inner cage plate is narrower at the lower pulley so it clears the next sprocket on 13-speed cassettes.

**Blender?** Not yet. A modelled derailleur (glTF) would look better, but it would have to be rigged so its body, links and cage still move with `derPose`, and the geometry would have to be refit for every cassette. Worth it only once the procedural shapes are the limit; then a modelled body and cage plates on the existing joints would be the cheapest step.

## Owner feedback round 2 (body, screws, gap, contours)

- **Body:** an arch from the bolt knuckle up to an elbow and back to the link pins, with a lighter cover; the links hang down from it on a slanted arc (`derGeom`). The barrel adjuster or cable stop sits on top at the elbow.
- **Screws:** H and L are small (`SCREW_LEN`) and set into the top of the arch, heads out. The B screw sits in a lug on the knuckle; it slides along its axis as the body turns, so its tip stays on the hanger's tab. The old floating tab cylinder is gone.
- **Gap:** it used to stay large on the small sprockets and close suddenly near the big ones (the body hit its turning limit). Now the body only turns with the B screw, and the cage turns to keep the gap exact on every sprocket. In the B-screw clip the gap moves with the screw from the start.
- **Depth:** dark outlines on small mechanical parts, less ambient light, a fill light, and a highlight that keeps each piece's own shade.

Choices without the owner: the cage pivot sits behind and above the upper pulley (`KAPPA` 70°); the cage line runs from -60° (smallest) to -80° (largest) and may swing 30° either way; the outline threshold (35°) and which parts get outlines; the new light levels.

## Interfaces other sessions rely on

- **Preview** (`player/src/stage/three-stage.ts`, class `ThreeStage`):
  - `preview(facts: Record<string, unknown>, host: HTMLElement, opts?: { name?: string; onPick?: (p: PreviewPick | null) => void }): void` moves the stage element into `host` (give it a size). Shows the whole bike turning slowly; drag turns it, pinch zooms. Tapping a part shows a tag with the generic name and, in small text, the model.
  - `endPreview(): void`. `show()` also ends the preview.
  - `snapshot(facts, width = 320, height = 200, name?): string | null` returns a PNG data URL with a transparent background, for lists.
  - `PreviewPick = { node: string; name: string; model: string }`.
  - `ui/stage.ts` `Stage` is unchanged (not my folder). A1: add optional `preview?`, `endPreview?` and `snapshot?` there, or check `'preview' in stage`. `PlaceholderStage` has none of them.
- **Registry** (`registry.ts`):
  - `NodeInfo.model_fact?: string | string[]`, with these values:

    | Node | `model_fact` |
    | --- | --- |
    | `rear_derailleur` | `drive.rear_derailleur_model` |
    | `shifter_rear` | `drive.shifter_model` |
    | `cassette` | `drive.cassette_model` |
    | `chain` | `drive.chain_model` |
    | `chainring`, `crank` | `drive.crankset_model` |
    | `frame` | `bike.brand` + `bike.model` + `bike.line` |

  - `modelOf(node, facts): string` and `previewNode(part): string` (a sprocket shows as `cassette`, the upper pulley as `rear_derailleur`).
- **New node** `brake_lever` ("Brake levers"), built on every bike. The manifest has 27 nodes.
- **`BikeSpec`** (`bike.ts`), new fields: `rx`, `huby`, `rt`, `bby`, `zDrop`, `saddleX`, and `colour` (`#rrggbb` or null). `RX`, `HUBY`, `RT` and `BBY` are now defaults only. `GEOMETRY_RANGES` and `geometryOf(facts)` list the values the drawing accepts.
- **Facts read:** `bike.handlebar`, `bike.colour`, `bike.brand`, `bike.model`, `bike.line` and `geometry.*`, as named in the plan. The `_model` keys are my guess (see Choices).

## Choices made without the owner

- **Drive-side dropout and stays outside the cassette**, as on a real bike, so the hanger can carry the derailleur. Implemented in `stayPts` and `zDrop` in `bike.ts`.
- **Derailleur kinematics** (`derGeom`, `pivotAt`): the body is fixed, the links swing from upright on the smallest sprocket to leaning in on the largest, and a short arm to the pulley absorbs the rest. The drivetrain is drawn twice as wide as a real one, so the body hangs about 120–150 mm below the axle.
- **Barrel adjuster position follows the bar**, no longer the category: drop bar → at the derailleur (brake/shift levers have none), flat or riser bar → on the shifter.
- **BB drop defaults:** road 70 mm, city 65 mm, MTB 45 mm.
- **`brake_lever`** is one node for both levers. Left and right are not named, because the convention differs by country.
- **`_model` fact names** for the shifter, cassette, chain and crankset are guesses that follow `drive.rear_derailleur_model`. If C named them differently, change `model_fact` in `registry.ts`.
- **Geometry:** the ranges in `GEOMETRY_RANGES` come from typical published geometry tables (my knowledge, not checked against sources). Wheel BSD must be 559, 584 or 622. Top tube and wheelbase are not used. A 45 mm fork offset applies only when geometry is given. If a wheel would touch the frame, it moves away. The cranks are now ≈170 mm (they were ≈140 mm).
- **Look:** sprockets stay smooth discs (teeth looked like battlements from behind); the pulleys and the chainring have teeth. Between wheels in different planes the chain bends sideways gently (`chain.ts`), so it no longer cuts across the next sprocket.
- **Preview behaviour:** auto-rotation stops while the user drags and resumes after 6 s; with reduced motion it doesn't rotate. The hint text is "Tap a part".

## Questions for the owner

1. Is the long derailleur body OK, or do you prefer real-scale sprocket spacing (a compact derailleur, but sprockets harder to tell apart on a phone)? Recommended: keep it as is.
2. Should brake levers be split into front and rear nodes now? Recommended: not until brake content needs them.

## Next steps

1. A1: wire `preview` into the bike page and `snapshot` into the garage list; extend the `Stage` interface as described above.
2. Once C's facts are in: check the `_model` keys against `model_fact`, and `GEOMETRY_RANGES` against the facts' `min`/`max` (A1's form checks).
3. Owner: `git worktree remove ../bike-app-3d` and `git branch -D round4-3d`.

## Gotchas

- There is no Python; Bash heredocs that contain backticks break. Write patch scripts with the Write tool and run them with node.
- The stage element needs a sized parent. Inside a plain block the canvas is 0 px tall and `tick` skips rendering (blank screenshots).
- `h()` has no `#id` syntax; pass `{ id }`.
- `BikeModel` calls `setDer` before it computes the part centres, because the moving links would otherwise skew them.
- `npm run shots` takes about 2.5 min for both bikes. For quick looks, a scratch Playwright script that calls `__app.stage.show(...)` or `preview(...)` on `dist/` is faster. It needs a `.mts` file and an absolute import of `node_modules/playwright/index.mjs`.
