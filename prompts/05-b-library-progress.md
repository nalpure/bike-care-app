# Session B: parts library: progress

## Status

Finished (one part). Sessions C, D, E can use the library. Nothing draws library parts yet.

## Done

- `541ce69` `tools/assets/library.yaml` (mapping), `build-library.ts` (`npm run parts`), `check-library.ts` + `check-page.html` (`npm run parts:check`), devDependencies (`@gltf-transform/core|extensions|functions` 4.5.1, `meshoptimizer` 1.1.1, pinned), and the built `player/public/parts/` (`library.glb` 348 KB, `library.json`, `CREDITS.txt`).
- `0a47a65` `player/src/stage/library.ts`, `main.ts` (`await loadLibrary()` inside the stage `try`, else `PlaceholderStage`), `disposeTree` skips `userData.lib`, `player/test/setup-library.ts` (global `setupFiles` in `vitest.config.ts`), `player/test/library.test.ts` (5 tests).
- `6ebf55c` docs: `CLAUDE.md` (layout, commands), `player/README.md` (commands, file table, "Parts library").
- Verified: `npm run check`, `npm test` (100 tests; 11.3 s, was 9.3 s at the start), `npm run typecheck`, `npm run build` (`dist/parts/` has the three files), `npm run test:e2e` (11 of 11). One e2e screenshot (bike page, road bike): 3D bike as before.

### Library numbers

32510 triangles in all (budget 35000), 348 KB (budget 1.5 MB). `parts:check` prints overlap in the worst of 6 directions; box difference is at most 0.17 mm.

| Part | Tris before | after | Size mm (x forward, y up, z across) | Worst overlap |
| --- | --- | --- | --- | --- |
| rd_upper_body | 6360 | 1584 | 64.6 x 53.5 x 41.6 | 0.9999 |
| rd_barrel | 3418 | 1098 | 19.4 x 17.7 x 13.8 | 1.0000 |
| rd_link_outer | 1932 | 482 | 50.7 x 35.9 x 32.0 | 1.0000 |
| rd_link_inner | 904 | 904 | 47.9 x 32.6 x 30.4 | 1.0000 |
| rd_lower_body | 6286 | 1570 | 39.7 x 32.9 x 42.8 | 1.0000 |
| rd_cage_outer | 868 | 868 | 60.1 x 128.5 x 3.0 | 1.0000 |
| rd_cage_inner | 1362 | 1358 | 64.9 x 114.4 x 10.4 | 1.0000 |
| rd_pulley_upper / lower | 4416 | 1324 each | 41.7 x 42.0 x 14.0 | 1.0000 |
| rd_hanger | 526 | 526 | 40.7 x 35.8 x 14.0 | 1.0000 |
| crank_arms | 16562 | 2439 | 157.5 x 320.6 x 174.0 | 0.9997 |
| pedal_drive / nondrive | 7468 | 1104 each | 81 x 52 x 120 | 1.0000 |
| saddle | 30084 | 3566 | 253.6 x 252.1 x 164.3 | 1.0000 |
| seat_collar | 12756 | 1904 | 45.0 x 24.6 x 34.5 | 1.0000 |
| stem | 33964 | 3525 | 116.4 x 92.4 x 51.0 | 0.9996 |
| bar_flat | 5142 | 2008 | 61.1 x 67.9 x 783.9 | 1.0000 |
| grip_drive / nondrive | 73138 | 2910 / 2912 | 57.0 x 49.9 x 166.5 | 0.9959 / 0.9967 (worst of all) |

Un-steer: axis from the centre of `Lower Cup.STEP-1` (428.0, 391.4, 0) mm to `Lower Cup.STEP-2` (374.7, 546.2, 0) mm in library space (x forward, y up), turn by **41.35°** (right-handed about a to b). Grips mirror within 0.08 mm; the bar is centred (0.00 mm) with level, straight ends (0.02 mm). The plan said "about 45 to 60°" for the steering; the measured angle is 41.35°.

### Derailleur pieces (colour render of the source, confirmed)

`05-plan.md`'s table is right; no correction. Seen from the drive side: `rd_upper_body` (purple) is the bolt drum with hex socket, a curved body and an arm ending at `rd_barrel` (cyan, a small knurled barrel). `rd_link_outer` (olive) is the broad link nearest the viewer, `rd_link_inner` (teal) a thin link behind it. `rd_lower_body` (magenta) is the rounded P-knuckle at the link ends. `rd_cage_outer` (blue) is the long plate on the outside, with a hole near the lower pulley and the lower pulley inside its loop; `rd_cage_inner` (orange) is the shorter plate inside. Pulleys (`rd_pulley_upper` green, `rd_pulley_lower` red) are toothed wheels about 42 mm across and 14 mm thick. `rd_hanger` (yellow) hangs above the body.

## Interfaces other sessions rely on

- `player/src/stage/library.ts`: `LIB_NAMES`, `LibName`, `loadLibrary(bytes?: ArrayBuffer)` (idempotent), `hasLibrary()`, `libGeo(name)`. Geometry is in library space (scene units, x forward, y up, z to the drive side, origin at the bottom bracket), non-indexed, with creased normals (35°), `userData.lib = true`. A name that is not loaded throws "Library part ... is not loaded".
- `player/public/parts/library.json`: `steering { a, b, axisDir, angleDeg }` (library space), `pairs`, `totalTriangles`, `bytes`, and per part `source`, `drop`, `front`, `ratio`, `trisBefore`, `trisAfter`, `box {min,max}` (scene units), `sizeMm`. Measure turning and mounting points from the geometry in library space (session D); this file has no turning points.
- `libGeo` only works after `loadLibrary`. App: `main.ts` does it. Vitest: `player/test/setup-library.ts` does it for every test file. **`tools/stage-digest.ts` does not load it yet**: add the same few lines there once a builder calls `libGeo` (otherwise the digest throws).
- `disposeTree` (`geo.ts`) skips geometry with `userData.lib`.
- Commands: `npm run parts`, `npm run parts:check [-- --shots]` (PNGs in `tools/assets/out/part-<name>.png`, original left, library right).

## Choices made without the owner

- **Targets changed from the prompt's table** because the budget check failed (36.4k > 35k) with the first set: `crank_arms` 15% (was 20%), `saddle` 12% (was 15%), `stem` 10% (was 15%), `seat_collar` 15% (was 20%). Overlap stayed at 0.9996 or better. In `tools/assets/library.yaml`.
- **Grips use `error: 0.01`** (default 0.002): at the default meshoptimizer stops at about 5000 triangles each, not 2900. Overlap 0.996 and box 0.17 mm.
- **Quantized file with a node transform:** `KHR_mesh_quantization` stores integer positions with a scale and translation on each node, so the nodes are not identity transforms as the prompt says. The loader (`toLibSpace`) bakes that transform into plain float positions, so `libGeo` is in library space as promised. Positions are 16 bits (below 0.01 mm).
- **Stem group:** the stem = stem body, top cover, headset cap and the 6 socket screws (4 x M5, 2 x M8). The countersunk M6 screw (`socket countersunk head screw_am_B18.3.5M ...`, in the fork assembly) is left out.
- **Which grip/pedal is the drive one** is decided in the build from the sign of the mean z after un-steering (`pairs` in the yaml). Here both were as listed (STEP-2 grip, STEP-3 pedal on the drive side).
- **Setup file runs for all test files** (global `setupFiles`), not only the stage test: costs about 0.1 s per file.
- **Shots render one 3/4 view** per part (same camera both sides), not six.

## Questions for the owner

None open.

## Next steps

1. Session C (`05-c-drivetrain.md`): no dependency on the library.
2. Session D (derailleur, Opus): load the pieces with `libGeo('rd_...')`, measure the turning points in library space (hole geometry), delete `derGeom`'s generated pieces; add the library load to `tools/stage-digest.ts` if you still use it; credit line is session E.
3. Session E: `CREDITS.txt` has the text for the credits line in `player/src/ui/app.ts`. The whole-bike budget (150k drawn triangles, no more meshes than before: 148 road, 152 city, 161 MTB) is yours to watch.

## Gotchas

- Do not read the `.gltf`, `.glb` or `.bin`. Use `library.json`, `parts:check --shots` PNGs, or `tools/assets/explore/*`.
- Source node names with a trailing space (the 8 x 1.25 x 25 screw) need quotes in YAML.
- Merging in `bake()` works on gltf-transform names (original). In the page, `check-page.html` finds source objects by `userData.name` (three.js keeps the original there).
- A bash heredoc with backticks mangles template strings: write scratch scripts to a `.cjs` file.
- `parts:check` needs Chromium from the `playwright` install (the same as `test:e2e`); about 5 s.
- `git pull --rebase` fails while the three deleted prompt files are unstaged: use `--autostash`.
