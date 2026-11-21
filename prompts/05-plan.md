# Round 5: realistic 3D parts

## The problem

The 3D bike is built in code from boxes, cylinders and swept shapes. It explains how things work, but it doesn't look like the parts on a real bike. A user who compares the screen with their own derailleur sees something simpler and different, and gets confused. More rounds of shape fixes in code won't change that.

The answer: take real parts from a CC BY model ("Rigid Bike [Touring Bike]" by Mohamed Farhan, in `assets-src/rigid-bike-touring-bike/`), turn them into a small parts library, and assemble the bike from library parts where a fixed shape fits every bike. Parts that depend on the facts stay generated, but get real shapes: frame, wheels, sprockets, chainrings, chain. The model is the source of truth for shapes, so every session checks its work against it by measurement, not by taste.

Owner decisions for this round are in `docs/decisions.md`, section "3D view": parts library, real sprocket spacing, a longer cage above 36 teeth, only the touring bike's source in git.

## Sessions

Run them one after the other, in the main checkout. Each starts after the previous one has pushed.

| Session | Prompt | Model | Works in | Handoff file |
| --- | --- | --- | --- | --- |
| A: split the bike builder | `05-a-split.md` | Sonnet | `player/src/stage/`, `tools/` | `05-a-split-progress.md` |
| B: parts library | `05-b-library.md` | Sonnet | `tools/assets/`, `player/public/parts/`, `player/src/stage/library.ts`, `player/src/main.ts`, `player/test/` | `05-b-library-progress.md` |
| C: drivetrain | `05-c-drivetrain.md` | Sonnet | `player/src/stage/` (spec, drivetrain, chain, views), `player/test/stage.test.ts` | `05-c-drivetrain-progress.md` |
| D: derailleur | `05-d-derailleur.md` | **Opus** | `player/src/stage/` (derailleur, views, anim), `tools/assets/`, `player/test/` | `05-d-derailleur-progress.md` |
| E: other parts, look, credits | `05-e-parts.md` | Sonnet | `player/src/stage/`, `player/src/ui/app.ts` (credits line only), `player/README.md` | `05-e-parts-progress.md` |

A session that gets too large splits itself into parts: it writes its handoff file, and the owner clears the context and starts the next part with the same prompt.

## Rules for every session

- **Check by measuring.** Every task has a check that prints numbers or fails a test. Loop on your own until the checks pass; you need no one to judge looks for that. Screenshots are the last step, for the owner.
- **Three strikes.** If a check still fails after three different approaches, stop that task. Write what you tried, with the numbers, under "Questions for the owner" in your handoff file, and go on with the next task. Don't keep trying variations.
- **Context is money.** Read only the files your prompt names, and only the parts you need (Grep first, then Read with offset and limit). Never read a `.gltf`, `.glb` or `.bin` file, nor `build/bundle.json`; use the tools in `tools/assets/`. Pipe long command output through `tail` or `grep`. Move code with shell commands (`sed -n 'a,bp'`) instead of retyping it.
- **Screenshots:** at most 4 per round of changes, and only of what you changed (`player/CLAUDE.md`). Images cost far more context than text.
- **No dual paths.** When a library part replaces a generated one, delete the generated code. If the library cannot load, the app already falls back to the text stage (`PlaceholderStage`).
- **Names content uses don't change:** every node, view and clip in `registry.ts` stays. `npm run manifest` and `npm run check` must pass.
- **Drawing values are not facts.** Dimensions you use to draw (tooth shape, chain width, cassette tooth counts) are drawing data. Never present them as part compatibility or as anything the user should rely on (hard rule 3). Mark such tables with a comment saying so.
- `npm test` must not get much slower: at most 30 s more than at the start of your session (measure it at the start).
- End every session with the `verify` skill, then the `handoff` skill.

## What the source model contains (measured 2026-11-21)

File: `assets-src/rigid-bike-touring-bike/source/iWwsHSl6/rigid_bike.gltf` with `rigid_bike.bin` (24 MB). Exported from SolidWorks through Blender. 265 nodes, 256 meshes, none shared, 58 materials, no animations. 788k triangles in total, but the chain alone has 270k (194 separate plates) and the two grips 146k.

- **Units and axes:** metres. Origin at the bottom bracket centre. x across the bike (**drive side is −x**), y up, z forward.
- **Rear axle:** about (0, 50, −447) mm, taken from the cassette body. Measure it when you need it exactly.
- **Front assembly is steered.** Fork, front wheel, stem, bar and grips are turned about the steering axis, by about 45–60°. The steering axis runs through the centres of the two `Lower Cup` meshes: about (0, 392, 427) mm and (0, 545, 374) mm, so the head angle is about 71°.
- **Names in three.js** are sanitised: spaces become `_` and dots are dropped (`Handlebar Grip.STEP-1` → `Handlebar_GripSTEP-1`). The tools in `tools/assets/explore/` match three.js names; gltf-transform sees the original names.
- **Bounding boxes:** `explore/bbox.mjs` boxes the corners of each local box, so turned parts look larger than they are. Use `explore/islands.mjs` for true sizes.

Rear derailleur (`Derailleur_R.STEP-2` and loose nodes). Every piece is one solid. Which piece is which was read from colour renders; confirm it before relying on it.

| Source node | Library name | What it is | Triangles |
| --- | --- | --- | --- |
| `___B-4___.STEP-1` | `rd_upper_body` | B-knuckle: bolt drum with hex socket, body, arm to the cable stop | 6360 |
| `___B-5___.STEP-1` | `rd_barrel` | barrel adjuster, at the end of the body's arm | 3418 |
| `___B-7___.STEP-1` | `rd_link_outer` | outer parallelogram link | 1932 |
| `___B-8___.STEP-1` | `rd_link_inner` | inner parallelogram link | 904 |
| `___B-6___.STEP-1` | `rd_lower_body` | P-knuckle, carries the cage pivot | 6286 |
| `___B-1___.STEP-1` | `rd_cage_outer` | outer cage plate (2 mm) | 868 |
| `___B-3___.STEP-1` | `rd_cage_inner` | inner cage plate | 1362 |
| `Deraileur Gear-4` | `rd_pulley_upper` | upper pulley (the higher one), about 42 mm across | 4416 |
| `Deraileur Gear-3` | `rd_pulley_lower` | lower pulley | 4416 |
| `Deraileur Mount-3` | `rd_hanger` | hanger. Mounted on the chainstay in this model, not at the dropout, so use it for measuring only | 526 |

- **Missing:** the H, L and B screws, and the cable clamp is fused into a body piece. Two empty nodes (`___B-2___.STEP-1`, `-2`) are probably lost pins or springs.
- **No turning points** are stored. They must be measured from the hole geometry.
- **Cage:** the pulley centres are about 82 mm apart, a medium cage (enough for about 34–36 teeth).

Other parts we use:

| Source node | Library name | Notes |
| --- | --- | --- |
| `Crank Arms_1.STEP-1` | `crank_arms` | Drop the primitive with material `carbon steel-7`: that is the chainring (2 pieces, 1 mm thick, about 122 mm). Sessions C and E generate chainrings. |
| `Generic Al Pedal_1.STEP-3` / `-2` | `pedal_drive` / `pedal_nondrive` | flat pedals; STEP-3 is on the drive side (−x) |
| `Bike Saddle_1.STEP-1` | `saddle` | 5 primitives with rails; merge them |
| `Seat Post Clamp_1.STEP-1` + its M5 screw and nut | `seat_collar` | the clamp on the seat tube |
| `Chunky Stem_Predeterminado.STEP-1` + its 6 socket screws, `Top Cover.STEP-1`, `Headset Cap.STEP-1` | `stem` | un-steer first |
| `Handlebar.STEP-1` | `bar_flat` | about 784 mm wide, slight rise; un-steer first |
| `Handlebar Grip.STEP-2` / `-1` | `grip_drive` / `grip_nondrive` | 73k triangles each; un-steer first and decide the side after |

**Not used:**

- Frame tubes, fork and wheels: frame and wheels stay generated. The wheel's hub and spokes are one mesh, fixed at 700c.
- Cassette: a road block of about 11–23 teeth, fused into 3 lumps with blocky teeth.
- Chain plates.
- Bottom bracket parts.
- `RT-MT900 160mm.stp-1`: a copy of a Shimano disc rotor. Never use it.

**Simplification test** (meshoptimizer, same camera as the original):

- Derailleur at 25% (30k → 7.6k triangles): almost indistinguishable from the original. At 10% it is still clearly the same part.
- Crank arms and pedals at 15%: fine.
- The grips can go to a few percent.

## Shared names

**Library space.** Every library part is stored where it sits in the source bike, converted to the app's axes and units:

- scene units (1 unit = 0.5 m);
- x forward, y up, z to the drive side;
- origin at the source's bottom bracket centre.

The conversion is `lib = 2 × (src.z, src.y, −src.x)` with `src` in metres. The front parts (stem, bar, grips) are un-steered (turned straight) before they are stored. No part is moved to its own origin: sessions D and E measure the turning and mounting points in this space and place the parts from there. One shared space keeps every measurement comparable with the source.

**Library API** (`player/src/stage/library.ts`, built by session B):

```ts
export const LIB_NAMES = ['rd_upper_body', 'rd_barrel', 'rd_link_outer', 'rd_link_inner', 'rd_lower_body',
  'rd_cage_outer', 'rd_cage_inner', 'rd_pulley_upper', 'rd_pulley_lower', 'rd_hanger',
  'crank_arms', 'pedal_drive', 'pedal_nondrive', 'saddle', 'seat_collar', 'stem', 'bar_flat',
  'grip_drive', 'grip_nondrive'] as const;
export type LibName = (typeof LIB_NAMES)[number];
export async function loadLibrary(bytes?: ArrayBuffer): Promise<void>; // browser: fetches ./parts/library.glb; tests pass the file's bytes
export function hasLibrary(): boolean;
export function libGeo(name: LibName): THREE.BufferGeometry;            // shared, in library space, creased normals; userData.lib = true; never dispose it
```

Library names are pieces, not registry nodes. The builder maps pieces to nodes, so all `rd_*` pieces belong to `rear_derailleur`, except `rd_pulley_upper` (`upper_pulley`), `rd_barrel` (`barrel_adjuster`) and the hanger (`derailleur_hanger`).

**Budgets:**

- Library: at most 35k triangles in all, `library.glb` at most 1.5 MB.
- Whole bike drawn: at most 150k triangles (instances counted), and no more meshes than before this round. Session A records both numbers for a road, a city and an MTB bike in its handoff file. Repeated pieces (chain links) are drawn as instances.
