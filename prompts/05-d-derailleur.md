# Session D: the real derailleur

Read `CLAUDE.md`, `prompts/05-plan.md` (all of it), the progress files `05-b-library-progress.md` and `05-c-drivetrain-progress.md` ("Interfaces", "Choices" and "Gotchas"), and `player/CLAUDE.md`. If you have questions, ask them in one batch before you start; after that, work without stopping.

Model: Opus. This is the step where earlier rounds stalled: the derailleur must look like the real part *and* move like one. You own `player/src/stage/derailleur.ts`, `views.ts`, `anim.ts` (except `dirSign`), the derailleur tests, and new scripts in `tools/assets/`.

## Goal

The rear derailleur is built from the library pieces (`rd_*`) at real size. It hangs from a realistic hanger at the dropout and moves like the real mechanism:

- the body turns about the hanger bolt, set by the B screw;
- the parallelogram links swing with the cable;
- the cage turns about its pivot and takes up the chain.

The upper pulley lines up with each sprocket. Nothing touches the sprockets. Every clip and view content uses keeps working. The old generated derailleur code is deleted.

## Tasks

1. **Measure the rig** with a script, `tools/assets/measure-rd.ts`, run as `npm run parts:rig`. It writes `player/src/stage/rd-rig.ts`: a generated, typed constant with a header comment saying how to regenerate it. All values are in library space.
   - **Hanger bolt axis (B-axis):** the bolt drum of `rd_upper_body`. The hole in `rd_hanger` confirms it.
   - **The four link pins:** where `rd_link_outer` and `rd_link_inner` meet `rd_upper_body` and `rd_lower_body`. Axis direction and a point on each.
   - **Cage pivot axis (P-axis):** between `rd_lower_body` and the cage plates.
   - **Pulley axles:** centre and axis of each pulley, plus its tooth count and pitch radius. Measure them from the outline.
   - **Barrel adjuster axis:** `rd_barrel`, and where it seats on the body.
   - **Cable clamp:** where the inner wire is clamped, probably on the outer link or the lower body.
   - **Screw spots:** where the H, L and B screws go. Look for fused screw heads or bosses on `rd_upper_body`. Without them, choose spots as on real derailleurs: H and L side by side on the back of the upper body, reachable from behind or above; the B screw in the B-knuckle, its tip against a tab of the hanger.
   - **Method:** fitting cylinders to hole walls usually works on CAD meshes. Find vertices whose normals are perpendicular to a candidate axis and fit circles to them. Use the source glTF (exact) through the same transform the library build uses, not the simplified pieces.
   - **Check:** render the derailleur with a small marker on every axis (`tools/assets/explore/shot.mjs` or your own page) and look at it from 3 sides, once. Write the numbers you trust and the ones you don't into the handoff.

2. **Rig closure test** (Vitest): turn the links through their whole swing, solving the linkage with the measured pins. Both links stay connected to both bodies within 0.2 mm (real) everywhere. If the four pins are not an exact parallelogram, solve the four-bar linkage properly instead of assuming one.

3. **Assembly round trip** (Vitest): the pieces are stored where they sit in the source. Pose the rig at the source's own link, cage and body angles (computed from the measured axes), placed on the source's bolt. Every piece's transform must then come out as identity, within 0.1 mm and 0.1°. This proves every piece hangs on the right axis and the solver's angles mean what they should.

4. **Kinematics** in `derailleur.ts`. Replace `derGeom` and `derPose` and their invented constants (`POFF`, `PIN`, `CO`, `KAPPA`, `BETA_L`, `CAGE_*`, `EZ`, `A0`, …) with the rig:
   - **Placement:** the hanger bolt sits below and slightly behind the rear axle, as on real frames. Choose its position, then check it against the tests below for every cassette in session C's table. Build the hanger in code, shaped to meet the B-knuckle and to carry the B screw's tab, on the dropout made in `bike.ts`. `rd_hanger` is for measuring only.
   - **Lateral position:** for a target z (the sprocket's centre plane), solve the link angle so the upper pulley's centre plane lies on that z. Interpolate between sprockets while shifting.
   - **Body angle:** set by the B screw. Keep today's meaning of `setDer(z, gap)`: `gap` is the target gap on the largest sprocket and sets the body angle. `GAP_OK`, `GAP_BIG` and `GAP_SMALL` stay; check that their values are still sensible at real scale.
   - **Cage angle:** recommended, as on a real bike: the chain has a fixed length (big–big plus two links, the usual sizing rule), and the cage spring turns the cage until the chain path has that length. Solve by bisection with `chain.ts`'s path length. The gap on the smaller sprockets then follows from the real geometry, which is the point. If this keeps failing (three strikes), fall back to choosing the cage angle for the gap, as today, and say so in the handoff.
   - **Real scale:** the pieces are real size and the sprockets sit at their real spacing (session C). Nothing is stretched sideways.
   - **Long cage above 36 teeth** (owner decision): stretch `rd_cage_outer` and `rd_cage_inner` along the line from the upper to the lower pulley. Move only the vertices beyond the upper pulley's axle, so both pulley bosses keep their shape, and move the lower pulley with them.
     - Choose the length from the wrap needed: (largest − smallest sprocket) + (largest − smallest chainring).
     - Today's 82 mm cage covers about 36 teeth of wrap. Find the shortest cage that passes the tests.
     - Write the rule as a comment.
   - Pulleys spin with the chain. Their teeth sit under the chain's rollers, with the same phase approach session C used for the sprockets.

5. **Turnable parts:**
   - **H, L and B screws:** made in code with the existing `screw`/`turnable` helpers, real size (M4, hex socket), at the spots from task 1. The B screw's tip stays on the hanger tab while the body turns (as today).
   - **Barrel adjuster:** use `rd_barrel` inside the `barrel_adjuster` turnable, re-centred on its axis.
   - **When `B.barrelAt === 'shifter'`:** the derailleur shows a plain cable stop instead of `rd_barrel`, so the user never sees two barrel adjusters.
   - **Cable:** the housing ends at the barrel or stop; the inner wire runs from there to the clamp from task 1.
   - **Nodes:** `rear_derailleur`, `upper_pulley`, `derailleur_hanger`, `h_screw`, `l_screw`, `b_screw` and `barrel_adjuster` are all built, with anchors where their tags make sense. `NODE_PARTS` stays as it is.

6. **Look:**
   - Give the pieces the app's shading (`add()` with suitable `k` values): links and cage darker, the body lighter, screws and pulleys as before. Keep the prototype's look (`legacy/Bikefix-garage-guide v2.html`).
   - Outlines: `EdgesGeometry` at 35° may draw too many lines on the library meshes. Tune the angle for library pieces until the shape reads without noise.

7. **Views and clips:**
   - Re-tune `derailleur_from_behind`, `derailleur_side_close` and `barrel_adjuster_close` for the real size: closer, framed on what each step needs.
   - On a phone in portrait, the user must judge whether the upper pulley is in line with a sprocket, also with the bike upside down.
   - All clips (`limit-screw-align`, `b-gap-adjust`, `cable-tension-shift`, `shift-to-smallest`, `shift-to-largest`) must still show what their names say. `limit-screw-align` brings the pulley into line by turning H or L.

8. **Tests** (extend `stage.test.ts`; keep the existing ones passing). For every cassette in session C's table:
   - the upper pulley's centre plane is within 0.2 mm (real) of each sprocket's plane at that gear;
   - no derailleur piece except the pulleys and the chain comes within 1 mm (real) of a sprocket's tip circle, in every gear;
   - the gap on the largest sprocket equals the target within 0.5 mm. On the other sprockets it stays within a plausible range: choose it, typically 5–15 mm (real), and say which in a comment;
   - turning the B screw in opens the gap, steadily;
   - the chain length stays constant through all gears (if you used the chain-length method).

   Sample the library meshes sparsely in the clearance tests. Keep `npm test` within the plan's time limit.

9. **Delete** the old generated derailleur code (shapes and constants), and update the README's "Known 3D shortcomings" and the stage file table.

10. **Screenshots for the owner:**
    - `npm run shots -- --only road` plus an MTB 12-speed bike;
    - the derailleur views from task 7, upright and upside down;
    - one whole-bike view.

    Look at no more than 6 yourself. Then run the `verify` skill, commit in logical steps (rig, kinematics, screws and cable, views, cleanup), and run the `handoff` skill.

## Done when

- The rig is measured and closure, assembly, indexing, clearance and gap tests pass for every cassette.
- The clips and views work.
- The old code is gone.
- All checks pass, and the handoff is pushed with the screenshots named for the owner.
