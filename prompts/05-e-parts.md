# Session E: the other parts, the look, credits

Read `CLAUDE.md`, `prompts/05-plan.md` ("The problem", "Rules for every session", "What the source model contains", "Shared names"), the progress files `05-b-library-progress.md`, `05-c-drivetrain-progress.md` and `05-d-derailleur-progress.md` ("Interfaces", "Choices" and "Gotchas"), and `player/CLAUDE.md`. If you have questions, ask them in one batch before you start; after that, work without stopping.

Model: Sonnet. You own `cockpit.ts`, `bike.ts`, `spec.ts` and `drivetrain.ts` in `player/src/stage/` (crank side only), the pose, light and wheel-speed code in `three-stage.ts`, `anim.ts` (the pedal speed only), the credits line in `player/src/ui/app.ts`, and `player/README.md`. Leave `derailleur.ts` alone.

## Goal

The parts a user looks at around the bike come from the library: crank arms, pedals, saddle, seat collar, stem, flat bar and grips. They are placed where `bikeSpec` puts them for each bike's geometry. With the derailleur from session D and the drivetrain from session C, the bike reads as one realistic machine with the app's look. The model's creator is credited in the app.

## Tasks

1. **Measure the mounting points** in library space with a small script (`tools/assets/measure-mounts.ts`), and write them as a generated typed constant next to `rd-rig.ts`:
   - crank: bottom bracket axis (the library origin) and both pedal axle axes at the arm ends;
   - the crank's spider bolt circle, for the chainring from session C;
   - pedals: their axle axis;
   - saddle: the rail clamp point (middle of the rails, where a seat post head grips);
   - seat collar: the seat tube axis and its top;
   - stem: the steerer axis (`library.json` has the steering axis) and the bar clamp centre;
   - bar: the clamp centre, the grip ends, and where a brake lever and a trigger shifter sit (inboard of the grips).

   Check them as session D did: one render with markers.

2. **Place the parts** (`bike.ts`, `cockpit.ts`, `drivetrain.ts`):
   - **Crank and pedals:**
     - `crank_arms` turns with `crankset` about the bottom bracket.
     - The chainring from session C sits on the spider's bolt circle.
     - The pedals sit on the arm ends and stay level while the crank turns, as real pedals hang.
     - These parts belong to the `crank` and `chainring` nodes.
   - **Saddle:** on the generated seat post's head, with a small generated clamp head under the rails, at `saddleX`/`saddleY` from `bikeSpec`.
   - **Seat collar:** on top of the seat tube.
   - **Flat and riser bars:**
     - `stem` sits on the steering axis at the head tube's top, with generated spacers if the geometry needs them.
     - `bar_flat` sits in its clamp, with `grip_drive` and `grip_nondrive`.
     - Move the generated brake levers and trigger shifter to the measured spots, and update the spec points (`C`, `S`, `barTop`, `gripOf`) so everything that reads them follows. This includes the barrel adjuster on the shifter, the views and the cable.
     - A riser bar may use `bar_flat` turned up slightly in its clamp; write that rule as a comment.
   - **Drop bars** keep the generated bar and levers, but use the library `stem` if its clamp suits them. Otherwise keep the generated stem and say so in the handoff.
   - **Fixed sizes:** library parts keep their real size on every bike. Only their positions follow the geometry. Check the extreme geometry from `stage.test.ts`.
   - Delete the generated shapes these parts replace.

3. **How the bike is held:** the upside-down pose rests on the saddle and the bar. With the new heights, the flipped bike must stand on the saddle's top and the grips (or bar tops), not float or sink. Check the work stand clamp on the seat post and the hook as well. Fix the pose values in `three-stage.ts` (`poseVals`) from the measured points, not by eye.

4. **Look across the whole bike:**
   - Give every library part the app's shading:
     - saddle and grips dark;
     - crank and pedals as on the prototype;
     - bar and stem in the part colour;
     - frame colour only on the frame.
   - Tune outlines on library parts as session D did, so the whole bike doesn't read as noise.
   - Compare with `legacy/Bikefix-garage-guide v2.html` for the overall look.
   - **Depth and contours (owner feedback):** seen from the drive side, chain, cassette and chainring are an even grey. Their faces all point the same way, and the stage's light is deliberately even (`three-stage.ts`, near line 216). First measure: crop the chain run and the cassette from the `chain_close` view and write down the luminance standard deviation. Then try, keeping only what raises it without hurting the rest of the bike: a stronger key light with less ambient light; the chainring in `OUTLINED`; vertex colours that darken towards the sprocket hole, the tooth gaps and the plate rims (no new draw calls). Not allowed: shadow maps, post-processing, an outline copy of the chain. The chain is at about 18k of its 20k triangles, so no plate bevel.
   - Then check the generated parts that now stand out next to the real ones: frame tube ends, dropouts, hubs, tyres, brake levers, shifter. Improve their shapes in code where a small change helps (round tube ends, a hub shell with flanges, a tyre with a rounded section). Keep each fix small; list bigger ones as next steps in the handoff.

5. **Pedal animation without strobing (owner feedback):** the stage draws 60 pictures a second, and anything that moves more than half its repeat distance per picture looks like it runs backwards. Today the cranks turn at `PEDAL = 4.2` rad/s, so the 11 tooth sprocket moves 0.55 of a tooth and the rear wheel 19 rad/s (spokes repeat every 20°) per picture. Chain and sprocket block are already exact at any speed (session C's test). Do this:
   - `PEDAL` 4.2 to 2.1 and the `crank`/`chainring` rotate clip `2.6` to `1.3` in `anim.ts`.
   - Cap the rear wheel's drawn turn (the `wheelAngle` lines in `three-stage.ts`) at 0.12 rad per picture (7 rad/s), keeping direction and the freewheel. Put it in one pure function with a comment: a drawing rule against strobing, not physics.
   - Test, for every cassette row in `spec.ts` and every gear, at the pedal and the clip speed: the sprocket block's step per picture is below half a tooth, and the wheel's step is at most 0.12 rad (also at 30 pictures a second).
   - The derailleur pulleys must turn with the chain too, but that is session D's.

6. **Budgets** (`05-plan.md`): add a test that builds a road, a city and an MTB bike and checks:
   - at most 150k triangles drawn (instances counted);
   - no more meshes than the baseline session A recorded.

   If over, simplify further in `library.yaml` (`npm run parts`, `npm run parts:check`), not in code.

7. **Credits.**
   - In the "Test build" notice (`ui/app.ts`, the `notice` overlay), add one line under the existing text:

     > 3D parts based on "Rigid Bike [Touring Bike]" (https://skfb.ly/pAzTT) by Mohamed Farhan, licensed under CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/). Changed: split into parts, simplified, re-oriented.

     Make both URLs links.
   - Add a test or e2e check that the line is there.
   - This is the licence requirement; never drop it while library parts are in use.

8. **README:**
   - Update `player/README.md`'s 3D section to the new state: the library, the measured mounts, which parts are generated and why, and the recipe for adding a library part or a second variant of a slot (for example clipless pedals).
   - Rewrite "Known 3D shortcomings":
     - one look per part (every derailleur looks like this one);
     - no drop-bar levers, disc brakes, suspension fork or MTB derailleur from a real source yet;
     - the electronic derailleur still to come.

9. **Screenshots for the owner:** garage snapshots of a road, a city and an MTB bike; one whole-bike card view; the bike upside down. Look at no more than 5 yourself. Then run the `verify` skill, commit in logical steps, and run the `handoff` skill.
   - In the handoff, list what still looks generated and the next sources to look for:
     - the road bike model in `assets-src/` for the drop bar, levers, rim brakes and front derailleur;
     - an MTB derailleur source.

## Done when

- Crank, pedals, saddle, seat collar, stem, bar and grips are library parts, placed per bike, with level pedals and a correct upside-down pose.
- The budgets hold, the pedal animation numbers hold, and the credits line is in the app.
- All checks pass, and the handoff is pushed.
