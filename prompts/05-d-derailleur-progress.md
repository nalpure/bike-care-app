# Session D: the real derailleur: progress

## Status

Finished (part 3 of 3). Tasks 1-9 done; task 10: screenshots are made, the owner looks at them.

## Done

- Part 1 (`344e8a4`, `f35d3f6`): `npm run parts:rig` (`tools/assets/measure-rd.ts`) writes `rd-rig.ts`; `rd-kin.ts` (four-bar, `rdPose`); `player/test/derailleur.test.ts` (closure, round trip).
- Part 2 (`eeae3cb`, `0007619`): `rd-fit.ts` (fit per bike), `derailleur.ts` rewritten on the library pieces (old `derGeom`/`derPose`/constants gone), chain of fixed length, pulleys spin with the chain, screws, barrel/stop, cable; 2 new tests in `stage.test.ts` plus the clearance test rewritten (all 16 cassettes: road 8-12, city 5/7-10, MTB 8-13); README file table and the two derailleur "Known shortcomings" lines.
- Part 3 (`befcab4`, `c656eac`, `0d6bab7`): views re-framed (task 7), `limit-screw-align` offset cut to the links reach, outline angle kept at 35 deg (task 6), README `parts:rig` row, MTB 12 bike in `player/e2e/slow.ts`. Verified at the end: `npm run check`, typecheck, `npm test` 111 passed 18.8 s, `test:e2e` 11 of 11, road and MTB shots.
- Verified in part 2: `npm run check`, `npm test` 111 passed, 14.8 s (12.5 s at the start), typecheck, `test:e2e` 11 of 11, road shots (looked at 4).
- Budgets (`npx tsx tools/stage-digest.ts <out.json>`, now loads the library): road 11 130 meshes / 53.9k triangles, city 8 138 / 48.3k, MTB 12 147 / 54.9k (before the round 148/152/161 meshes; limit 150k triangles).

### Measured per cassette (GAP_OK; mm)

Gap on the largest is 5.5 everywhere. Largest gap on the other sprockets: 11-28 9.7, 11-32 15.6, 11-34 19, 11-36 19, 14-28 8, 11-42 26, 10-51 40-43. Hanger bolt 30 mm from the axle (11-36: 33, 11-42: 45, 10-51: 64). Cage stretch 0 except 10-51: 21 mm (82 -> 103). Chain 106-116 links, taut in every gear. Upper-pulley wrap 112 deg (road, 11T) down to 28 deg (MTB, 51T). Solve about 0.5 ms; a new gap about 3 ms.

## Interfaces other sessions rely on

- `derailleur.ts`: `fitFor(B)` (cached `RdFit` per spec), `upperPulley(B, z, gap?)`, `lowerPulley(B, z, gap?)` ([x, y]), `derLayout(B, z, gap)` -> `{r, gx, gy, gz, lx, ly, lz, st}`, `barrelTurn(B)`, `buildDerailleur`, `moveDerailleur`, `spinPulleys`, type `Turn`, `DerParts` (`fit`, frames `upper linkOuter linkInner lower cage pulleyU pulleyL`, `st`, `housing`, `wire[3]`, `housingFrom`, `bScrew`, `spin`). Library meshes hang in frames with `matrixAutoUpdate = false`; their geometry stays in library space.
- `rd-fit.ts`: `RdFit` (`bolt`, `links`, `stretch`, `solve(z, body)`, `bodyFor(gap)`, `gapOf`, `rAt`), `RP_RD`, `CAGE_LEN`, `CAGE_DIR`, `cageStretch(B)`, `CAGE_PER_TOOTH`, `BOLT_DIR`, `BOLT_MIN`, `RdFit.CAGE_STOP`.
- `BikeModel.layout(z, gap)` returns `derLayout`; `setDer` = move, `layChain`, `spinPulleys`. On derailleur bikes `m.N = fit.links + 2` and `layChain` lays `fit.links` links.
- `spec.ts`: `RP = rOf(11)`; `LC` removed; `GAP_BIG = 0.022`. Shared derailleur geometry (pulleys, stretched cage, barrel) has `userData.lib = true`, so `disposeTree` keeps it; the lower pulley mesh has `userData.pulley`.
- Test helper `meshPoints(m, ids, steps, { stride, noPulleys })`: vertices only for `userData.lib` geometry.

## Choices made without the owner

- **GAP_BIG 11 mm** (was 18; twice GAP_OK). 18 mm needed a hanger long enough to push the right gap into a fold of the geometry, where the chain went slack. `spec.ts`.
- **Bolt** 105 deg (below, slightly behind the axle), at least 30 mm, longer when the largest sprocket needs it (rule in `rd-fit.ts`). 10-51 gets a 64 mm hanger.
- **Gap range in the test:** 2-20 mm up to 36 teeth, 2-45 mm above (`stage.test.ts`). The source derailleur's slant cannot follow a wide cassette.
- **Cage stops** -55/+60 deg from the source angle (about 36 teeth of wrap at 3.1 deg per tooth); long cage 4.25 mm per tooth of wrap beyond 36, only when the largest is above 36. 11-42 (wrap 31) keeps the 82 mm cage. `rd-fit.ts`.
- **Pulleys:** library hub plus a generated 11-tooth ring (`pulleyGeo`). **Hanger** plate from the axle to the bolt and the tab, 4.5 mm, outside the dropout. **Wire** exits the body 9.5 mm past the barrel seat and bends at a searched point (`WIRE_BEND`) to stay outside the pieces; it still grazes the inner link by 1-2 mm in some gears. **Housing** comes in 20 mm along the barrel's axis.
- **H/L shanks 10 mm, B screw sticks out 3 mm** at the right gap; tab placed at the B screw's tip on the middle sprocket at GAP_OK.
- New file `rd-fit.ts` (pure maths) instead of putting the solver into `derailleur.ts`.

- **Views (part 3):** from-behind view stands off `max(0.5, 1.75 x frame height)` and frames from 0.07 above the upper pulley to 0.02 under the lower pulley, over the first and last gear (`views.ts`). Side close-up 0.3 / 0.28 from the gap, barrel close-up 0.39 away.
- **Outlines:** kept at 35 deg; edge counts barely change up to 75 deg (200-650 segments a piece), so nothing to tune.
- **limit-screw-align:** offset is min(2 sprockets, what `derLayout` can reach) (`anim.ts`), so on MTB 12 the pulley starts less far out of line.

## Questions for the owner

1. On 11-42 and 10-51 the upper pulley sits 26-43 mm below the small sprockets, and 10-51 needs a 64 mm hanger. Accept until a mountain bike derailleur source exists? Recommended: yes, and look for a CC BY MTB derailleur (Eagle-style) as the next library source.

## Next steps

1. Owner: look at the shots (below), decide question 1.
2. Session E (`05-e-parts.md`) next. A future MTB derailleur source (Eagle-style) would replace the long hanger on wide cassettes.

## Screenshots for the owner

- `npm run build && npm run shots -- --only road` and `-- --only mtb`: `player/e2e/shots/slow/road-stand-*` and `mtb12-stand-*` (a PNG is named after the card before it).
- Derailleur views, upright and upside down (scratch script `tools/assets/out/rd-views.ts`, git-ignored: `npx tsx tools/assets/out/rd-views.ts <tag> road|mtb <view> upright|flipped - 390 360`; needs `dist/`): output `tools/assets/out/rdv-<tag>.png`.

## Gotchas

- The chain length jumps where the chain's wrap flips (cage far forward): a root finder lands on the jump. `cageFor` only accepts a crossing where |length - chain| < 1e-5 and scans from the slack end otherwise.
- `npm run shots` names each PNG after the previous card (off by one).
- Scratch scripts that import `three` go in `tools/assets/out/` (git-ignored); `explore-*.ts` there are part 2's probes (bolt scan, cage swing, wire search).
- `measure-rd.ts` output is seeded and stable (about 25 s); check `--explore` before trusting a moved value.
