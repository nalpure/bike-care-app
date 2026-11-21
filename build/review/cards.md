# Card sheet

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

Every piece of text the user sees, exactly once. Review the wording as a beginner, the mechanics as a mechanic.
Where a card appears, and what is apart at that moment, is listed under it. Order, branches and exits are reviewed in the flow trees.

## Inspections

### Look at the rear derailleur

<sub>Unit `card:inspection:derailleur-alignment` · hash `54a1e043fb73` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>inspection · 1 min</sub>

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>Hands-off: usable in diagnoses and the routine check. Only when drive.gear_type is derailleur.</sub>

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** <sub>`straight`</sub> — The derailleur does not look bent.
- [ ] **It leans towards the spokes, or looks twisted** <sub>`crooked`</sub> — The derailleur or the part that holds it may be bent. → usually: **Have the rear gears checked** (do_not_ride)

<sub>What each state does in a tutorial is part of that tutorial's flow tree.</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: nothing apart</sub>
- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>
- <sub>diagnosis gears-shift-badly: check 1; before it: nothing apart</sub>
- <sub>routine check routine-check: item 1; before it: nothing apart</sub>

### Find the barrel adjuster

<sub>Unit `card:inspection:barrel-adjuster-present` · hash `0dde7e3cf43e` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>inspection · 1 min</sub>

Find the barrel adjuster: a small ribbed knob on the gear cable. Look where the cable enters the derailleur, then where it leaves the right shifter.

<sub>Hands-off: usable in diagnoses and the routine check. Only when drive.gear_type is derailleur.</sub>

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

- [ ] **It is at the derailleur** <sub>`at-derailleur`</sub> — The cable tension can be set at the derailleur.
- [ ] **It is at the shifter, or on the cable** <sub>`at-shifter-or-cable`</sub> — The cable tension can be set there. It works the same way.
- [ ] **I cannot find one** <sub>`none`</sub> — This bike may have no barrel adjuster.

<sub>What each state does in a tutorial is part of that tutorial's flow tree.</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: nothing apart</sub>
- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Look at the chain

<sub>Unit `card:inspection:chain-condition` · hash `9e85446a8c95` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>inspection · 1 min</sub>

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>Hands-off: usable in diagnoses and the routine check. Only when drive.gear_type is derailleur or hub_gear or gearbox or single_speed.</sub>

<sub>3D: focus chain · view chain_close</sub>

Animation: "Turn the pedals backwards" (crank rotate, backward, slowly, two full turns)

- [ ] **Clean, with a thin film of oil** <sub>`clean`</sub> — The chain looks cared for.
- [ ] **Dry, rusty, or it squeaks** <sub>`dry-or-rusty`</sub> — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → usually: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** <sub>`dirty`</sub> — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → usually: **Clean and oil the chain** (soon)

<sub>What each state does in a tutorial is part of that tutorial's flow tree.</sub>

<sub>Appears in:</sub>

- <sub>diagnosis gears-shift-badly: check 2; before it: nothing apart</sub>
- <sub>routine check routine-check: item 2; before it: nothing apart</sub>

### Test ride the gears

<sub>Unit `card:inspection:shift-test-ride` · hash `ec2fa7e2a397` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>inspection · 3 min</sub>

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>Hands-off: usable in diagnoses and the routine check. Only when drive.gear_type is derailleur.</sub>

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** <sub>`slow-to-bigger`</sub> — The chain is slow to climb to the bigger sprockets, the easier gears. → usually: **Adjust the rear gears** (soon)
- [ ] **Slow or rattling when shifting to harder gears** <sub>`slow-to-smaller`</sub> — The chain is slow to drop to the smaller sprockets, the harder gears. → usually: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** <sub>`fine`</sub> — The rear gears shift well.

<sub>What each state does in a tutorial is part of that tutorial's flow tree.</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free, finish; when holding: stand, hang, upside_down; before it: nothing apart</sub>
- <sub>diagnosis gears-shift-badly: check 3; before it: nothing apart</sub>
- <sub>routine check routine-check: item 3; before it: nothing apart</sub>

## Steps

### Clamp the bike in the stand

<sub>Unit `card:step:clamp-in-stand` · hash `2f540ab30e6d` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 2 min</sub>

Clamp the seat post in the stand so the rear wheel hangs free. With a heavy bike, ask someone to help you lift it.

Tools. Needed: Bike work stand. Helpful: none.

<sub>3D: focus stand_clamp, seat_post · view whole_bike</sub>

Animation: "Close the clamp around the seat post" (stand_clamp rotate, clockwise, until the bike sits firm)

<sub>State: sets bike_in_stand</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand; via `hold-bike`; before it: nothing apart</sub>

### Hang the bike up

<sub>Unit `card:step:hang-bike` · hash `9b8735cb982e` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 3 min</sub>

Hang the bike by the front of its saddle from a strong hook or rope, so the rear wheel is off the ground, and check that it hangs firmly before you let go. Never use thin string or a coat hook: it can break, and the bike falls.

Tools. Needed: Strong hook or rope that can carry the bike. Helpful: none.

<sub>3D: focus saddle, rear_wheel · view whole_bike</sub>

Animation: "Lift the rear of the bike onto the hook" (bike pull, up, until the rear wheel is off the ground)

<sub>State: sets bike_hung</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: hang; via `hold-bike`; before it: nothing apart</sub>

### Turn the bike over

<sub>Unit `card:step:turn-upside-down` · hash `921c45c5c354` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 2 min</sub>

Lay a soft mat on the floor and turn the bike over onto its saddle and handlebar. With a heavy bike, ask someone to help.

Tools. Needed: none. Helpful: Soft mat or old blanket.

<sub>3D: focus saddle, handlebar · view whole_bike</sub>

Animation: "Turn the bike over onto the mat" (bike rotate, half a turn)

<sub>State: sets bike_upside_down</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: upside_down; via `hold-bike`; before it: nothing apart</sub>

### Take the bike out of the stand

<sub>Unit `card:step:unclamp-from-stand` · hash `13ec6b9b362e` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 1 min</sub>

Hold the bike, open the stand clamp and put the bike on its wheels. With a heavy bike, ask someone to help.

Tools. Needed: Bike work stand. Helpful: none.

<sub>3D: focus stand_clamp · view whole_bike</sub>

Animation: "Open the clamp while you hold the bike" (stand_clamp rotate, counterclockwise, until open)

<sub>State: clears bike_in_stand</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand; via `release-bike`; before it: bike_in_stand</sub>
- <sub>tutorial adjust-rear-shifting: case wheel-free, after a jump ahead; when holding: stand; via `release-bike`; before it: bike_in_stand</sub>

### Take the bike down

<sub>Unit `card:step:take-bike-down` · hash `440710a4e697` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 1 min</sub>

Hold the bike, lift it off the hook or rope and put the rear wheel on the ground.

Tools. Needed: Strong hook or rope that can carry the bike. Helpful: none.

<sub>3D: focus saddle, rear_wheel · view whole_bike</sub>

Animation: "Lift the bike off and set it down" (bike push, down, until the rear wheel is on the ground)

<sub>State: clears bike_hung</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: hang; via `release-bike`; before it: bike_hung</sub>
- <sub>tutorial adjust-rear-shifting: case wheel-free, after a jump ahead; when holding: hang; via `release-bike`; before it: bike_hung</sub>

### Turn the bike back over

<sub>Unit `card:step:turn-bike-upright` · hash `acf187848562` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 1 min</sub>

Turn the bike back onto its wheels. With a heavy bike, ask someone to help.

<sub>3D: focus bike · view whole_bike</sub>

Animation: "Turn the bike back onto its wheels" (bike rotate, half a turn)

<sub>State: clears bike_upside_down</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: upside_down; via `release-bike`; before it: bike_upside_down</sub>
- <sub>tutorial adjust-rear-shifting: case wheel-free, after a jump ahead; when holding: upside_down; via `release-bike`; before it: bike_upside_down</sub>

### Park the bike

<sub>Unit `card:step:park-bike` · hash `053426ee426c` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 1 min</sub>

Put the bike on its kickstand, or lean it against a wall at the saddle and rear wheel, with the gears facing you. Never lean it on the handlebar: it can turn, and the bike falls.

<sub>3D: focus kickstand, rear_wheel · view whole_bike</sub>

<sub>State: never while bike_in_stand · never while bike_hung · never while bike_upside_down</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Shift to the hardest gear

<sub>Unit `card:step:shift-to-smallest-sprocket` · hash `f83ef9c6dca4` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 1 min</sub>

Turn the pedals forward by hand and use the right shifter until the chain sits on the smallest sprocket, the hardest gear.

<sub>3D: focus shifter_rear, smallest_sprocket, chain · view drive_side</sub>

Animation: "Shift while the pedals turn" (clip shift-to-smallest)

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>

### Shift to the easiest gear

<sub>Unit `card:step:shift-to-largest-sprocket` · hash `e9b63ac6eadc` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 1 min</sub>

Turn the pedals slowly by hand and shift one gear at a time until the chain sits on the largest sprocket, the easiest gear. If the derailleur moves past it towards the spokes, stop turning the pedals at once.

<sub>3D: focus shifter_rear, largest_sprocket, chain · view drive_side</sub>

Animation: "Shift one gear at a time" (clip shift-to-largest)

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>

### Set the cable tension

<sub>Unit `card:step:check-cable-tension` · hash `4dff642539d3` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>check · 5 min</sub>

Turn the pedals by hand and shift one gear at a time, through all gears and back. Watch the chain.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy shifting to easier gears** <sub>`slow-easier`</sub> → The cable is too loose. Look at the barrel adjuster from the side where the cable goes in, turn it counterclockwise a quarter turn, then shift again. Never turn it all the way out.
  - Show solution: "Turn the barrel adjuster counterclockwise a quarter turn" (barrel_adjuster rotate, counterclockwise, a quarter turn)
- [ ] **Slow or noisy shifting to harder gears** <sub>`slow-harder`</sub> → The cable is too tight. Look at the barrel adjuster from the side where the cable goes in, turn it clockwise a quarter turn, then shift again. If four turns do not help, a shop can check the cable.
  - Show solution: "Turn the barrel adjuster clockwise a quarter turn" (barrel_adjuster rotate, clockwise, a quarter turn)
- [ ] **Every shift is quick and quiet** <sub>`smooth`</sub> → The cable tension is right.

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>

### Test every gear

<sub>Unit `card:step:check-all-gears` · hash `8e26b3c8fcad` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>safety check · 2 min</sub>

Turn the pedals and shift through every gear, from the hardest to the easiest and back. Watch and listen.

> _When drive.rear_speeds is known:_ Your bike has {drive.rear_speeds} gears at the rear.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** <sub>`quiet`</sub> → Your rear gears are set.
- [ ] **It rattles or jumps in some gears** <sub>`rattles`</sub> → Go back to the cable step and adjust as it says, then shift through again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** <sub>`chain-off`</sub> → **EXIT, unsafe**: Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop. · jump: `release-bike`

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>

### Ride into the hardest gear

<sub>Unit `card:step:ride-to-smallest-sprocket` · hash `a1da49aa1200` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 2 min</sub>

Ride slowly on a quiet path and shift into the hardest gear, the smallest sprocket. Listen to the chain, then stop and park the bike as before.

<sub>3D: focus shifter_rear, smallest_sprocket · view drive_side</sub>

<sub>State: never while bike_in_stand · never while bike_hung · never while bike_upside_down</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Ride into the easiest gear

<sub>Unit `card:step:ride-to-largest-sprocket` · hash `6861a331503e` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>action · 2 min</sub>

Ride slowly and shift one gear at a time into the easiest gear, the largest sprocket, then stop and park the bike as before. If the chain moves past it towards the spokes, stop pedalling at once.

<sub>3D: focus shifter_rear, largest_sprocket · view drive_side</sub>

<sub>State: never while bike_in_stand · never while bike_hung · never while bike_upside_down</sub>

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Set the cable tension on short rides

<sub>Unit `card:step:check-cable-tension-riding` · hash `e1114ea210d9` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>check · 10 min</sub>

Ride slowly and shift one gear at a time, through all gears and back. Stop and park the bike before you turn anything.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

<sub>State: never while bike_in_stand · never while bike_hung · never while bike_upside_down</sub>

- [ ] **Slow or noisy shifting to easier gears** <sub>`slow-easier`</sub> → The cable is too loose. Park the bike. Look at the barrel adjuster from the side where the cable goes in, turn it counterclockwise a quarter turn, then ride and shift again. Never turn it all the way out.
  - Show solution: "Turn the barrel adjuster counterclockwise a quarter turn" (barrel_adjuster rotate, counterclockwise, a quarter turn)
- [ ] **Slow or noisy shifting to harder gears** <sub>`slow-harder`</sub> → The cable is too tight. Park the bike. Look at the barrel adjuster from the side where the cable goes in, turn it clockwise a quarter turn, then ride and shift again. If four turns do not help, a shop can check the cable.
  - Show solution: "Turn the barrel adjuster clockwise a quarter turn" (barrel_adjuster rotate, clockwise, a quarter turn)
- [ ] **Every shift is quick and quiet** <sub>`smooth`</sub> → The cable tension is right.

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Test every gear on a ride

<sub>Unit `card:step:check-all-gears-riding` · hash `2e6f008950d2` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>safety check · 3 min</sub>

Ride once more and shift through every gear, from the hardest to the easiest and back. Watch and listen.

> _When drive.rear_speeds is known:_ Your bike has {drive.rear_speeds} gears at the rear.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

<sub>State: never while bike_in_stand · never while bike_hung · never while bike_upside_down</sub>

- [ ] **Every gear runs quietly** <sub>`quiet`</sub> → Your rear gears are set.
- [ ] **It rattles or jumps in some gears** <sub>`rattles`</sub> → Park the bike, go back to the cable step and adjust as it says, then ride again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** <sub>`chain-off`</sub> → **EXIT, unsafe**: Stop riding: the chain can catch in the spokes and lock the wheel. Push the bike to a shop.

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Set the outer limit (H screw)

<sub>Unit `card:step:check-high-limit` · hash `8db9c2d73c81` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>safety check · 3 min</sub>

The chain is on the smallest sprocket. Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur: is it in line with the smallest sprocket?

Tools. Needed: none. One of these, depending on your part: A tool for the small screws on the rear derailleur. Helpful: none.

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

- [ ] **In line, and the chain ran quietly** <sub>`in-line`</sub> → The H screw is set. Nothing to change.
- [ ] **Further out, away from the spokes** <sub>`too-far-out`</sub> → **BLOCK** (Next stays disabled): The chain could fall off the outside and jam. With the screwdriver or hex key, turn the screw marked H clockwise a quarter turn at a time, until the wheel is in line with the smallest sprocket.
  - Show solution: "Turn the H screw clockwise a quarter turn" (h_screw rotate, clockwise, a quarter turn)
- [ ] **The chain rattled, or jumped to a bigger sprocket** <sub>`rattles`</sub> → With the screwdriver or hex key, turn the screw marked H counterclockwise a quarter turn. Then turn the pedals, or ride a short way, and listen again. Repeat until the chain runs quietly. If it does not move, stop turning: the cable holds it, and a later step sets the cable.
  - Show solution: "Turn the H screw counterclockwise a quarter turn" (h_screw rotate, counterclockwise, a quarter turn)

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>
- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Set the inner limit (L screw)

<sub>Unit `card:step:check-low-limit` · hash `de8e575273f5` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>safety check · 3 min</sub>

The chain is on the largest sprocket. Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur: is it in line with the largest sprocket?

Tools. Needed: none. One of these, depending on your part: A tool for the small screws on the rear derailleur. Helpful: none.

<sub>3D: focus upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

- [ ] **In line, and the chain ran quietly** <sub>`in-line`</sub> → The L screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** <sub>`too-far-in`</sub> → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. With the screwdriver or hex key, turn the screw marked L clockwise a quarter turn at a time, until the wheel is in line with the largest sprocket.
  - Show solution: "Turn the L screw clockwise a quarter turn" (l_screw rotate, clockwise, a quarter turn)
- [ ] **The chain rattled, or slipped off the largest sprocket** <sub>`rattles`</sub> → With the screwdriver or hex key, turn the screw marked L counterclockwise a quarter turn, then shift to the largest sprocket again and listen. Repeat until the chain runs quietly.
  - Show solution: "Turn the L screw counterclockwise a quarter turn" (l_screw rotate, counterclockwise, a quarter turn)

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>
- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Double-check the inner limit

<sub>Unit `card:step:check-low-limit-by-hand` · hash `e6a9e5b83ee6` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>safety check · 2 min</sub>

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: where does the upper toothed wheel stop?

Tools. Needed: none. One of these, depending on your part: A tool for the small screws on the rear derailleur. Helpful: none.

<sub>3D: focus rear_derailleur, upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards_spokes, as far as it goes)

- [ ] **In line with the largest sprocket** <sub>`in-line`</sub> → The inner limit is safe. Let go of the derailleur.
- [ ] **Past the largest sprocket, towards the spokes** <sub>`too-far-in`</sub> → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. With the screwdriver or hex key, turn the screw marked L clockwise a quarter turn, then push and look again.
  - Show solution: "Turn the L screw clockwise a quarter turn" (l_screw rotate, clockwise, a quarter turn)

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>
- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

### Check the gap to the sprockets

<sub>Unit `card:step:check-b-gap` · hash `4420c03a25cc` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

<sub>check · 3 min</sub>

Keep the chain on the largest sprocket. Look from the side at the gap between the upper toothed wheel of the derailleur and the sprocket.

Tools. Needed: none. One of these, depending on your part: A tool for the small screws on the rear derailleur. Helpful: none.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

- [ ] **A small gap, the teeth do not touch** <sub>`small-gap`</sub> → The gap is fine. The manual for {drive.rear_derailleur_model|your derailleur} gives the exact gap, if you want to check it.
- [ ] **The wheel touches the sprocket, or almost** <sub>`touching`</sub> → With the screwdriver or hex key, turn the B screw at the back of the derailleur clockwise, a little at a time, until there is a small gap.
  - Show solution: "Turn the B screw clockwise a little" (b_screw rotate, clockwise, a little)
- [ ] **A big gap, and shifting here was slow** <sub>`wide-gap`</sub> → With the screwdriver or hex key, turn the B screw counterclockwise, a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Turn the B screw counterclockwise a little" (b_screw rotate, counterclockwise, a little)

<sub>Appears in:</sub>

- <sub>tutorial adjust-rear-shifting: case wheel-free; when holding: stand, hang, upside_down; before it: bike_in_stand / bike_hung / bike_upside_down</sub>
- <sub>tutorial adjust-rear-shifting: case test-rides; when holding: ground; before it: nothing apart</sub>

## Questions and bike record

### Question: bike.category

<sub>Unit `card:fact:bike.category` · hash `ecfc6db4d28d` · beginner: ⬜ not reviewed</sub>

"What type of bike is it?" / "Was für ein Fahrradtyp ist es?"

Help behind "?": A mountain bike has wide, knobbly tyres and a straight handlebar. A road or gravel bike has narrow tyres and often a curved handlebar. A trekking or city bike is made for everyday rides, often with mudguards, lights and a rack. A cargo bike carries loads in a box or on a long rack. / Ein Mountainbike hat breite, grobstollige Reifen und einen geraden Lenker. Ein Rennrad oder Gravelbike hat schmale Reifen und oft einen gebogenen Lenker. Ein Trekking- oder Stadtrad ist für den Alltag gemacht, oft mit Schutzblechen, Licht und Gepäckträger. Ein Lastenrad trägt Lasten in einer Kiste oder auf einem langen Gepäckträger.

- `mtb`: Mountain bike / Mountainbike
- `road_gravel`: Road or gravel bike / Rennrad oder Gravelbike
- `trekking_city`: Trekking or city bike / Trekking- oder Stadtrad
- `cargo`: Cargo bike / Lastenrad
- I'll check later (unknown)

<sub>Picture set: bike-categories</sub>

### Question: bike.ebike

<sub>Unit `card:fact:bike.ebike` · hash `e34e7bba111c` · beginner: ⬜ not reviewed</sub>

"Is your bike an e-bike?" / "Ist dein Fahrrad ein E-Bike?"

Help behind "?": An e-bike has a battery, usually on the frame or behind the seat post, and a motor at the pedals or in a wheel hub. / Ein E-Bike hat einen Akku, meist am Rahmen oder hinter der Sattelstütze, und einen Motor an den Pedalen oder in einer Radnabe.

- `true`: Yes, it has a motor / Ja, es hat einen Motor
- `false`: No motor / Kein Motor
- I'll check later (unknown)

### Question: drive.gear_type

<sub>Unit `card:fact:drive.gear_type` · hash `ab61288a1506` · beginner: ⬜ not reviewed</sub>

"Which gears does your bike have?" / "Welche Schaltung hat dein Fahrrad?"

Help behind "?": Look at the rear wheel. Chain and derailleur: several sprockets, and below them a part that guides the chain. Hub gear: one sprocket, and a thick hub in the middle of the wheel. Gearbox: one sprocket at the rear, and a box at the pedals. One gear only: one sprocket, and no shifter. / Schau dir das Hinterrad an. Kettenschaltung: mehrere Ritzel und darunter ein Teil, das die Kette führt. Nabenschaltung: ein Ritzel und eine dicke Nabe in der Mitte des Rads. Getriebe: hinten ein Ritzel und ein Kasten an den Pedalen. Nur ein Gang: ein Ritzel und kein Schalthebel.

- `derailleur`: Chain and derailleur / Kettenschaltung
- `hub_gear`: Hub gear / Nabenschaltung
- `gearbox`: Gearbox at the pedals / Getriebe an den Pedalen
- `single_speed`: One gear only / Nur ein Gang
- I'll check later (unknown)

<sub>Picture set: rear-gear-types</sub>

### Question: drive.shifting

<sub>Unit `card:fact:drive.shifting` · hash `4c224dc8fc8d` · beginner: ⬜ not reviewed</sub>

"How is your rear derailleur shifted?" / "Wie wird dein Schaltwerk geschaltet?"

Help behind "?": Follow the shifter on the right of the handlebar to the rear derailleur. A thin cable in a housing means it shifts with a cable. A wire with a plug, or no wire at all, means it shifts electronically. / Folge dem Schalthebel rechts am Lenker bis zum Schaltwerk. Ein dünner Zug in einer Hülle heißt: Es schaltet mit einem Zug. Ein Kabel mit Stecker, oder gar kein Kabel, heißt: Es schaltet elektronisch.

- `mechanical`: With a cable / Mit einem Schaltzug
- `electronic`: Electronically / Elektronisch
- I'll check later (unknown)

<sub>Picture set: shifting-types</sub>

### Bike record: drive.rear_derailleur_screws

<sub>Unit `card:fact:drive.rear_derailleur_screws` · hash `e4467b90b249` · beginner: ⬜ not reviewed</sub>

<sub>Never asked. Comes only from the bike's data. Values as shown on the bike record:</sub>

- `cross`: Cross-head screws
- `hex`: Hex screws

## Run choices

### Run choice: hold_bike

<sub>Unit `card:choice:hold_bike` · hash `a20395db4319` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

"How will you hold the bike while you work?"

- **In a work stand** <sub>`stand`, recommended, needs Bike work stand</sub>
  - The easiest way. The rear wheel turns freely and the bike cannot fall.
  - ⚠ Heavy bikes, such as e-bikes, can be too heavy for a small stand. Check the stand's maximum load.
- **Hanging from a hook or a rope** <sub>`hang`, needs Strong hook or rope that can carry the bike</sub>
  - The rear wheel hangs free, so you can turn the pedals by hand.
  - ⚠ The hook or rope must carry the whole bike. A heavy bike can fall and hurt you.
- **Upside down, on saddle and handlebar** <sub>`upside_down`</sub>
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- **On its wheels, and test with short rides** <sub>`ground`</sub>
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

## Jobs and shop texts

### Adjust the rear gears

<sub>Unit `card:job:adjust-rear-shifting` · hash `a0d8f0f250e0` · beginner: ⬜ not reviewed</sub>

Shop text: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable."

Price: <range> (<source, date>)

Tutorial: `adjust-rear-shifting`

### Clean and oil the chain

<sub>Unit `card:job:chain-care` · hash `fd09479ae0fb` · beginner: ⬜ not reviewed</sub>

Shop text: "The chain is dry, dirty or rusty. Please clean and oil it, and check it for wear."

Price: <range> (<source, date>)

Tutorial: none (shop only)

### Have the rear gears checked

<sub>Unit `card:job:derailleur-check-at-shop` · hash `82b753e49088` · beginner: ⬜ not reviewed</sub>

Shop text: "The rear gears do not work as they should. Please check the rear derailleur, the part that holds it, and the gear cable."

Price: <range> (<source, date>)

Tutorial: none (shop only)

## State labels

### State: bike_in_stand

<sub>Unit `card:state:bike_in_stand` · hash `a87311ed8f9d` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

The bike is clamped in a work stand.

Put back: "Take the bike out of the stand."

### State: bike_hung

<sub>Unit `card:state:bike_hung` · hash `1a0436a1b739` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

The bike hangs from a hook or a rope.

Put back: "Take the bike down."

### State: bike_upside_down

<sub>Unit `card:state:bike_upside_down` · hash `aec4728757ec` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

The bike stands upside down on its saddle and handlebar.

Put back: "Turn the bike back onto its wheels."

## Tools

### Bike work stand

<sub>Unit `card:tool:bike-stand` · hash `77a55a73cbcf` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

Name: "Bike work stand" (tool)
<sub>Step texts may call it: "stand"</sub>

### Strong hook or rope that can carry the bike

<sub>Unit `card:tool:hook-or-rope` · hash `b3f0606029b5` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

Name: "Strong hook or rope that can carry the bike" (tool)
<sub>Step texts may call it: "hook or rope"</sub>

### Soft mat or old blanket

<sub>Unit `card:tool:work-mat` · hash `31eb57c9c5b3` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

Name: "Soft mat or old blanket" (tool)
<sub>Step texts may call it: "mat", "blanket"</sub>
- Instead you can use: Flattened cardboard box

### Small cross-head screwdriver

<sub>Unit `card:tool:small-cross-screwdriver` · hash `9c6cedcfa56d` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

Name: "Small cross-head screwdriver" (tool)
<sub>Step texts may call it: "screwdriver"</sub>
- Instead you can use: Bike multi-tool with a small cross-head bit

### Small hex keys

<sub>Unit `card:tool:small-hex-keys` · hash `29b1356bf29a` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

Name: "Small hex keys" (tool)
<sub>Step texts may call it: "hex key"</sub>
- Instead you can use: Bike multi-tool with small hex keys

## Tool sets (one of these)

### A tool for the small screws on the rear derailleur

<sub>Unit `card:tool-set:derailleur-screw-tool` · hash `5513ce84a7c2` · mechanic: ⬜ not reviewed · beginner: ⬜ not reviewed</sub>

Name: "A tool for the small screws on the rear derailleur" (one of these, depending on your part)

How to tell: "Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key."

- Small cross-head screwdriver <sub>shown alone when drive.rear_derailleur_screws is cross</sub>
- Small hex keys <sub>shown alone when drive.rear_derailleur_screws is hex</sub>
