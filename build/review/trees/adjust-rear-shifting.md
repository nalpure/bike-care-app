# Flow tree: Tutorial: Adjust the rear gears

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

<sub>Unit `tree:tutorial:adjust-rear-shifting` · hash `e912f978b4d4` · mechanic: ⬜ not reviewed</sub>

The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).
To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.

## Before the first step

- Questions, only when not yet known: `drive.gear_type`, `drive.shifting`
- Read from the bike's data, never asked: `drive.rear_derailleur_type`
- Run choices: `hold_bike`
- Difficulty 2

## Branches

Evaluated top to bottom; the first match wins.

- when drive.gear_type is derailleur and drive.shifting is mechanical → nested branch:
  - when drive.rear_derailleur_type is low_normal → **EXIT, not covered**: "Rapid-rise rear derailleurs work the other way round and are not supported yet. A shop can adjust it for you."
  - when choice.hold_bike is stand or hang or upside_down → case `wheel-free`
  - when choice.hold_bike is ground → case `test-rides`
- when drive.gear_type is derailleur and drive.shifting is electronic → **EXIT, not covered**: "Electronic shifting is not covered yet. It is adjusted with the maker's app or buttons, not with a cable."
- when drive.gear_type is derailleur and drive.shifting is unknown → **EXIT, not covered**: "We need to know whether your gears use a cable before this guide can help. Look at the right shifter and come back, or find a shop."
- when drive.gear_type is hub_gear → **EXIT, not covered**: "Hub gears are not covered yet. They are adjusted differently from gears with a derailleur."
- when drive.gear_type is gearbox → **EXIT, not covered**: "Gearboxes at the pedals are not covered yet."
- when drive.gear_type is single_speed → **EXIT, not covered**: "Your bike has only one gear, so there is nothing to adjust here. If the chain is loose or skips, a shop can help."
- when drive.gear_type is unknown → **EXIT, not covered**: "We need to know what kind of gears your bike has before this guide can help. Look at the rear wheel and come back, or find a shop."

## Case `wheel-free` (stand · hang · upside_down)

Time of the complete path: 26 min (stand), 27 min (hang), 26 min (upside_down)

1. Look at the rear derailleur · `derailleur-alignment` · inspection <sub>apart: nothing</sub>
   - `straight` → continue
   - `crooked` → **EXIT, unsafe**: "Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop."
2. Find the barrel adjuster · `barrel-adjuster-present` · inspection <sub>apart: nothing</sub>
   - `at-derailleur` → continue
   - `at-shifter-or-cable` → continue
   - `none` → **EXIT, not covered**: "Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you."
3. procedure `hold-bike` <sub>apart: nothing</sub>
   - when choice.hold_bike is stand: Clamp the bike in the stand · `clamp-in-stand` (+bike_in_stand)
   - when choice.hold_bike is hang: Hang the bike up · `hang-bike` (+bike_hung)
   - when choice.hold_bike is upside_down: Turn the bike over · `turn-upside-down` (+bike_upside_down)
4. Check the inner limit (L screw) · `check-low-limit-by-hand` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `in-line` · `too-far-in` (BLOCK) · `short`
5. Shift to the hardest gear · `shift-to-smallest-sprocket` · action <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
6. Check the outer limit (H screw) · `check-high-limit` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `in-line` · `too-far-in` · `too-far-out` (BLOCK)
7. Shift to the easiest gear · `shift-to-largest-sprocket` · action <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
8. Check the gap to the sprockets · `check-b-gap` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
9. Set the cable tension · `check-cable-tension` · check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
10. Test every gear · `check-all-gears` · safety check <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - buttons: `quiet` · `rattles` · `chain-off` (EXIT unsafe → jump to `release-bike`)
11. procedure `release-bike` <sub>apart: bike_in_stand / bike_hung / bike_upside_down</sub>
   - when choice.hold_bike is stand: Take the bike out of the stand · `unclamp-from-stand` (−bike_in_stand)
   - when choice.hold_bike is hang: Take the bike down · `take-bike-down` (−bike_hung)
   - when choice.hold_bike is upside_down: Turn the bike back over · `turn-bike-upright` (−bike_upside_down)

**Finish** (good path only; skipped after an exit):

12. Test ride the gears · `shift-test-ride` · inspection <sub>apart: nothing</sub>
   - `fine` → continue
   - `slow-to-bigger` → **EXIT, shop only**: "Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it."
   - `slow-to-smaller` → **EXIT, shop only**: "Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it."

Jump-ahead paths:

- `derailleur.mechanical.stand--unsafe-check-all-gears-chain-off--jump`: exit at `check-all-gears` with bike_in_stand → jumps to `unclamp-from-stand`, ends with nothing apart and the shop summary
- `derailleur.mechanical.hang--unsafe-check-all-gears-chain-off--jump`: exit at `check-all-gears` with bike_hung → jumps to `take-bike-down`, ends with nothing apart and the shop summary
- `derailleur.mechanical.upside-down--unsafe-check-all-gears-chain-off--jump`: exit at `check-all-gears` with bike_upside_down → jumps to `turn-bike-upright`, ends with nothing apart and the shop summary

## Case `test-rides` (ground)

Time of the complete path: 29 min (ground)

1. Look at the rear derailleur · `derailleur-alignment` · inspection <sub>apart: nothing</sub>
   - `straight` → continue
   - `crooked` → **EXIT, unsafe**: "Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop."
2. Find the barrel adjuster · `barrel-adjuster-present` · inspection <sub>apart: nothing</sub>
   - `at-derailleur` → continue
   - `at-shifter-or-cable` → continue
   - `none` → **EXIT, not covered**: "Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you."
3. Park the bike · `park-bike` · action <sub>apart: nothing</sub>
4. Check the inner limit (L screw) · `check-low-limit-by-hand` · safety check <sub>apart: nothing</sub>
   - buttons: `in-line` · `too-far-in` (BLOCK) · `short`
5. Ride into the hardest gear · `ride-to-smallest-sprocket` · action <sub>apart: nothing</sub>
6. Check the outer limit (H screw) · `check-high-limit` · safety check <sub>apart: nothing</sub>
   - buttons: `in-line` · `too-far-in` · `too-far-out` (BLOCK)
7. Ride into the easiest gear · `ride-to-largest-sprocket` · action <sub>apart: nothing</sub>
8. Check the gap to the sprockets · `check-b-gap` · check <sub>apart: nothing</sub>
9. Set the cable tension on short rides · `check-cable-tension-riding` · check <sub>apart: nothing</sub>
10. Test every gear on a ride · `check-all-gears-riding` · safety check <sub>apart: nothing</sub>
   - buttons: `quiet` · `rattles` · `chain-off` (EXIT unsafe)

## Exits before the first step

- drive.gear_type = derailleur, drive.shifting = mechanical, drive.rear_derailleur_type = low_normal → **EXIT, not covered**
- drive.gear_type = derailleur, drive.shifting = electronic → **EXIT, not covered**
- drive.gear_type = derailleur, drive.shifting = unknown → **EXIT, not covered**
- drive.gear_type = hub_gear → **EXIT, not covered**
- drive.gear_type = gearbox → **EXIT, not covered**
- drive.gear_type = single_speed → **EXIT, not covered**
- drive.gear_type = unknown → **EXIT, not covered**
