# Profile: City bike with derailleur, no stand

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

Trekking-style city bike, mechanical rear derailleur, no motor. The owner knows the gear type but not how the gears are connected.

| | |
| --- | --- |
| Known before the first flow | `bike.brand` = Brightwater<br>`bike.model` = City 8<br>`bike.year` = 2021<br>`bike.handlebar` = flat ("Flat bar")<br>`bike.colour` = #2e7d32<br>`geometry.wheel_bsd_mm` = 622 ("28 or 29 inch, 700C (622 mm)")<br>`bike.category` = trekking_city ("Trekking or city bike")<br>`bike.ebike` = false ("No motor")<br>`drive.gear_type` = derailleur ("Chain and derailleur") |
| Answers when asked | `drive.shifting` = mechanical ("With a cable") |
| Tools with them | none |

## Journey 1: Slow shifting, adjusted at home with the bike upside down

<sub>journey id `slow-shifting-upside-down`</sub>

### Symptom: "My gears don't shift cleanly"

Questions the app asks first:

1. "How is your rear derailleur shifted?" → With a cable

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

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → result: **Adjust the rear gears** (soon) ◀ **this path**
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → result: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → next check

Finding stored on the bike: `shift-test-ride` = slow-to-bigger.

### Job screen: Adjust the rear gears · soon

- **Do it myself**: tutorial `adjust-rear-shifting`, 28 to 31 min for this bike, difficulty 2
- **Take it to a shop**: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable." Price: no estimate yet.

The owner chooses: **Do it myself**.

### Tutorial: Adjust the rear gears

#### Before you start

No questions: everything needed is already known.

**How will you hold the bike while you work?**

- In a work stand (recommended; needs: Bike work stand)
  - The easiest way. The rear wheel turns freely and the bike cannot fall.
  - ⚠ Heavy bikes, such as e-bikes, can be too heavy for a small stand. Check the stand's maximum load.
- Hanging from a hook or a rope (needs: Strong hook or rope that can carry the bike)
  - The rear wheel hangs free, so you can turn the pedals by hand.
  - ⚠ The hook or rope must carry the whole bike. A heavy bike can fall and hurt you.
- Upside down, on saddle and handlebar ◀ **chosen**
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- On its wheels, and test with short rides
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

Tools picker. Needed: none. One of these, depending on your part: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.). Helpful: Soft mat or old blanket. (✓ = the owner has it)

Time shown for this bike: 28 to 31 min (depends on how the bike is held).

#### Steps

##### – Look at the rear derailleur · `derailleur-alignment` · not shown again: answered earlier in this session ("It hangs straight down, in line with the sprockets")

##### 1. Find the barrel adjuster · `barrel-adjuster-present` · inspection · 1 min

Find the barrel adjuster: a small ribbed knob on the gear cable. Look where the cable enters the derailleur, then where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

- [ ] **It is at the derailleur** — The cable tension can be set at the derailleur. → continue
- [ ] **It is at the shifter, or on the cable** — The cable tension can be set there. It works the same way. → continue ◀ **this path**
- [ ] **I cannot find one** — This bike may have no barrel adjuster. → **EXIT, not covered**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you.

##### 2. Turn the bike over · `turn-upside-down` · action · 2 min · from procedure `hold-bike`

Lay a soft mat on the floor and turn the bike over onto its saddle and handlebar. With a heavy bike, ask someone to help.

<sub>3D: focus saddle, handlebar · view whole_bike</sub>

Animation: "Turn the bike over onto the mat" (bike rotate, half a turn)

Tools: Soft mat or old blanket (helpful)

<sub>State: +bike_upside_down → now: bike_upside_down</sub>

##### 3. Shift to the hardest gear · `shift-to-smallest-sprocket` · action · 1 min

Turn the pedals forward by hand and use the right shifter until the chain sits on the smallest sprocket, the hardest gear.

<sub>3D: focus shifter_rear, smallest_sprocket, chain · view drive_side</sub>

Animation: "Shift while the pedals turn" (clip shift-to-smallest)

##### 4. Set the outer limit (H screw) · `check-high-limit` · safety check · 3 min

The chain is on the smallest sprocket. Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur: is it in line with the smallest sprocket?

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **In line, and the chain ran quietly** <sub>`in-line`</sub> → The H screw is set. Nothing to change.
- [ ] **Further out, away from the spokes** <sub>`too-far-out`</sub> → **BLOCK** (Next stays disabled): The chain could fall off the outside and jam. With the screwdriver or hex key, turn the screw marked H clockwise a quarter turn at a time, until the wheel is in line with the smallest sprocket.
  - Show solution: "Turn the H screw clockwise a quarter turn" (h_screw rotate, clockwise, a quarter turn)
- [ ] **The chain rattled, or jumped to a bigger sprocket** <sub>`rattles`</sub> → With the screwdriver or hex key, turn the screw marked H counterclockwise a quarter turn. Then turn the pedals, or ride a short way, and look and listen again. Repeat until the wheel is in line with the smallest sprocket and the chain runs quietly. If it does not move, stop turning: the cable holds it, and a later step sets the cable. ◀ **this path**
  - Show solution: "Turn the H screw counterclockwise a quarter turn" (h_screw rotate, counterclockwise, a quarter turn)

##### 5. Shift to the easiest gear · `shift-to-largest-sprocket` · action · 1 min

Turn the pedals slowly by hand and shift one gear at a time until the chain sits on the largest sprocket, the easiest gear. If the derailleur moves past it towards the spokes, stop turning the pedals at once.

<sub>3D: focus shifter_rear, largest_sprocket, chain · view drive_side</sub>

Animation: "Shift one gear at a time" (clip shift-to-largest)

##### 6. Set the inner limit (L screw) · `check-low-limit` · safety check · 3 min

The chain is on the largest sprocket. Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur: is it in line with the largest sprocket?

<sub>3D: focus upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **In line, and the chain ran quietly** <sub>`in-line`</sub> → The L screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** <sub>`too-far-in`</sub> → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. With the screwdriver or hex key, turn the screw marked L clockwise a quarter turn at a time, until the wheel is in line with the largest sprocket. ◀ **this path**
  - Show solution: "Turn the L screw clockwise a quarter turn" (l_screw rotate, clockwise, a quarter turn)
- [ ] **The chain rattled, or slipped off the largest sprocket** <sub>`rattles`</sub> → With the screwdriver or hex key, turn the screw marked L counterclockwise a quarter turn, then shift to the largest sprocket again, look and listen. Repeat until the wheel is in line with the largest sprocket and the chain runs quietly.
  - Show solution: "Turn the L screw counterclockwise a quarter turn" (l_screw rotate, counterclockwise, a quarter turn)

Next stays disabled. After the fix, the owner taps "In line, and the chain ran quietly" and goes on.

##### 7. Double-check the inner limit · `check-low-limit-by-hand` · safety check · 2 min

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: where does the upper toothed wheel stop?

<sub>3D: focus rear_derailleur, upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards_spokes, as far as it goes)

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **In line with the largest sprocket** <sub>`in-line`</sub> → The inner limit is safe. Let go of the derailleur. ◀ **this path**
- [ ] **Past the largest sprocket, towards the spokes** <sub>`too-far-in`</sub> → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. With the screwdriver or hex key, turn the screw marked L clockwise a quarter turn, then push and look again.
  - Show solution: "Turn the L screw clockwise a quarter turn" (l_screw rotate, clockwise, a quarter turn)

##### 8. Check the gap to the sprockets · `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side at the gap between the upper toothed wheel of the derailleur and the sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

- [ ] **A small gap, the teeth do not touch** <sub>`small-gap`</sub> → The gap is fine. The manual for your derailleur gives the exact gap, if you want to check it.
- [ ] **The wheel touches the sprocket, or almost** <sub>`touching`</sub> → With the screwdriver or hex key, turn the B screw at the back of the derailleur clockwise, a little at a time, until there is a small gap.
  - Show solution: "Turn the B screw clockwise a little" (b_screw rotate, clockwise, a little)
- [ ] **A big gap, and shifting here was slow** <sub>`wide-gap`</sub> → With the screwdriver or hex key, turn the B screw counterclockwise, a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Turn the B screw counterclockwise a little" (b_screw rotate, counterclockwise, a little)

##### 9. Set the cable tension · `check-cable-tension` · check · 5 min

Turn the pedals by hand and shift one gear at a time, through all gears and back. Watch the chain.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy shifting to easier gears** <sub>`slow-easier`</sub> → The cable is too loose. Look at the barrel adjuster from the side where the cable goes in, turn it counterclockwise a quarter turn, then shift again. Never turn it all the way out.
  - Show solution: "Turn the barrel adjuster counterclockwise a quarter turn" (barrel_adjuster rotate, counterclockwise, a quarter turn)
- [ ] **Slow or noisy shifting to harder gears** <sub>`slow-harder`</sub> → The cable is too tight. Look at the barrel adjuster from the side where the cable goes in, turn it clockwise a quarter turn, then shift again. If four turns do not help, a shop can check the cable.
  - Show solution: "Turn the barrel adjuster clockwise a quarter turn" (barrel_adjuster rotate, clockwise, a quarter turn)
- [ ] **Every shift is quick and quiet** <sub>`smooth`</sub> → The cable tension is right.

##### 10. Test every gear · `check-all-gears` · safety check · 2 min

Turn the pedals and shift through every gear, from the hardest to the easiest and back. Watch and listen.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** <sub>`quiet`</sub> → Your rear gears are set. ◀ **this path**
- [ ] **It rattles or jumps in some gears** <sub>`rattles`</sub> → Go back to the cable step and adjust as it says, then shift through again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** <sub>`chain-off`</sub> → **EXIT, unsafe**: Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop. · jump: `release-bike`

##### 11. Turn the bike back over · `turn-bike-upright` · action · 1 min · from procedure `release-bike`

Turn the bike back onto its wheels. With a heavy bike, ask someone to help.

<sub>3D: focus bike · view whole_bike</sub>

Animation: "Turn the bike back onto its wheels" (bike rotate, half a turn)

<sub>State: −bike_upside_down → now: nothing apart</sub>

##### Finish

##### 12. Test ride the gears · `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → **EXIT, shop only**: Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it.
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → **EXIT, shop only**: Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it.
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → continue ◀ **this path**

#### End

Done. Nothing is left apart. Tutorial time: 27 min.

**Journey ends:** tutorial complete. **Time:** 32 min. **Questions asked:** 1.

---

## Journey 2: The derailleur looks bent, so the owner goes to a shop

<sub>journey id `bent-derailleur`</sub>

### Symptom: "My gears don't shift cleanly"

Questions the app asks first:

1. "How is your rear derailleur shifted?" → With a cable

#### Checks

##### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride) ◀ **this path**

Finding stored on the bike: `derailleur-alignment` = crooked.

### Job screen: Have the rear gears checked · **do not ride**

- Do it myself: no guide yet
- **Take it to a shop**: "The rear gears do not work as they should. Please check the rear derailleur, the part that holds it, and the gear cable." Price: no estimate yet.

The owner chooses: **Take it to a shop**.

**Shop summary** (to show or tell the mechanic):

- Bike: City bike with derailleur, no stand. `bike.brand` = Brightwater; `bike.model` = City 8; `bike.year` = 2021; `bike.handlebar` = flat ("Flat bar"); `bike.colour` = #2e7d32; `geometry.wheel_bsd_mm` = 622 ("28 or 29 inch, 700C (622 mm)"); `bike.category` = trekking_city ("Trekking or city bike"); `bike.ebike` = false ("No motor"); `drive.gear_type` = derailleur ("Chain and derailleur"); `drive.shifting` = mechanical ("With a cable")
- Job: Have the rear gears checked
- Tell the mechanic: "The rear gears do not work as they should. Please check the rear derailleur, the part that holds it, and the gear cable."
- Found: It leans towards the spokes, or looks twisted (`derailleur-alignment`: crooked)
- Price: no estimate yet

**Journey ends:** shop: Have the rear gears checked. **Time:** 1 min. **Questions asked:** 1.

---

## Journey 3: Routine check finds slow shifting; the to-do item opens the guide

<sub>journey id `routine-check-slow-shifting`</sub>

### Routine check

##### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → ok ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → to-do: **Have the rear gears checked** (do_not_ride)

##### 2. Look at the chain · `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → ok ◀ **this path**
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → to-do: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → to-do: **Clean and oil the chain** (soon)

##### 3. Test ride the gears · `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → to-do: **Adjust the rear gears** (soon) ◀ **this path**
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → to-do: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → ok

#### To-do list on the bike

- [ ] Adjust the rear gears (soon) · from `shift-test-ride` = slow-to-bigger · opens tutorial `adjust-rear-shifting`

**Journey ends:** 1 to-do item(s). **Time:** 5 min. **Questions asked:** 0.

---
