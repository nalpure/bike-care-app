# Flow tree: Tutorial: Adjust the rear gears

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

<sub>Unit `tree:tutorial:adjust-rear-shifting` · hash `b30345e1be3c` · mechanic: ⬜ not reviewed</sub>

The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).
To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.

## Before the first step

- Questions, only when not yet known: `drive.gear_type`, `drive.shifting`
- Run choices: `hold_bike`
- Difficulty 2

## Bikes covered

From job `adjust-rear-shifting` (jobs.yaml). Covers bikes where drive.gear_type is derailleur and drive.shifting is mechanical. Any other bike ends at the first match:

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

## Checks before the work, in every case

Not shown again when the user already answered them in this session, for example in a diagnosis.

1. Look at the rear derailleur · `derailleur-alignment` · inspection
   - `straight` → continue
   - `crooked` → **EXIT, unsafe**: "Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop."
2. Find the barrel adjuster · `barrel-adjuster-present` · inspection
   - `at-derailleur` → continue
   - `at-shifter` → continue
   - `cant-find` → follow-up: Look along the cable · `barrel-adjuster-search` · inspection
     - `on-cable` → continue
     - `not-found` → **EXIT, not covered**: "Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you."

## Case `wheel-free` (stand · hang · upside_down)

Time of the complete path: 28 min (stand), 29 min (stand), 29 min (hang), 30 min (hang), 28 min (upside_down), 29 min (upside_down)

3. procedure `hold-bike` <sub>apart: nothing</sub>
   - when choice.hold_bike is stand: Clamp the bike in the stand · `clamp-in-stand` (+bike_in_stand)
   - when choice.hold_bike is hang: Hang the bike up · `hang-bike` (+bike_hung)
   - when choice.hold_bike is upside_down: Turn the bike over · `turn-upside-down` (+bike_upside_down)
4. Shift to the hardest gear · `shift-to-smallest-sprocket` · action <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
5. Set the outer limit (H screw) · `check-high-limit` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
6. Shift to the easiest gear · `shift-to-largest-sprocket` · action <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
7. Set the inner limit (L screw) · `check-low-limit` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `too-far-in` (BLOCK) · `too-far-out`
8. Double-check the inner limit · `check-low-limit-by-hand` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `too-far-in` (BLOCK)
9. Check the gap to the sprockets · `check-b-gap` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
10. Set the cable tension · `check-cable-tension` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
11. Test every gear · `check-all-gears` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `rattles` · `chain-off` (EXIT unsafe → jump to `release-bike`)
12. procedure `release-bike` <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - when choice.hold_bike is stand: Take the bike out of the stand · `unclamp-from-stand` (−bike_in_stand)
   - when choice.hold_bike is hang: Take the bike down · `take-bike-down` (−bike_hung)
   - when choice.hold_bike is upside_down: Turn the bike back over · `turn-bike-upright` (−bike_upside_down)

**Finish** (good path only; skipped after an exit):

13. Test ride the gears · `shift-test-ride` · inspection <sub>apart: nothing</sub>
   - `fine` → continue
   - `slow-to-bigger` → **EXIT, shop only**: "Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it."
   - `slow-to-smaller` → **EXIT, shop only**: "Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it."

Jump-ahead paths:

- `derailleur.mechanical.stand--unsafe-check-all-gears-chain-off--jump`: exit at `check-all-gears` with bike_in_stand → jumps to `unclamp-from-stand`, ends with nothing apart and the shop summary
- `derailleur.mechanical.hang--unsafe-check-all-gears-chain-off--jump`: exit at `check-all-gears` with bike_hung → jumps to `take-bike-down`, ends with nothing apart and the shop summary
- `derailleur.mechanical.upside-down--unsafe-check-all-gears-chain-off--jump`: exit at `check-all-gears` with bike_upside_down → jumps to `turn-bike-upright`, ends with nothing apart and the shop summary

## Case `test-rides` (ground)

Time of the complete path: 31 min (ground), 32 min (ground)

3. Park the bike · `park-bike` · action <sub>apart: nothing</sub>
4. Ride into the hardest gear · `ride-to-smallest-sprocket` · action <sub>apart: nothing</sub>
5. Set the outer limit (H screw) · `check-high-limit` · check <sub>apart: nothing</sub>
6. Ride into the easiest gear · `ride-to-largest-sprocket` · action <sub>apart: nothing</sub>
7. Set the inner limit (L screw) · `check-low-limit` · safety check <sub>apart: nothing</sub>
   - buttons: `too-far-in` (BLOCK) · `too-far-out`
8. Double-check the inner limit · `check-low-limit-by-hand` · safety check <sub>apart: nothing</sub>
   - buttons: `too-far-in` (BLOCK)
9. Check the gap to the sprockets · `check-b-gap` · check <sub>apart: nothing</sub>
10. Set the cable tension on short rides · `check-cable-tension-riding` · check <sub>apart: nothing</sub>
11. Test every gear on a ride · `check-all-gears-riding` · safety check <sub>apart: nothing</sub>
   - buttons: `rattles` · `chain-off` (EXIT unsafe)

## Exits before the first step

- drive.gear_type = derailleur, drive.shifting = electronic → **EXIT, not covered**
- drive.gear_type = derailleur, drive.shifting = unknown → **EXIT, not covered**
- drive.gear_type = hub_gear → **EXIT, not covered**
- drive.gear_type = gearbox → **EXIT, not covered**
- drive.gear_type = single_speed → **EXIT, not covered**
- drive.gear_type = unknown → **EXIT, not covered**
