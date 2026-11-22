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
