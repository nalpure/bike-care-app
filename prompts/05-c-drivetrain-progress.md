# Session C: drivetrain with real shapes: progress

## Status

Finished (one part). Session D can start. Nothing was left out of tasks 1 to 10 except the points under "Choices".

## Done

- `53ef52b` Real spacing, chain width by speeds, `sprT`, table of common cassettes (`cassetteFor`, also reads a range in `drive.cassette_model`), clearance test adapted, tests for the table and the spacing rule.
- `f9d84e8` `geo.ts`: `toothOutline`, `sprocketGeo`, `chainringGeo`.
- `44f4f9b` Chain of real links in pins (`pins.ts`, `chain.ts` exact path pieces, `drivetrain.ts`), sprocket block turns with the chain, tests for pin phase, pitch and budgets, README, `derailleur_from_behind` closer (camera 0.75 behind the axle, was 0.95).
- Verified: `npm run check`, `npm run typecheck`, `npm test` (104 tests, 11.5 s; 9.5 s at the start), `npm run test:e2e` (11 of 11), `npm run build` + `npm run shots -- --only road` (4 screenshots read: derailleur view smallest and largest sprocket, whole bike in the stand).

### Numbers (budgets)

| Bike | Meshes (before) | Triangles drawn (before) | Cassette | Chainring | Chain (most links) |
| --- | --- | --- | --- | --- | --- |
| road 11 | 149 (148) | 46588 (22328) | 8512 | 1940 | 17.9k |
| city 8 | 153 (152) | 42116 (20276) | 6256 | 1748 | 17.6k |
| MTB 12 | 162 (161) | 47164 (21208) | 12500 | 1296 | 18.1k |

One mesh more than before everywhere: chain has 2 instanced meshes (was 1), the chainring 1 (was 2), and a freehub body mesh in `rear_wheel` is new. Session E cuts meshes with the library crank, so the budget should hold at the end.

## Interfaces other sessions rely on

- `spec.ts`: `BikeSpec.sp` real spacing, `sprT` sprocket thickness (units), `chainW` chain outer width by speeds, `zDrop = zs[0] + 0.0245`. `cassetteFor(kind, n, model?)`. Rules are in the comments above `CASSETTES`, `cassetteFor` and `bikeSpec`.
- `geo.ts`: `SEAT_R`, `TIP_OVER`, `toothOutline(teeth)` (gap k centred on angle `k * 2 pi / teeth`, on the pitch circle `rOf(teeth)`), `sprocketGeo(teeth, thick)`, `chainringGeo(teeth, thick, bolts, bcdR, tab0)`.
- `chain.ts`: `buildPath` now also fills `path.segs` (exact arcs and runs); `bend` (z smootherstep). `pins.ts`: `layPins`, `pathAt`, `chordLength(path, pitch)` (taut chain length around the path, in the same units), `pitchAngle(r, p)`, `newPins`.
- `BikeModel`: `cassetteG` (the sprocket block, turns with the chain; `rearHub` now only holds the wheel), `chainInner`, `chainOuter` (InstancedMesh), `pins` (`x y z wheel parity`, wheel index = index in `circ`: 0 chainring, 1 sprocket, 2 and 3 pulleys, -1 on a run), `N` (capacity), `links` (links laid now), `crankset.rotation.z = chainShift / rc` (set by `layChain`; `three-stage.ts` sets the same value after).
- Gap centres: chainring `crankset.rotation.z + k * 2 pi / chainring`; sprocket block `cassetteG.rotation.z + k * 2 pi / teeth` (about the axle).
- `drivetrain.ts`: `nearestSprocket(B, z)`.

## Choices made without the owner

- **Chamfer on the teeth dropped.** A bevel doubles the triangles (MTB 12 would be about 20k against the budget of 15k). Teeth have flat faces. In `geo.ts` (`extrude`).
- **Sprocket thickness** is 1.8 mm, thinner (down to 1.2 mm on 13 speeds) where the chain would touch the next sprocket; chain width is the outer width over the pin heads. `spec.ts`.
- **Dropout** sits 0.0245 units (12 mm) outside the smallest sprocket, a fixed distance (was `sp * 0.25 + 0.022`). Pulley width is `chainW * 0.7` (`derailleur.ts`, one line).
- **Cassette sequences** in `CASSETTES` are partly even-ish spreads with the right first and last tooth (marked in the comment). Rows are drawing data.
- **Link count follows the taut length.** The derailleur's cage does not take up chain length (it keeps the gap), so the taut length differs by up to 24 links between gears (MTB). `layChain` lays `round(chordLength / pitch)` links (at most `N`, the longest over all gears and gaps plus 1), so the count changes while shifting and the free run before the chainring sags by at most half a link. Session D's plan (cage turns until the chain has a fixed length) makes the count constant: then set `N` there to "big-big plus two links" and the sag disappears.
- **Free run** (last wheel to chainring) holds the leftover length as an arc of equal links, bulging down. Links stretch up to about 1% there if the chain is short.
- **Chainring** has 4 bolt tabs up to 34 teeth, else 5; bolt circle 104 mm (4 tabs) or 110 mm, tab 0 points along the current crank arm. Session E: match the library crank's spider.
- **Camera:** `derailleur_from_behind` 0.75 behind (was 0.95); not checked on an MTB 12 in portrait, only the road bike. Session D re-tunes.
- **Tests:** the chain clearance test uses plate half-height 0.008 and the sprocket half thickness instead of `sp * 0.25`; the chain path leaves a wheel in smootherstep (was smoothstep) so it stays in its plane near the next sprocket.

## Questions for the owner

None open.

## Next steps

1. Session D (`05-d-derailleur.md`): use `chordLength` and `layPins` for the cage solution; pulleys sit on a circle of `RP = 0.04` (spec.ts), while 11-tooth pulleys on a 12.7 mm chain need `rOf(11) = 0.0451`: choose the pulley's pitch radius from its tooth count and set `RP` (and `circ[2]`, `circ[3]` radii) to match, then spin them from `pins.wheel === 2 / 3` like the sprocket block in `layChain`.
2. Session E: replace the crank meshes; the chainring is one mesh centred on the axle (`m.add('chainring', chainringGeo(...))`).
3. Whole-bike budgets are above; MTB 12 has the highest mesh count (162).

## Gotchas

- `tools/stage-digest.ts` still runs (it needs no library yet); its old baseline no longer matches, by design.
- Shell heredocs containing quotes or backticks broke twice: write scratch scripts with the Write tool, keep them outside `player/` and `tools/`.
- `chain` clearance test samples the path polyline, not the pins; the pins test is `sets every pin on a wheel in a tooth gap...`.
- The shots script only has road and city bikes; no MTB 12 portrait view was looked at.
