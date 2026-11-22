# Session E: other parts, look, credits: progress

## Status

Finished (part 2 of 2). Everything in `05-e-parts.md` is done; the owner looks at the shots (below).

## Done

- Part 1: `6ef6cea` library crank without its fused 34T ring, saddle without its post, `npm run parts:mounts` (`mounts.ts`). `b9ae158` placement of crank, pedals, saddle, collar, stem, bar, grips; pose from measured points; pedal speed and `wheelStep`; credits line in `ui/app.ts`; budgets test (`player/test/parts.test.ts`).
- Part 2: `f849dcb` look: vertex shade on sprockets and chainring (`shadeEdges` in `geo.ts`, `EDGE_DARK = 0.7`), `chainring` in `OUTLINED`, head tube radius 0.03 to 0.04 (the stem foot is 0.047), a test for the shade. Then README (3D section: library, mounts, which parts are generated, recipes for a part and a variant, shortcomings rewritten) and `CLAUDE.md` (`parts:mounts`).
- `55f4e12` Chain (owner feedback: "plain even grey, you cannot tell what you are looking at"): outer plates have 6-sided pin holes, the pin is a dark 2.7 mm head standing in the hole, every link piece has vertex shade (`shadeLink`, `SHADE` in `drivetrain.ts`: plate bright at the holes and darker to the rim, dark edge walls and rollers), chain material `vertexColors`, outer link `k` 1, inner 0.72. Chain triangles 16.7k to 21.3k (test limit 20k to 25k; whole bike 71k / 73k / 80k of 150k). First try (dark ring round the holes) filled the middle of the plate with a dark slot, because the triangles between two holes have only hole vertices; the shade is now inverted. Looked at as a close crop of `chain_close`.
- Look measured (luminance standard deviation of crops of `chain_close`, road): chainring 49.6 to 57.0, cassette 54.1 to 58.8 (shade 0.5 gave 62/63 but the ring went nearly black). A stronger sun (1.3) with less ambient (0.14) gave 55.3 / 59.5, i.e. nothing, so the lights are unchanged.
- Verified: `npm run check`, `typecheck`, `npm test` 121 passed (21.5 s; 12.3 s at the start of part 1, the plates with holes cost 8 s; the limit is +30 s), `test:e2e` 10 of 11 at the end (11 of 11 before the chain change; `extras/navigation` fails on its swipe checks, also with the chain change stashed, so not caused by it; see Gotchas), `npm run shots -- --only road` (stand card looked at), whole road bike, MTB/city/road garage snapshots and a flipped bike looked at.
- Budgets (road 11 / city 8 / MTB 12): meshes 132 / 138 / 143 (limits 148 / 152 / 161), triangles drawn 66.9k / 68.9k / 75.4k (limit 150k). Library 31.9k triangles, 341 KB.

## Interfaces other sessions rely on

- `mounts.ts` (generated, library space, scene units): `MOUNTS.crank {ringFaceZ, spiderR, armAngles[5], pedalDrive, pedalNon, pedalDriveZ, pedalNonZ}`, `.seat {axisP, axisD, collarTop, collarBot, boreR, collarR, headT, postR}`, `.saddle {head, topY, hook, rest}`, `.stem {axisP, axisD, footT, topT, footR, clamp}`, `.bar {halfW, radius, line}`, `.grip {gripIn, gripOut, axisIn, axisOut, rest}`, `.lever {z, at}`, `.shifter {z, at}`.
- `spec.ts`: `BikeSpec` has `seatD`, `saddleH`, `saddleRest`, `xf` (`Xf {c,s,tx,ty}`), `spacer`; `cockpitXf(HT, ha, spacer)`, `xfPt(xf, [x,y])`, `RING_T`. One chain line for every bike: `ringFaceZ + RING_T/2`.
- `BikeModel.setCrank(theta)` turns crank and chainring and keeps `m.pedals` level. Do not set `crankset.rotation.z`.
- `anim.ts`: `PEDAL = 2.1`, `CRANK_SPIN = 1.3`, `WHEEL_MAX_STEP = 0.12`, `wheelStep(rate, dt)`. `pose.ts`: `poseVals`, `mixPose`, `PoseVals`.
- `geo.ts`: toothed plates (`sprocketGeo`, `chainringGeo`) carry a `color` attribute; `BikeModel.add` sets `vertexColors` for any geometry that has one.
- Library yaml: `clip: {r, z}` and `cut: {point, normal}` (cut into triangles).

## Choices made without the owner

- **Library crank came with a fused 34T ring:** cut at 52 mm (`library.yaml`). The new ring is 5 tabs on a 96 mm bolt circle on the spider's 5 arms (`drivetrain.ts`); the 4-tab ring is gone.
- **Chain line** is the crank's for all bikes (`spec.ts`); cassettes and dropouts moved 2 to 17 mm outward.
- **Saddle** library node includes a post; it is cut below the clamp barrel. Saddle stays level and follows the seat tube's position, not its angle. Seat post radius 12.3 mm, seat tube radius = collar bore 13.9 mm (`bike.ts`).
- **Bars are 784 mm wide** on every flat and riser bike (real size). Riser = flat bar on 20 mm spacers (`spec.ts`). Drop bars: library stem, generated bar and hoods and levers.
- **Flipped rest points:** saddle's highest vertex and the grip's highest vertex (hoods for drop bars); tests allow 2 mm (saddle), 4 mm (grips) and 20 mm (drop bar hoods).
- **Lever clamp** 12 mm inboard of the grip, shifter 26 mm further in (`measure-mounts.ts`).
- **Colours:** saddle and grips `dark`; stem, bar, crank, pedals in the part colour; collar `k 0.8`.
- **Part 2:** sprocket and chainring shade strength 0.7 (a drawing value, `geo.ts`); head tube 40 mm across; lights unchanged because the test showed no gain.

## Questions for the owner

1. Bars are 784 mm wide on city and riser bikes (a touring MTB bar). Keep, or cut the bar at the clamp ends to about 640 mm? Recommended: keep until a second bar source exists.
2. Is the sprocket and chainring shade (darker hole edges and tooth gaps) enough depth? Stronger (`EDGE_DARK` 0.5 in `geo.ts`) reads more but darkens the chainring a lot. Recommended: keep 0.7.

## Next steps (what still looks generated; sources to find)

1. A road bike model in `assets-src/` for the drop bar, hoods and brake levers, rim brakes and the front derailleur (all missing or generated now).
2. An MTB derailleur source (the library's is touring/road; the 10-51 cage is a stretched copy).
3. Disc brakes and a suspension fork; a full-suspension frame; the electronic derailleur.
4. Generated parts that still stand out next to real ones: frame tube ends and dropouts, hubs (no flanges), tyres (round section), the shifter and the generated levers. Each needs only a small shape fix, not done.
5. Second variants of a slot (clipless pedals, other saddles): recipe in `player/README.md`.

## Gotchas

- `mounts.ts` is generated: run `npm run parts` then `npm run parts:mounts` after any yaml change.
- `parts:check` clips the source in a shader in `check-page.html` (`clippedBlack`); box difference is skipped for `cut` parts.
- Scratch scripts in `tools/assets/out/` (git-ignored): `rd-views.ts` (a view of the built app; needs `npm run build`), `lum.mjs` (luminance std of crops), `snaps.ts` + `montage.mjs` (garage snapshots road/city/MTB, result `snaps.png`), `budget.ts`. Shots for the owner: `tools/assets/out/snaps.png`, `rdv-flip.png`, `player/e2e/shots/slow/`.
- `rd-views.ts` treats any bike other than `mtb` as road, and fades everything except the focus node (the `handlebar_from_above` view shows the bike mostly transparent).
- A JS `replace()` with `$$` in the new text turns it into `$`; patch with a function replacement.
- **e2e `extras/navigation` fails on its touch swipes** (`swipe up did not go to the next step`, `the edge swipe on the first card did not leave it`) in 5 runs in a row at the end of part 2, also with `drivetrain.ts` stashed; it passed 11 of 11 earlier the same day and once in part 1 on re-run. The swipes are 8 touch moves and a 150 ms wait over CDP, with software WebGL on a loaded machine. **Fixed afterwards:** CDP delivers one touch event per rendered frame (about 100 to 160 ms with software WebGL), so the swipe took 0.95 to 1.5 s and missed the swipe-up's 900 ms limit (`performance.now()`). The edge-swipe error only followed from that. The app now times both gestures by `e.timeStamp` (when the finger moved, not when a busy page handled it; `flow.ts`, `edge.ts`), and `swipe()` gives each event a time stamp 16 ms apart. 11 of 11 in 3 runs in a row.
- `.gitignore` and `assets-src/overview.md` were modified by someone else during this session; not committed by me. Untracked `assets-src/fv1 - HARDTAIL by FEHE/` is not from this session.
