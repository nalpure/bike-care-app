# Session E: other parts, look, credits: progress

## Status

Part 1 of 2 done: tasks 1, 2, 3, 5, 6, 7 (mounts, placement, pose, pedal speed, budgets, credits). Left for part 2: task 4 (look and depth, generated parts), task 8 (README), task 9 (shots, handoff).

## Done

- `6ef6cea` Library: `crank_arms` has its fused 34-tooth ring cut off, `saddle` has its seat post cut off (new yaml options `clip` and `cut`, in `build-library.ts`; `check-page.html` clips the source the same way, so `npm run parts:check` still compares like with like). `tools/assets/measure-mounts.ts` (`npm run parts:mounts`) writes `player/src/stage/mounts.ts`.
- `b9ae158` Placement: `drivetrain.ts` (library crank, level pedals, 5-tab chainring on the spider), `bike.ts` (collar, post, saddle, seat tube radius, stand clamp, hook), `cockpit.ts` (library stem, bar, grips; levers and shifter at measured spots), `spec.ts` (mount maths), `pose.ts` (moved out of `three-stage.ts`), `anim.ts` (pedal speed, `wheelStep`), credits line in `ui/app.ts`, e2e check, `player/test/parts.test.ts` (8 tests).
- Verified: `npm run check`, typecheck, `npm test` 119 passed (12.8 s; 12.3 s at the start), `test:e2e` 11 of 11 (one flaky run of `extras/navigation`, passed on re-run), road shots and a flipped road bike looked at.
- Budgets now (road 11 / city 8 / MTB 12): meshes 132 / 138 / 143 (limits 148 / 152 / 161), triangles drawn 66.9k / 68.9k / 75.4k (limit 150k). Library 31.9k triangles, 341 KB.

## Interfaces other sessions rely on

- `mounts.ts` (generated, library space, scene units): `MOUNTS.crank {ringFaceZ, spiderR, armAngles[5], pedalDrive, pedalNon, pedalDriveZ, pedalNonZ}`, `.seat {axisP, axisD, collarTop, collarBot, boreR, collarR, headT, postR}`, `.saddle {head, topY, hook, rest}`, `.stem {axisP, axisD, footT, topT, footR, clamp}`, `.bar {halfW, radius, line}`, `.grip {gripIn, gripOut, axisIn, axisOut, rest}`, `.lever {z, at}`, `.shifter {z, at}`.
- `spec.ts`: `BikeSpec` lost `saddleX/saddleY` and `gripOf`; has `seatD`, `saddleH` (clamp of the saddle on the post), `saddleRest`, `xf` (`Xf {c,s,tx,ty}`, library to bike for stem, bar, grips), `spacer`, and `C/S/barTop` now from the stem and bar. `cockpitXf(HT, ha, spacer)`, `xfPt(xf, [x,y])`, `RING_T`. One chain line for every bike: `chainline = ringFaceZ + RING_T/2` (0.11715, was 0.100 to 0.115).
- `BikeModel.setCrank(theta)` turns crank and chainring and keeps `m.pedals` (hang groups) level. Use it, not `crankset.rotation.z`.
- `anim.ts`: `PEDAL = 2.1`, `CRANK_SPIN = 1.3`, `WHEEL_MAX_STEP = 0.12`, `wheelStep(rate, dt)`. `pose.ts`: `poseVals`, `mixPose`, `PoseVals`.
- Library yaml: `clip: {r, z}` (outside a circle about z, inside a z slab, mm) and `cut: {point, normal}` (keep the normal's side). Both are cut into the triangles, not removed whole.

## Choices made without the owner

- **The library crank came with a fused 34T ring** (the plan's "drop carbon steel-7" removes something else). I cut it at 52 mm (`library.yaml`). The new ring is always 5 tabs on a 96 mm bolt circle on the spider's 5 arms (`drivetrain.ts`); the 4-tab ring is gone.
- **Chain line** is the crank's for all bikes (`spec.ts`), so cassettes and dropouts moved 2 to 17 mm outward.
- **Saddle:** the library node includes a seat post; it is cut below the clamp barrel (`library.yaml`, comment there). The saddle stays level and follows the seat tube's position, not its angle. Post comes out 122 mm from the collar (+20 mm on road). Seat post radius 12.3 mm, seat tube radius = collar bore 13.9 mm (`bike.ts`).
- **Bars are 784 mm wide** on every flat and riser bike (real size). Riser = flat bar on 20 mm spacers (`spec.ts` comment). Drop bars: library stem, generated bar (middle 15.9 mm radius, drops 11.9 mm), generated hoods and levers.
- **Flipped rest points:** the saddle's highest vertex (the tail tip) and the grip's highest vertex (hoods for drop bars). Test: lowest point of saddle within 2 mm of the ground, grips or hoods within 4 mm (20 mm for drop bars), nothing below the ground.
- **Lever clamp** 12 mm inboard of the grip, shifter 26 mm further in (`measure-mounts.ts`). Lever blade and shifter shapes are the old generated ones, moved.
- Saddle and grips are `dark`, stem, bar, crank, pedals in the part colour (`k`), collar `k 0.8`. Library parts are outlined only where already listed in `OUTLINED` (`crank`).
- `handlebar_from_above` camera moved back for the wide bar (`views.ts`); looked at on MTB only.

## Questions for the owner

1. Bars are 784 mm wide on city and riser bikes (a touring MTB bar). Keep, or cut the bar at the clamp ends to about 640 mm? Recommended: keep until a second bar source exists.

## Next steps

1. Task 4 (look): measure first. Crop chain and cassette from `chain_close` (e.g. `npx tsx tools/assets/out/rd-views.ts <tag> road chain_close upright - 390 360`, needs `npm run build`), write the luminance standard deviation. Then try key light up and ambient down in `three-stage.ts` (near the lights), the chainring in `OUTLINED`, vertex colours darkening to the hole, gaps and rims. Keep only what raises it without hurting the bike. No shadow maps, post effects, outline copy of the chain.
2. Look at the generated parts next to the real ones: frame tube ends, dropouts, hubs, tyres, levers. Check the head tube (r 0.03) against the stem foot (r 0.047), the generated drop bar against the stem clamp, the lever and shifter size against the wide bar. Small fixes only; list the rest.
3. Task 8: `player/README.md` 3D section (library, mounts, `parts:mounts`, which parts stay generated and why, recipe for a new library part or a second variant such as clipless pedals), file table (`mounts.ts`, `pose.ts`; `gripOf` is gone), "Known 3D shortcomings" rewritten (one look per part; no drop-bar levers, disc brakes, suspension fork, MTB derailleur from a real source; electronic derailleur to come). `CLAUDE.md` command list: add `npm run parts:mounts`.
4. Task 9: garage snapshots of road, city, MTB; one card view; the bike upside down (at most 5 looked at). In the handoff, list what still looks generated and the next sources (road bike model in `assets-src/` for drop bar, levers, rim brakes, front derailleur; an MTB derailleur). Untracked `assets-src/fv1 - HARDTAIL by FEHE/` is not mine.

## Gotchas

- `mounts.ts` is generated from the built library: run `npm run parts` then `npm run parts:mounts` after any yaml change.
- `npm run parts:check` source-side clipping is a shader in `check-page.html` (`clippedBlack`); box difference is skipped for `cut` parts.
- Scratch scripts: `tools/assets/out/` (git-ignored): `mounts-view.ts` (markers on the source parts), `rd-views.ts` (views of the built app), `budget.ts` (meshes and triangles).
- A JS `replace()` with `$$` in the new text turns it into `$`; write patches with the Write tool and check `$$eval`.
- The e2e `extras/navigation` swipe check failed once while `extras/feedback...` crashed; it passed on re-run.
