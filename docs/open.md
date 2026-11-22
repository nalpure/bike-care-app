# Open: choices made without the owner, and questions

The one place for what an agent chose or asked while you were not there. **Nothing here is decided.** The owner answers an item; then it moves to `decisions.md` (if it matters later) or is deleted. Keep each item to two lines. Newest at the bottom of each list. Everything else about the past is in `git log`.

## Choices made without the owner

What the agent chose (the cautious default), and where it lives. The owner can overrule any of them.

- **Bars 784 mm wide** on every flat and riser bike (the touring bike's real bar), a riser being a flat bar on 20 mm spacers. `player/src/stage/spec.ts`.
- **One chain line for every bike:** the crank's, so cassettes and dropouts sit 2 to 17 mm further out. `spec.ts`.
- **GAP_BIG 11 mm** (gap between largest sprocket and upper pulley), cage stops -55/+60 degrees, long cage only above 36 teeth. `spec.ts`, `rd-fit.ts`.
- **Sprocket and chainring edge shade 0.7** (`EDGE_DARK` in `geo.ts`); lights unchanged because a stronger sun did not add depth.
- **Chain plates drawn with 6-sided pin holes**, shaded per link piece. `drivetrain.ts`.

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
