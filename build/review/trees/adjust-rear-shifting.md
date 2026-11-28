# Flow tree: Tutorial: Adjust the rear gears

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

<sub>Unit `tree:tutorial:adjust-rear-shifting` · hash `8877c7c8dd05` · mechanic: ⬜ not reviewed</sub>

The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).
To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.

## Before the first step

- Questions, in this order, each only when not yet known and a path ahead reads it: `drive.gear_type`, `drive.shifting`, `drive.barrel_adjuster`
- Run choices: `hold_bike`
- Difficulty 2

## Bikes covered

From job `adjust-rear-shifting` (content/jobs/adjust-rear-shifting.yaml). Covers bikes where drive.gear_type is derailleur and drive.shifting is mechanical. Any other bike ends at the first match:

- when drive.gear_type is hub_gear → **EXIT, not covered**: "Hub gears are not covered yet. They are adjusted differently from gears with a derailleur."
- when drive.gear_type is gearbox → **EXIT, not covered**: "Gearboxes at the pedals are not covered yet."
- when drive.gear_type is single_speed → **EXIT, not covered**: "Your bike has only one gear, so there are no gears to adjust. If the chain is loose, skips or clunks, a shop can help."
- when drive.gear_type is unknown → **EXIT, not covered**: "We need to know what kind of gears your bike has. Look at the rear wheel and come back."
- when drive.shifting is electronic → **EXIT, not covered**: "Electronic shifting is not covered yet. It is adjusted with the maker's app or buttons, not with a cable."
- when drive.shifting is unknown → **EXIT, not covered**: "We need to know whether your gears use a cable. Look at the right shifter and come back."

## Branches

Evaluated top to bottom; the first match wins.

- when choice.hold_bike is stand or hang or upside_down → case `wheel-free`
- when choice.hold_bike is ground → case `test-rides`

## Case `wheel-free` (stand · hang · upside_down)

Time of the complete path: 24 min (stand), 25 min (hang), 24 min (upside_down)

1. procedure `hold-bike` <sub>apart: nothing</sub>
   - when choice.hold_bike is stand: Clamp the bike in the stand · `clamp-in-stand` (+bike_in_stand)
   - when choice.hold_bike is hang: Hang the bike up · `hang-bike` (+bike_hung)
   - when choice.hold_bike is upside_down: Turn the bike over · `turn-upside-down` (+bike_upside_down)
2. Shift to the hardest gear · `shift-to-smallest-sprocket` · action <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
3. Set the outer limit (H screw) · `check-high-limit` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
4. Shift to the easiest gear · `shift-to-largest-sprocket` · action <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
5. Set the inner limit (L screw) · `check-low-limit` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
6. Double-check the inner limit · `check-low-limit-by-hand` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `too-far-in` (BLOCK)
7. Check the gap to the sprockets · `check-b-gap` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
8. Set the cable tension · `check-cable-tension` · check · only when drive.barrel_adjuster is derailleur or shifter or inline <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
9. procedure `release-bike` <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - when choice.hold_bike is stand: Take the bike out of the stand · `unclamp-from-stand` (−bike_in_stand)
   - when choice.hold_bike is hang: Take the bike down · `take-bike-down` (−bike_hung)
   - when choice.hold_bike is upside_down: Turn the bike back over · `turn-bike-upright` (−bike_upside_down)

**Finish** (good path only; skipped after an exit):

10. Test ride the gears · `test-ride-gears` · safety check <sub>apart: nothing</sub>
   - buttons: `rattles` (EXIT shop_only) · `chain-off` (EXIT unsafe)

## Case `test-rides` (ground)

Time of the complete path: 29 min (ground)

1. Park the bike · `park-bike` · action <sub>apart: nothing</sub>
2. Ride into the hardest gear · `ride-to-smallest-sprocket` · action <sub>apart: nothing</sub>
3. Set the outer limit (H screw) · `check-high-limit` · check <sub>apart: nothing</sub>
4. Ride into the easiest gear · `ride-to-largest-sprocket` · action <sub>apart: nothing</sub>
5. Set the inner limit (L screw) · `check-low-limit` · check <sub>apart: nothing</sub>
6. Double-check the inner limit · `check-low-limit-by-hand` · safety check <sub>apart: nothing</sub>
   - buttons: `too-far-in` (BLOCK)
7. Check the gap to the sprockets · `check-b-gap` · check <sub>apart: nothing</sub>
8. Set the cable tension on short rides · `check-cable-tension-riding` · check · only when drive.barrel_adjuster is derailleur or shifter or inline <sub>apart: nothing</sub>

**Finish** (good path only; skipped after an exit):

9. Test ride the gears · `test-ride-gears` · safety check <sub>apart: nothing</sub>
   - buttons: `rattles` (EXIT shop_only) · `chain-off` (EXIT unsafe)

## Exits before the first step

- drive.gear_type = derailleur, drive.shifting = electronic → **EXIT, not covered**
- drive.gear_type = derailleur, drive.shifting = unknown → **EXIT, not covered**
- drive.gear_type = hub_gear → **EXIT, not covered**
- drive.gear_type = gearbox → **EXIT, not covered**
- drive.gear_type = single_speed → **EXIT, not covered**
- drive.gear_type = unknown → **EXIT, not covered**
