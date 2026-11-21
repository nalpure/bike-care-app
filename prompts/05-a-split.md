# Session A: split the bike builder

Read `CLAUDE.md`, `prompts/05-plan.md` ("Rules for every session" and "Sessions" are enough here) and `player/CLAUDE.md`. If you have questions, ask them in one batch before you start; after that, work without stopping.

Model: Sonnet. You own `player/src/stage/` and `tools/`. **No visible change:** the bike must draw exactly as before.

## Why

`player/src/stage/bike.ts` is 1433 lines. Sessions C, D and E each rebuild one area of it: drivetrain, derailleur, the other parts. Split into modules, each of them reads only its own file. That is cheaper and avoids mistakes in code they don't own.

## Tasks

1. **Digest first.** Before you change anything, write `tools/stage-digest.ts` (run it with `npx tsx tools/stage-digest.ts <out.json>`).
   - It builds `BikeModel` (with a plain material for the stand) for:
     - every profile in `profiles/` (their facts);
     - these synthetic bikes: road with a drop bar and 11 speeds; city with a flat bar and 8 speeds; MTB with a riser bar and 12 speeds; MTB with 10 speeds; a hub gear; a single speed; a city e-bike; and one with extreme geometry (copy its facts from `stage.test.ts`).
   - For each bike it calls `setDer` at every sprocket with `GAP_OK`, plus `GAP_BIG` and `GAP_SMALL` on the largest sprocket.
   - At each step it records, per mesh in traversal order: `userData.partId`, the world matrix, and a hash of the position array. For instanced meshes it records every instance matrix.
   - It writes one hash per bike and step, and prints a count. Also print, per bike, the number of meshes and the triangles drawn (instances counted).
   - Run it and keep the output as the baseline (in `tools/assets/out/`, which git ignores).
2. **Split** `bike.ts` into modules of at most about 500 lines each. Suggested cut (adjust if the code says otherwise):
   - `spec.ts`: constants, `BikeSpec`, `cassetteFor`, `geometryOf`, `GEOMETRY_RANGES`, `bikeSpec`, the frame-point helpers (`gripOf`, `distSeg`, `batteryLine`, `stayPts`, `stayZ`).
   - `geo.ts`: geometry helpers (`tubeGeo`, `curveGeo`, `gearGeo`, `slabGeo`, `hullShape`, `capsuleShape`, `polyGeo`, `seg`, `plate`, `disposeTree`, `v3`).
   - `derailleur.ts`: the derailleur constants, `DerGeom`, `derGeom`, `DerPose`, `derPose`, `bodyAngle`, `Turn`, `bodyBarrel`, `bodyToBike`, `barrelTurn`, `upperPulley`, plus `buildDerailleur(m)` and the derailleur half of `setDer` as functions.
   - `drivetrain.ts`: chainring, cranks, sprockets, chain (build and lay out), `rAt`.
   - `cockpit.ts`: `buildCockpit(m)`.
   - `bike.ts`: the `BikeModel` class (constructor, shared helpers `part`, `add`, `anchor`, `turnable`, `screw`, frame, wheels, stand, hook, decal, `setDer` calling the derailleur and chain functions).
   - Build functions take the model as their first argument. Make the helpers they need public, marked `/** @internal builder helper */`.
   - `bike.ts` re-exports every name it exported before (`export * from './spec.js'` and so on), so `three-stage.ts`, `views.ts`, `anim.ts`, `ui/` and the tests need no change.
   - Move code with shell commands (`sed -n 'a,bp' bike.ts >> spec.ts`), then fix imports. Don't retype functions.
3. **Prove it:**
   - The digest must match the baseline exactly, for every bike and step. A difference means behaviour changed; find it and fix it.
   - Then run `npm run typecheck` and `npm test`.
4. **Comments:**
   - Fix the stale header comment. The drivetrain is not "about twice as wide": sprockets are 1.25 times the real spacing until session C changes that.
   - Give each new module a three-line header: what it holds, which session area it is.
   - Update the stage file table in `player/README.md`.
5. Run the `verify` skill.
   - Screenshots: one road shot is enough. The digest is the real proof.
   - Commit (one commit for the digest tool, one for the split), then run the `handoff` skill.
   - In the handoff file, record the baseline mesh and triangle counts for a road, a city and an MTB bike (`05-plan.md`, "Budgets").

## Done when

- The digest is identical before and after.
- No module is over about 500 lines.
- All checks pass, and the handoff is pushed.
