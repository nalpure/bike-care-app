# Session C: drivetrain with real shapes

Read `CLAUDE.md`, `prompts/05-plan.md` ("The problem", "Rules for every session", "Shared names"), `prompts/05-b-library-progress.md` ("Interfaces" and "Gotchas") and `player/CLAUDE.md`. If you have questions, ask them in one batch before you start; after that, work without stopping.

Model: Sonnet. You own `spec.ts`, `drivetrain.ts`, `chain.ts`, `geo.ts` and `views.ts` in `player/src/stage/`, and the drivetrain tests in `player/test/stage.test.ts`. Don't read `derailleur.ts` beyond its exports: session D replaces it. The current derailleur fits itself to whatever cassette `bikeSpec` gives it, so it keeps working through your changes.

## Goal

Sprockets, chainring and chain look like real ones at real scale: tooth shapes that hold the chain, sprockets at their real spacing, a chain of real plates, rollers and pins sitting in the tooth gaps. All of it is generated from the facts, because tooth counts and speeds differ per bike.

## Tasks

1. **Real spacing** (owner decision). In `bikeSpec`:
   - The sprocket spacing becomes the real one (factor 1.0 instead of 1.25).
   - The chain width follows the speed count. Use typical outer widths as drawing values: about 7.3 mm up to 8 speeds, 6.6 mm for 9, 5.9 mm for 10, 5.5 mm for 11, 5.3 mm for 12 and 13.
   - Check everything that used `sp` as a stand-in for other sizes (`chainW`, `zDrop`, the pulley width in `derailleur.ts`) and give it its own value. Find them with Grep; in `derailleur.ts`, change only those lines.
   - Keep the chain lines.
   - Write the rule as a comment in `spec.ts`.

2. **Common cassettes.** Replace the geometric series in `cassetteFor` with a small table of common real cassettes (drawing data, see "Drawing values are not facts" in the plan). Use these, with real tooth sequences:

   | Bike | Speeds | Cassette |
   | --- | --- | --- |
   | road | 8 | 11–28 |
   | road | 9 | 11–28 |
   | road | 10 | 11–32 |
   | road | 11 | 11–32 |
   | road | 12 | 11–34 |
   | city/trekking | 7 | 14–28 |
   | city/trekking | 8 | 11–32 |
   | city/trekking | 9 | 11–34 |
   | city/trekking | 10 | 11–36 |
   | MTB | 8 | 11–32 |
   | MTB | 9 | 11–34 |
   | MTB | 10 | 11–36 |
   | MTB | 11 | 11–42 |
   | MTB | 12 | 10–51 |

   - Other speed counts (5, 6, 13): the nearest row, with the tooth counts spread evenly between its smallest and largest.
   - If `drive.cassette_model` contains a range such as `11-34` or `11–42`, use the table's row with the same speeds but those first and last teeth. That is the "nearest" match the owner asked for.
   - If you are unsure of a real sequence, an even spread with the right first and last teeth is fine; say so in a comment.
   - Write the rule as a comment above `cassetteFor`.

3. **Tooth shape** (`geo.ts`): one function that draws a sprocket outline for a tooth count on the chain's pitch circle.
   - Roller seats for a 7.75 mm roller, tooth flanks, rounded tips, about 8 outline points per tooth.
   - Extrude it to the sprocket's thickness (about 1.8 mm), with a small chamfer.
   - Sprockets of 28 teeth and more get a carrier with 4 or 5 windows. Smaller ones are solid, with a splined hole.
   - It replaces the smooth discs (`gearGeo` may stay for pulleys until session D).
   - Budget: the whole cassette at most 15k triangles, the chainring at most 3k.

4. **Chainring:** the same tooth shape with `B.chainring` teeth, a narrow ring with 4 or 5 bolt tabs. Session E sets it on the library crank's spider, so keep the ring and the tabs as one mesh with its centre on the axle.

5. **Chain of real links:**
   - Inner and outer plates alternate. Draw the plates as a figure-eight with a waist, with rollers between the inner plates and pin heads on the outer plates.
   - Use real sizes: 12.7 mm pitch, 7.75 mm rollers, plates about 7.5 mm tall, and the width from task 1.
   - Draw them as instanced meshes: one for inner links, one for outer links, at most 4 draw calls for the whole chain. Budget: at most 20k triangles.
   - **Pin placement:**
     - Place pins one pitch apart in straight-line distance (chord), not along the curve, so a link spans exactly one pitch.
     - Lay the pins exactly on the chainring and the engaged sprocket.
     - Spread the leftover length over the free spans: the lower run is best, the upper run is visible.
     - Each link lies along the chord between its two pins. That gives the real polygon look on the wheels.
   - Keep the width across the bike as now (no twist where the chain bends sideways).

6. **Sprockets turn with the chain, not with the wheel.**
   - Today the sprockets sit in `rearHub` and turn with the wheel, which is wrong with teeth: a wheel spun by hand freewheels.
   - Move them to their own group at the hub. In `setDer`, turn that group from `chainShift` and the engaged sprocket's pitch radius, plus a phase offset, so the tooth gaps sit under the pins.
   - Do the same phase check for the chainring: `three-stage.ts` turns the crankset by the crank angle and sets `chainShift = -crankAngle * rc`. Align the phase once at `chainShift = 0`; then both stay in step.
   - While the derailleur moves between sprockets, use the nearest sprocket.
   - Change `three-stage.ts` only where it moves the sprockets.

7. **Tests** (in `stage.test.ts`, extending what is there):
   - Sprocket spacing and tooth counts match the table and the rule.
   - On the engaged sprocket and on the chainring, every pin that lies on the wheel sits within 0.3 mm (real) of a tooth gap's centre, at `chainShift` 0 and after any shift. Test 3 bikes in 3 gears.
   - Neighbouring pins are one pitch apart within 0.05 mm on the wheels.
   - Triangle budgets from tasks 3 and 5 hold.
   - The existing clearance tests still pass. They sample every triangle edge, so with detailed teeth they may get slow: sample the sprockets as their tip circle instead, and keep `npm test` within the plan's time limit.

8. **Views:** the sprockets are now closer together. Check that `derailleur_from_behind` still lets the user see whether the upper pulley is in line with a sprocket: road 11 speeds and MTB 12 speeds, at phone portrait size. If not, move the camera closer. Session D fine-tunes the derailleur views later; don't spend long here.

9. **Look:** take one whole-bike shot (`npm run shots -- --only road`) and one close-up of the derailleur area.
   - If the teeth flicker or turn to noise in the whole-bike view, soften them for that view (drop the outlines on the cassette, or lower the contrast), not the shape.
   - Update "Known 3D shortcomings" in `player/README.md`: real spacing, teeth, chain.

10. Run the `verify` skill. Commit in logical steps (spacing and cassettes, teeth, chain, phase), then run the `handoff` skill.

## Done when

- Real spacing and the cassette table are in.
- Teeth, chainring and chain are real shapes, within budget.
- The pins sit in the tooth gaps while pedalling.
- All checks pass, and the handoff is pushed.
