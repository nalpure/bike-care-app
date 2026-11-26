# Open: choices made without the owner, and questions

The one place for what an agent chose or asked while you were not there. **Nothing here is decided.** The owner answers an item; then it moves to `decisions.md` (if it matters later) or is deleted. Keep each item to two lines. Newest at the bottom of each list. Everything else about the past is in `git log`.

## Choices made without the owner

What the agent chose (the cautious default), and where it lives. The owner can overrule any of them.

- **Bars 784 mm wide** on every flat and riser bike (the touring bike's real bar), a riser being a flat bar on 20 mm spacers. `player/src/stage/spec.ts`.
- **One chain line for every bike:** the crank's, so cassettes and dropouts sit 2 to 17 mm further out. `spec.ts`.
- **GAP_BIG 11 mm** (gap between largest sprocket and upper pulley), cage stops -55/+60 degrees, long cage only above 36 teeth. `spec.ts`, `rd-fit.ts`.
- **Sprocket and chainring edge shade 0.7** (`EDGE_DARK` in `geo.ts`); lights unchanged because a stronger sun did not add depth.
- **Chain plates drawn with 6-sided pin holes**, shaded per link piece. `drivetrain.ts`.
- **`show` check:** the rule is called `show-and-focus` and is reported only for a node the catalog knows (an unknown name gives `unknown-node` alone). `show` also appears in the reviewers' "3D:" line (`render.ts`, `review.ts`), so a content change that adds `show` changes that card's review hash.
- **Rear end split:** the dropout end is the last 13 cm (0.26 units) of both stays, cut at a ring of the tube, plus the dropout plates (part `frame_dropout`). The rear hub (part `rear_hub`) is the axle, hub shell, flanges, hub-gear shell and the freehub body; spokes, rim and tyre stay with `rear_wheel`. `player/src/stage/bike.ts`, `geo.ts`.
- **`drivetrain` and `rear_end` are nodes with tap texts** (`NODES`), though a tap never means them (`GROUP_NODES`). `registry.ts`.
- **The stand, rope and hook fade out with the frame** (shared material opacity, about 0.4 s); the stand clamp part is forced hidden. `three-stage.ts`, `visibility.ts`.
- **Framing on a card with `show`:** only the wide `drive_side` view is re-aimed to fill the picture with what is drawn (10 % margin; the crank's full circle counts). Close-ups keep their authored framing, and so does `whole_bike` (world space). `check-high-limit` now shows rear_derailleur, derailleur_hanger, cassette, chain, chainring (no crank, no screws other than H, no cable). `views.ts` (`FIT_VIEWS`, `fitPose`), `three-stage.ts`.
- **`shift-to-smallest-sprocket` has focus [chain] only** (as asked), so its tags are just "Chain"; the shifter and the sprocket are no longer marked. `content/steps/rear-shifting.yaml`.
- **Clip `hanger-bend`:** 0.2 rad (11.5 deg, drawing data) about the length axis, bending 40 % of the way from axle to bolt; in, back, out, back in 5.6 s; hanger red past 12 % of the tilt. Caption "A bent hanger tilts the derailleur" (R-20). `anim.ts`, `content/inspections.yaml`.
- **Contour colour:** blue `--contour` (#1F5FBF light, #6FC3FF dark), every sharp edge of the parts drawn on top at 80 %, so hidden edges of the straight derailleur show too. `styles.css`, `contour.ts`.
- **View `hanger_from_behind`:** `derailleur_from_behind` with its top raised to 4 cm above the axle, so the whole hanger sits under the caption; about 16 % further back on the road bike. At full tilt the cage touches the bottom edge in portrait. `views.ts`.
- **`npm run shots -- --at 1.7,3.3`** holds the step's clip at those times for extra pictures (`ThreeStage.holdClip`, not used by the app). `player/e2e/slow.ts`.
- **Cards where Next answers:** verdict heading "Fix this first" on a problem, a hint "Once it is fixed, tap Next.", the solution button reads "Play again". Auto-play only on these cards; old-style cards keep "Show solution". `ui/flow.ts`.
- **No build rule finds a leftover "all good" button** on a step with `question` (it looks like a text-only problem answer); `content/CLAUDE.md` says to leave it out. Steps without `question` keep the old locked Next until converted.
- **Profiles:** a step with `question` left out of `tutorial_sees` means Next; naming an inspection's default in `tutorial_sees` is an error. Next after a block on an inspection with a default records the default for the session. `journeys.ts`, `refs.ts`, `journey.ts`.
- **Rear-shifting tutorial in the new style** (`content/steps/rear-shifting.yaml`, `content/inspections.yaml`): every step and both used inspections now have `show`; focus keeps only small parts (screws, upper wheel, barrel adjuster, a sprocket, the chain where it moves). Gear-running checks focus only the chain and show `drivetrain`.
- **`check-low-limit` got the same `show` as `check-high-limit`** (it had only the new wording, no `show`, so it kept the old fade look), and so did `check-low-limit-by-hand` (the hand-pushed derailleur is shown, not marked).
- **`shift-to-largest-sprocket` marks the sprocket and chain, not the shifter**, like `shift-to-smallest-sprocket`.
- **Rides and the test-ride inspection show the whole bike** as a node list (frame, fork, wheels, handlebar, saddle, seat post, shift cable, drivetrain): `show: [bike]` draws nothing. Focus is the shifter (and the sprocket).
- **`shift-test-ride` has default `fine`** ("Slow or rattling?") and a goal sentence; the sentence also shows in the diagnosis and the routine check, which keep all three buttons.
- **`check-b-gap`:** the manual pointer moved to `details` and shows only when the derailleur model is known (before: "your derailleur" as fallback).
- **Texts:** goals appended as "should ..." to the texts; "all good" buttons removed from all rear-shifting checks, and profile `tutorial_sees` for them removed. Mechanics and problem texts unchanged. Tests that used the old-style buttons now build an old-style step in the test.
- **A tap that goes on moves to the next card at once** on every tutorial inspection without a default, so also on the hanger check ("It hangs straight down"). Its meaning text is then not shown. `journey.ts` (`tutTap`).
- **The keep screen comes right after the barrel answer** when the flow has not offered it yet (the existing "once per flow" rule); if the user already saved this flow's answers, the barrel fact is saved with them. `journey.ts`.
- **Schema shapes:** a follow-up is an outcome `{ inspect, outcomes }` (one level only); `sets` on an inspection state, only for facts no condition reads; `question` is now allowed without `default`. "I cannot find it" is never stored, so the next run asks again. `schema/`, `refs.ts`, `resolve.ts`.
- **Fact `drive.barrel_adjuster`** (derailleur, shifter, inline), German label "Zugeinsteller". Bike-sheet answers "At the derailleur", "At the shifter", "On the cable". `content/facts.yaml`.
- **`barrel-adjuster-search` 3D view** is a placeholder until the 3D part (cable focus, frame, handlebar, shifter and derailleur shown, `drive_side`); the parent card's 3D view is unchanged. `content/inspections.yaml`.

## Questions for the owner

Each with the recommended answer.

1. Derailleur on 11-42 and 10-51 cassettes: the upper pulley sits 26 to 43 mm below the small sprockets, and 10-51 needs a 64 mm hanger. Accept until a mountain bike derailleur source exists? Recommended: yes.
2. Bars 784 mm on city and riser bikes: keep, or cut to about 640 mm? Recommended: keep until a second bar source exists.
3. Is the sprocket and chainring shade enough depth? Stronger (`EDGE_DARK` 0.5) reads more but darkens the chainring. Recommended: keep 0.7.
4. The hardtail model (`assets-src/hardtail-by-fehe`): usage rights are not settled and it has no `credit.txt`. Settle before any part from it ships.
5. Garage: "Do it now" on a job with a tutorial starts the tutorial without the diagnosis. Fine? Keep both the Facts and Components tabs? Recommended: yes, and decide after a test round.
6. Swipes: also a right-edge swipe, and swipe up with a mouse drag? Recommended: no.
7. Profiles: add an optional `bike_name` (for example "Corvana Strada") if the scenario names look odd in the garage? Recommended: yes, if they do.
8. Split the brake levers into front and rear nodes? Recommended: not until brake content needs them.

## What still looks generated in 3D (sources to find)

1. A road bike model for the drop bar, hoods, brake levers, rim brakes and front derailleur.
2. A mountain bike derailleur (Eagle style); the library's is a touring/road one and the 10-51 cage is a stretched copy.
3. Disc brakes, a suspension fork, a full-suspension frame, the electronic derailleur.
4. Small shape fixes: frame tube ends and dropouts, hubs (no flanges), tyres (round section), the shifter, generated levers.
5. Second variants of a slot (clipless pedals, other saddles): recipe in `player/src/stage/library.md`.
