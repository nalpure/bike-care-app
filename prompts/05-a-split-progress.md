# Session A: split the bike builder: progress

## Status

Finished (one part). Sessions B to E can start.

## Done

- `56d7d66` `tools/stage-digest.ts`: fingerprint of the generated bike (13 bikes, 143 steps: per mesh the part id, world matrix, instance matrices, position-array hash).
- `622e76d` `bike.ts` (1433 lines) split into modules; the digest is identical before and after (`cmp` of the two JSON files). `npm run check`, `npm run typecheck`, `npm test` (95 tests, 9 s, was 11.6 s at the start) and `npm run test:e2e` (11 of 11 journeys) pass. One screenshot (the garage preview of the road bike) looks as before.
- Docs: the stage file table in `player/README.md`, the pointer in `player/CLAUDE.md` (rules for `bikeSpec` go in `spec.ts`), the stale "twice as wide" comment in `bike.ts`.

### Baseline for the budgets (`05-plan.md`), before this round

| Bike | Meshes | Triangles drawn (chain instances counted) |
| --- | --- | --- |
| road, drop bar, 11 speeds (`road-drop-11`) | 148 | 22328 |
| city, flat bar, 8 speeds (`city-flat-8`) | 152 | 20276 |
| MTB, riser bar, 12 speeds (`mtb-riser-12`) | 161 | 21208 |

Meshes include the stand and the hook. The full list for all 13 bikes is printed by the digest tool.

## Interfaces other sessions rely on

Modules in `player/src/stage/` (lines now): `spec.ts` 291, `geo.ts` 126, `derailleur.ts` 395, `drivetrain.ts` 130, `cockpit.ts` 110, `bike.ts` 485. Each has a three-line header with its session area.

- `bike.ts` re-exports `spec.ts` (all), `seg` and `disposeTree` from `geo.ts`, `barrelTurn derGeom derPose upperPulley DerGeom DerPose Turn` from `derailleur.ts` and `rAt` from `drivetrain.ts`. Everything else imports from `bike.ts` as before. Modules inside the stage import each other directly.
- Build functions take the model first: `buildCrankset(m)`, `buildChain(m)`, `layoutCirc(m, z, gap)`, `layChain(m)` (drivetrain); `buildDerailleur(m)`, `moveDerailleur(m, z, gap)` (derailleur); `buildCockpit(m)`, `buildShiftCable(m)` (cockpit).
- `BikeModel.setDer(z, gap)` = set `derZ` and `gap`, then `moveDerailleur`, then `layChain`.
- Public helpers marked `/** @internal builder helper */`: `part`, `add`, `anchor`, `turnable`, `screw`. Builder state marked `@internal builder state`: `der` (type `DerParts`, exported from `derailleur.ts`), `chainMesh`, `circ`, `path`, `N`, `Q`, `pt`. `decal` is still private.
- Imports between modules have no cycle: `bike` → everything; `derailleur` → `drivetrain` (`rAt`, `layoutCirc`) → `spec`, `geo`. `drivetrain.ts` calls `m.layout()` (in `bike.ts`), not `derailleur.ts`.
- `build()` in `bike.ts` calls the builders in the old order (cockpit, kickstand, crankset and sprockets, gearbox box, derailleur, shift cable, chain). The order decides the child order in the scene, and the digest checks it. Keep it unless the digest is rebuilt on purpose.
- Digest: `npx tsx tools/stage-digest.ts tools/assets/out/<name>.json`, then `cmp`. The baseline from the start of this round is `tools/assets/out/digest-before.json` (git ignores it, so it is gone after a fresh clone: make a new one from commit `56d7d66`'s parent code, or just from your own starting state, before you change anything).

## Choices made without the owner

- **Own temporaries per module:** `tD tN tX tM` in `drivetrain.ts` and `tM` in `derailleur.ts` replace the shared ones of `bike.ts`; same maths, digest identical.
- **Shift cable** moved to `cockpit.ts` (`buildShiftCable`), because it runs from the shifter to the derailleur and `derailleur.ts` was big enough. The `part('shift_cable')` call stays in `bike.ts` build.
- **`capsuleShape` and `polyGeo`** are unused (dead already in the old file). They stay in `geo.ts`, as the prompt lists them.
- **Digest "extreme" bikes:** road, e-bike, 12 speeds, 559 wheel, every geometry fact at its lowest (`extreme-low`) and highest (`extreme-high`) range value. I did not copy the single case of `stage.test.ts`.

## Questions for the owner

- `npm run shots` is broken since the garage change (`player/e2e/slow.ts:55` reads `app.bike.facts`, but no bike is "in use" any more). It fails with "Cannot read properties of undefined (reading 'facts')". Not caused by this session. Recommended: fix it in a small own task (pick the bike through the garage first) before session C, since sessions C to E want to look at 3D changes. Until then the e2e garage shot `player/e2e/shots/portrait/bike-page/03-components.png` shows the road bike.

## Next steps

1. Session B (`05-b-library.md`): parts library, no change in the builders needed.
2. Session C: starts in `spec.ts` and `drivetrain.ts`. Make a new digest baseline first only if you want to compare something that must not change.
3. Maybe fix `npm run shots` (see Questions).

## Gotchas

- `git pull --rebase` fails here while the three deleted prompt files (`prompts/01-*`, `02-*`) are unstaged. Use `git pull --rebase --autostash origin main`, or leave them and commit only your own files.
- Keep scratch TypeScript out of `tools/` and `player/`: the root `tsc` checks everything under `tools/**`, also `tools/assets/out/`.
- In the extracted builders `this.` became `m.`, so a local variable called `m` (as in the pin helper in `derailleur.ts`, now `mesh`) shadows the model. Name locals differently.
- `bike.ts` is 485 lines, near the limit. Session E, when it adds code to `build()`, should put new parts in the module of their area.
