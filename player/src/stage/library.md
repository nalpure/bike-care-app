# Parts library: reference

Read this when you add or change a library part, or touch `library.ts`. The build side (yaml, measuring) is in `tools/assets/CLAUDE.md`.

Real part shapes come from a CC BY model in `assets-src/`, split into pieces and simplified by `npm run parts` into `player/public/parts/library.glb` (one mesh per part, positions and indices only, quantized) with `library.json` (per part: source nodes, triangles before and after, box and size in mm; also the steering axis and angle) and `CREDITS.txt`. The app fetches the file at start (`main.ts` calls `loadLibrary()` before it creates the stage; if that fails it falls back to `PlaceholderStage`). Tests load it from disk in `player/test/setup-library.ts`.

- **Library space:** scene units (1 unit = 0.5 m), x forward, y up, z to the drive side, origin at the source's bottom bracket centre (`lib = 2 x (src.z, src.y, -src.x)`, metres). Parts are not moved to their own origin: measure turning and mounting points in this space and place parts from there. The front parts (stem, bar, grips) are stored turned straight.
- **API (`stage/library.ts`):** `LIB_NAMES`, `loadLibrary(bytes?)`, `hasLibrary()`, `libGeo(name)`: shared geometry in library space with creased normals (35°), `userData.lib = true`. Never dispose it; `disposeTree` skips it.
- **Library names are pieces, not registry nodes:** the builder maps pieces to nodes.
- **Credit:** the app must credit every model it uses (`CREDITS.txt` has the text).
- **Budgets:** at most 35k triangles and 1.5 MB for the library (`parts:check` fails above that).
- **Add or change a part:** edit `tools/assets/library/library.yaml` (source nodes by their original glTF names, materials to drop, `front`, the share of triangles to keep), add the name to `LIB_NAMES`, run `npm run parts`, then `npm run parts:check` (overlap of at least 0.97 and a box within 0.5 mm of the source, from 6 directions). Another source model is another yaml file and another `source:`.
- The tables in the yaml are drawing data (shapes), not facts about parts (hard rule 3).
- **Which parts are library and which generated:**
  - Library: derailleur (`rd_*`), crank arms, pedals, saddle, seat collar, stem, flat bar, grips.
  - Generated, because they depend on the bike's facts: frame, fork, wheels, sprockets, chainring, chain.
  - Generated, because there is no source yet: drop bar, hoods and brake levers, shifter, cables, stand, hook, kickstand, battery.
- **Fixed size, placed per bike:** a library part keeps its real size on every bike; only its position follows the geometry (`spec.ts` mount maths, `bike.ts`, `cockpit.ts`, `drivetrain.ts`). The mounting points come from `mounts.ts`, never from numbers typed by eye.
- **Add a library part:** the steps above, then `npm run parts:mounts` if it has a mounting point, add the point to `measure/mounts.ts`, build the part under its registry node in the builder, and add a placement check to `player/test/parts.test.ts`.
- **A second variant of a slot** (for example clipless pedals next to the flat ones): add the pieces under new names in `library.yaml` and `LIB_NAMES`, measure their mount the same way, and choose between the variants in `bikeSpec` from a fact (write the rule as a comment there). Do not keep both drawings for one case: delete the generated or old shape when the new one replaces it.
- **Look of the generated toothed parts:** sprockets and the chainring carry vertex colours (dark at hole edges and in tooth gaps, `shadeEdges` in `geo.ts`), the chainring is in `OUTLINED`. A stronger key light with less ambient light was tried and changed the contrast of the chain and cassette by less than 2 per cent, so the lights stay as they were. The chain is shaded the same way (`shadeLink` in `drivetrain.ts`): bright plates darker towards their rim, dark pin heads standing in the plates' holes, dark edge walls and rollers. It costs triangles (the chain is about 21k of the 25k its test allows) and no draw calls. Not used, on purpose: shadow maps, post-processing, an outline copy of the chain.
