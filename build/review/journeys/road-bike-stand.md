# Profile: Road bike with a work stand

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

Road bike, 11-speed mechanical rear derailleur. The owner has a work stand.

| | |
| --- | --- |
| Known before the first flow | `bike.category` = road_gravel ("Road or gravel bike")<br>`bike.ebike` = false ("No motor")<br>`drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_speeds` = 11<br>`drive.rear_derailleur_model` = Shimano 105 RD-R7000 |
| Answers when asked | none |
| Tools with them | Bike work stand |

## Journey 1: Adjusting in the stand, but the chain touches the spokes at the end

<sub>journey id `chain-touches-spokes`</sub>

### Symptom: "My gears don't shift cleanly"

No questions: the app already knows what it needs.

#### Checks

##### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride)

##### 2. Look at the chain · `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → next check ◀ **this path**
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)

##### 3. Test ride the gears · `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → result: **Adjust the rear gears** (soon)
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → result: **Adjust the rear gears** (soon) ◀ **this path**
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → next check

Finding stored on the bike: `shift-test-ride` = slow-to-smaller.

### Job screen: Adjust the rear gears · soon

- **Do it myself**: tutorial `adjust-rear-shifting`, 26 to 29 min for this bike, difficulty 2
- **Take it to a shop**: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable." Price: no estimate yet.

The owner chooses: **Do it myself**.

### Tutorial: Adjust the rear gears

#### Before you start

No questions: everything needed is already known.

**How will you hold the bike while you work?**

- In a work stand (recommended; needs: Bike work stand) ◀ **chosen**
  - The easiest way. The rear wheel turns freely and the bike cannot fall.
  - ⚠ Heavy bikes, such as e-bikes, can be too heavy for a small stand. Check the stand's maximum load.
- Hanging from a hook or a rope (needs: Strong hook or rope that can carry the bike)
  - The rear wheel hangs free, so you can turn the pedals by hand.
  - ⚠ The hook or rope must carry the whole bike. A heavy bike can fall and hurt you.
- Upside down, on saddle and handlebar
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- On its wheels, and test with short rides
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

Tools picker. Needed: Bike work stand ✓. One of these, depending on your part: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.). Helpful: none. (✓ = the owner has it)

Time shown for this bike: 26 to 29 min (depends on how the bike is held).

#### Steps

##### – Look at the rear derailleur · `derailleur-alignment` · not shown again: answered earlier in this session ("It hangs straight down, in line with the sprockets")

##### 1. Find the barrel adjuster · `barrel-adjuster-present` · inspection · 1 min

Find the barrel adjuster: a small ribbed knob on the gear cable. Look where the cable enters the derailleur, then where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

- [ ] **It is at the derailleur** — The cable tension can be set at the derailleur. → continue ◀ **this path**
- [ ] **It is at the shifter, or on the cable** — The cable tension can be set there. It works the same way. → continue
- [ ] **I cannot find one** — This bike may have no barrel adjuster. → **EXIT, not covered**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you.

##### 2. Clamp the bike in the stand · `clamp-in-stand` · action · 2 min · from procedure `hold-bike`

Clamp the seat post in the stand so the rear wheel hangs free. With a heavy bike, ask someone to help you lift it.

<sub>3D: focus stand_clamp, seat_post · view whole_bike</sub>

Animation: "Close the clamp around the seat post" (stand_clamp rotate, clockwise, until the bike sits firm)

Tools: Bike work stand

<sub>State: +bike_in_stand → now: bike_in_stand</sub>

##### 3. Check the inner limit (L screw) · `check-low-limit-by-hand` · safety check · 3 min

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: where does the upper of its two small toothed wheels stop? You turn the screws with the small screwdriver or hex key.

<sub>3D: focus rear_derailleur, upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards_spokes, as far as it goes)

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **In line with the largest sprocket** <sub>`in-line`</sub> → The L screw is set. Let go of the derailleur. ◀ **this path**
- [ ] **Past the largest sprocket, towards the spokes** <sub>`too-far-in`</sub> → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. Screw in the screw marked L a quarter turn, then push and look again.
  - Show solution: "Screw in the L screw a quarter turn" (l_screw rotate, clockwise, a quarter turn)
- [ ] **It stops before the largest sprocket** <sub>`short`</sub> → The chain may not reach the largest sprocket. Unscrew the screw marked L a quarter turn, then push and look again.
  - Show solution: "Unscrew the L screw a quarter turn" (l_screw rotate, counterclockwise, a quarter turn)

##### 4. Shift to the hardest gear · `shift-to-smallest-sprocket` · action · 1 min

Turn the pedals forward by hand and use the right shifter until the chain sits on the smallest sprocket, the hardest gear.

<sub>3D: focus shifter_rear, smallest_sprocket, chain · view drive_side</sub>

Animation: "Shift while the pedals turn" (clip shift-to-smallest)

##### 5. Check the outer limit (H screw) · `check-high-limit` · safety check · 3 min

Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur. Where is it, compared with the smallest sprocket? You turn the screws with the small screwdriver or hex key.

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **In line with the smallest sprocket** <sub>`in-line`</sub> → The H screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** <sub>`too-far-in`</sub> → Unscrew the screw marked H a quarter turn at a time, until the wheel is in line with the sprocket. If it does not move, stop turning: the cable holds it, and a later step sets the cable.
  - Show solution: "Unscrew the H screw a quarter turn" (h_screw rotate, counterclockwise, a quarter turn)
- [ ] **Further out, away from the spokes** <sub>`too-far-out`</sub> → **BLOCK** (Next stays disabled): The chain could fall off the outside and jam. Screw in the screw marked H a quarter turn at a time, until the wheel is in line with the sprocket. ◀ **this path**
  - Show solution: "Screw in the H screw a quarter turn" (h_screw rotate, clockwise, a quarter turn)

Next stays disabled. After the fix, the owner taps "In line with the smallest sprocket" and goes on.

##### 6. Shift to the easiest gear · `shift-to-largest-sprocket` · action · 1 min

Turn the pedals slowly by hand and shift one gear at a time until the chain sits on the largest sprocket, the easiest gear.

<sub>3D: focus shifter_rear, largest_sprocket, chain · view drive_side</sub>

Animation: "Shift one gear at a time" (clip shift-to-largest)

##### 7. Check the gap to the sprockets · `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side at the gap between the upper toothed wheel of the derailleur and the sprocket. You turn the screws with the small screwdriver or hex key.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **A small gap, the teeth do not touch** <sub>`small-gap`</sub> → The gap is fine. The manual for Shimano 105 RD-R7000 gives the exact gap, if you want to check it.
- [ ] **The wheel touches the sprocket, or almost** <sub>`touching`</sub> → Screw in the B screw, at the back of the derailleur, a little at a time until there is a small gap.
  - Show solution: "Screw in the B screw a little" (b_screw rotate, clockwise, a little)
- [ ] **A big gap, and shifting here was slow** <sub>`wide-gap`</sub> → Unscrew the B screw a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Unscrew the B screw a little" (b_screw rotate, counterclockwise, a little)

##### 8. Set the cable tension · `check-cable-tension` · check · 5 min

Turn the pedals by hand and shift one gear at a time, through all gears and back. Watch the chain.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy shifting to easier gears** <sub>`slow-easier`</sub> → The cable is too loose. Unscrew the barrel adjuster a quarter turn, then shift again. Never unscrew it all the way out.
  - Show solution: "Unscrew the barrel adjuster a quarter turn" (barrel_adjuster rotate, counterclockwise, a quarter turn)
- [ ] **Slow or noisy shifting to harder gears** <sub>`slow-harder`</sub> → The cable is too tight. Screw in the barrel adjuster a quarter turn, then shift again. If four turns do not help, a shop can check the cable.
  - Show solution: "Screw in the barrel adjuster a quarter turn" (barrel_adjuster rotate, clockwise, a quarter turn)
- [ ] **Every shift is quick and quiet** <sub>`smooth`</sub> → The cable tension is right.

##### 9. Test every gear · `check-all-gears` · safety check · 2 min

Turn the pedals and shift through every gear, from the hardest to the easiest and back. Watch and listen.

> Your bike has 11 gears at the rear.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** <sub>`quiet`</sub> → Your rear gears are set.
- [ ] **It rattles or jumps in some gears** <sub>`rattles`</sub> → Go back to the cable step and adjust as it says, then shift through again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** <sub>`chain-off`</sub> → **EXIT, unsafe**: Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop. · jump: `release-bike` ◀ **this path**

**Stop screen (unsafe)** (the progress bar does not move): "Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop."

Buttons: [Show me how to put it back] [Find a shop]

The owner taps "Show me how to put it back". **Jumped ahead** in the same tutorial to `unclamp-from-stand`; 0 step(s) skipped. The progress bar moves forward once.

##### 10. Take the bike out of the stand · `unclamp-from-stand` · action · 1 min · from procedure `release-bike`

Hold the bike, open the stand clamp and put the bike on its wheels. With a heavy bike, ask someone to help.

<sub>3D: focus stand_clamp · view whole_bike</sub>

Animation: "Open the clamp while you hold the bike" (stand_clamp rotate, counterclockwise, until open)

Tools: Bike work stand

<sub>State: −bike_in_stand → now: nothing apart</sub>

#### End

**Shop summary** (to show or tell the mechanic):

- Bike: Road bike with a work stand. `bike.category` = road_gravel ("Road or gravel bike"); `bike.ebike` = false ("No motor"); `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain"); `drive.shifting` = mechanical ("A thin cable in a housing"); `drive.rear_speeds` = 11; `drive.rear_derailleur_model` = Shimano 105 RD-R7000
- Job: Adjust the rear gears
- Tell the mechanic: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable."
- Found: Slow or rattling when shifting to harder gears (`shift-test-ride`: slow-to-smaller)
- Found during the tutorial: "The chain falls off, or touches the spokes" (`check-all-gears`)
- Already done: tutorial `adjust-rear-shifting` up to the stop; the bike is back on its wheels
- Price: no estimate yet

Tutorial time: 22 min.

**Journey ends:** stop, jump ahead, bike put back, shop. **Time:** 27 min. **Questions asked:** 0.

---

## Journey 2: Opens the tutorial directly, but finds no barrel adjuster

<sub>journey id `no-barrel-adjuster`</sub>

### Tutorial: Adjust the rear gears

#### Before you start

No questions: everything needed is already known.

**How will you hold the bike while you work?**

- In a work stand (recommended; needs: Bike work stand) ◀ **chosen**
  - The easiest way. The rear wheel turns freely and the bike cannot fall.
  - ⚠ Heavy bikes, such as e-bikes, can be too heavy for a small stand. Check the stand's maximum load.
- Hanging from a hook or a rope (needs: Strong hook or rope that can carry the bike)
  - The rear wheel hangs free, so you can turn the pedals by hand.
  - ⚠ The hook or rope must carry the whole bike. A heavy bike can fall and hurt you.
- Upside down, on saddle and handlebar
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- On its wheels, and test with short rides
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

Tools picker. Needed: Bike work stand ✓. One of these, depending on your part: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.). Helpful: none. (✓ = the owner has it)

Time shown for this bike: 26 to 29 min (depends on how the bike is held).

#### Steps

##### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → continue ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → **EXIT, unsafe**: Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop.

##### 2. Find the barrel adjuster · `barrel-adjuster-present` · inspection · 1 min

Find the barrel adjuster: a small ribbed knob on the gear cable. Look where the cable enters the derailleur, then where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

- [ ] **It is at the derailleur** — The cable tension can be set at the derailleur. → continue
- [ ] **It is at the shifter, or on the cable** — The cable tension can be set there. It works the same way. → continue
- [ ] **I cannot find one** — This bike may have no barrel adjuster. → **EXIT, not covered**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you. ◀ **this path**

**Not covered yet** (the progress bar does not move): "Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you."

Buttons: [Find a shop] [Ask the assistant]

**Shop summary** (to show or tell the mechanic):

- Bike: Road bike with a work stand. `bike.category` = road_gravel ("Road or gravel bike"); `bike.ebike` = false ("No motor"); `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain"); `drive.shifting` = mechanical ("A thin cable in a housing"); `drive.rear_speeds` = 11; `drive.rear_derailleur_model` = Shimano 105 RD-R7000
- Job: Adjust the rear gears
- Tell the mechanic: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable."
- Stopped at: `barrel-adjuster-present`, "none"
- Price: no estimate yet

**Journey ends:** exit (not_covered) at barrel-adjuster-present. **Time:** 2 min. **Questions asked:** 0.

---

## Journey 3: Routine check finds a dirty chain

<sub>journey id `routine-check-dirty-chain`</sub>

### Routine check

##### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → ok ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → to-do: **Have the rear gears checked** (do_not_ride)

##### 2. Look at the chain · `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → ok
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → to-do: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → to-do: **Clean and oil the chain** (soon) ◀ **this path**

##### 3. Test ride the gears · `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → to-do: **Adjust the rear gears** (soon)
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → to-do: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → ok ◀ **this path**

#### To-do list on the bike

- [ ] Clean and oil the chain (soon) · from `chain-condition` = dirty · opens the job screen (shop only, no guide yet)

**Journey ends:** 1 to-do item(s). **Time:** 5 min. **Questions asked:** 0.

---
