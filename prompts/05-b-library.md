# Session B: the parts library

Read `CLAUDE.md`, `prompts/05-plan.md` (all of it: the model's contents, library space, API and budgets are yours to build), `prompts/05-a-split-progress.md` and `player/CLAUDE.md`. If you have questions, ask them in one batch before you start; after that, work without stopping.

Model: Sonnet. You own `tools/assets/`, `player/public/parts/`, `player/src/stage/library.ts`, the library loading in `player/src/main.ts`, and new tests in `player/test/`. **No visible change to the bike yet**: nothing draws library parts until sessions D and E.

## Tools you already have

`tools/assets/explore/` holds the scripts the analysis used. Their usage is in the first line of each:

- `tree.mjs`: node tree with triangle counts.
- `bbox.mjs`: world boxes and materials.
- `islands.mjs`: connected pieces and their true sizes.
- `shot.mjs` with `view.html` and `simplify.html`: renders in headless Chromium, parts coloured per piece, or simplified with meshoptimizer.

Run them from the repo root, with Node on PATH (see `CLAUDE.md`). Reuse their code where it helps.

## Tasks

1. **Dependencies:** add `@gltf-transform/core`, `@gltf-transform/functions` and `@gltf-transform/extensions` as devDependencies, plus `meshoptimizer` (pin it to the version already in `node_modules`).

2. **Mapping file** `tools/assets/library.yaml`, data only, so a later source model is just another file. For each library name (the table in `05-plan.md`) it lists:
   - the source file;
   - the source node names (original names, not three.js names);
   - primitives to drop, by material name;
   - `front: true` for the parts to un-steer;
   - the simplification target.

   Start with these targets and change them only if a check fails:

   | Parts | Target |
   | --- | --- |
   | `rd_*` pieces over 1500 triangles | 25% |
   | `rd_*` pieces under 1500 triangles | 100% |
   | pulleys | 30% |
   | `crank_arms` | 20% |
   | pedals, `saddle`, `stem` | 15% |
   | `bar_flat` | 40% |
   | grips | 4% |
   | `seat_collar` | 20% |

3. **Build script** `tools/assets/build-library.ts`, run as `npm run parts`. It writes `player/public/parts/library.glb` and `player/public/parts/library.json`.
   - **Per part:**
     - bake the source world transform;
     - convert to library space (`05-plan.md`);
     - merge the listed nodes and primitives into one mesh;
     - weld and simplify (meshoptimizer through gltf-transform);
     - keep position and index only (no normals, uv or materials).
   - **File:** one node per library name, named exactly that, with an identity transform. Quantize (`KHR_mesh_quantization`, which three's GLTFLoader reads natively). No Draco and no meshopt compression, so Node tests load it without decoders.
   - **Un-steer** the `front` parts:
     - Steering axis: through the centres of the two `Lower Cup` meshes.
     - Angle: the one that makes the two grips mirror images across the bike's middle plane.
     - Turn the front parts back by that angle about that axis.
     - Record the axis (two points, library space) and the angle in `library.json`.
   - **Sides:** decide `grip_drive` and `pedal_drive` by their x after un-steering (drive side is −x in the source, +z in library space).
   - **`library.json`:** per part, the source names, triangles before and after, the box in library space, and the true size in mm; also the steering axis and angle. Later sessions read this instead of the glb.
   - **Credits:** copy the credit from `assets-src/rigid-bike-touring-bike/credit.txt` to `player/public/parts/CREDITS.txt`, adding "Changed: split into parts, simplified, re-oriented."

4. **Shape check** `tools/assets/check-library.ts`, run as `npm run parts:check`.
   - It renders each library part and its source nodes, with the same camera, as flat silhouettes from 6 directions (±x, ±y, ±z, framed on the part, 512 px). It computes the overlap (intersection over union) **in the page** (read the pixels of two render targets; no image library). Use headless Chromium like `explore/shot.mjs`.
   - It prints one line per part: the worst direction and its overlap, and the box difference in mm.
   - It fails when:
     - any overlap is below 0.97. Count a pixel as a mismatch only if the other silhouette has no pixel within 1 px of it, because thin plates seen edge-on are only a few pixels wide;
     - any box differs by more than 0.5 mm;
     - the library is over budget (35k triangles, 1.5 MB).
   - For un-steered parts, it compares against the source turned by the recorded angle, so the comparison stays like for like.
   - It also checks that the un-steered grips are mirror images within 1 mm, and that the bar's axis is level and straight across.
   - With `--shots`, it writes one PNG per part to `tools/assets/out/` (original left, library right). Look at the 3 derailleur pieces with the worst overlap and at the grips.

5. **Loader** `player/src/stage/library.ts`, exactly the API in `05-plan.md`.
   - Load with three's `GLTFLoader.parse` (bytes) or `loadAsync('./parts/library.glb')`.
   - For each node, take its geometry and give it creased normals with `toCreasedNormals(geometry, 35°)` from `BufferGeometryUtils`. Set `userData.lib = true` and keep it in a map.
   - `libGeo` throws a clear error for a name that is not loaded.
   - Change `disposeTree` (in `geo.ts` since session A) to skip geometries with `userData.lib`. Shared geometry must survive a bike being disposed.
   - `main.ts`: `await loadLibrary()` before `new ThreeStage()`, inside the existing try. If loading fails, log a warning and use `PlaceholderStage`, as for a missing WebGL.
   - **Tests:** a Vitest setup for the stage tests loads the library from disk (`readFileSync`) before any `BikeModel` is built. Add `player/test/library.test.ts`:
     - every `LIB_NAMES` entry loads;
     - the triangle counts match `library.json`;
     - geometries survive `disposeTree`;
     - the total stays within budget.

6. **Docs:**
   - Add `npm run parts` and `npm run parts:check` to the command lists in `CLAUDE.md` and `player/README.md`.
   - Add one line about `tools/assets/` to the layout in `CLAUDE.md`.
   - Add a short "Parts library" section to `player/README.md`: library space, the API, how to add a part (mapping file, `npm run parts`, `npm run parts:check`).

7. Run the `verify` skill. Make sure `npm run build` copies `parts/` into `dist/`, and that the e2e run still passes (the library now loads at start). Commit in logical steps, then run the `handoff` skill.
   - In the handoff, list the final triangles per part and the worst overlaps.
   - Add a short table of what the derailleur pieces look like from the renders. Session D relies on it, so correct `05-plan.md`'s table there if a piece turned out to be something else.

## Done when

- `npm run parts` and `npm run parts:check` pass within budget.
- The app loads the library at start and the tests load it from disk.
- All checks pass, and the handoff is pushed.
