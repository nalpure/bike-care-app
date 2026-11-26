# Profile: Unknown bike

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

Nothing is stored about this bike. The owner can answer the picture questions. No tools.

| | |
| --- | --- |
| Known before the first flow | nothing known |
| Answers when asked | `drive.gear_type` = derailleur ("Chain and derailleur")<br>`drive.shifting` = mechanical ("With a cable") |
| Tools with them | none |

## Journey 1: Slow shifting, adjusted between short test rides

<sub>journey id `test-rides`</sub>

### Symptom: "My gears don't shift cleanly"

Questions the app asks first:

1. "Which gears does your bike have?" → Chain and derailleur
2. "How is your rear derailleur shifted?" → With a cable

#### Checks

##### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus derailleur_hanger · show rear_derailleur, cassette, rear_end · view hanger_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride)

##### 2. Look at the chain · `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → next check ◀ **this path**
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)

##### 3. Test ride the gears · `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down. Every gear should change quickly and run quietly.

<sub>3D: focus chain · show frame, fork, front_wheel, rear_wheel, handlebar, brake_lever, shifter_rear, saddle, seat_post, shift_cable, drivetrain · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → result: **Adjust the rear gears** (soon) ◀ **this path**
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → result: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → next check

Finding stored on the bike: `shift-test-ride` = slow-to-bigger.

### Job screen: Adjust the rear gears · soon

- **Do it myself**: tutorial `adjust-rear-shifting`, 27 to 32 min for this bike, difficulty 2
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
- Upside down, on saddle and handlebar
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- On its wheels, and test with short rides ◀ **chosen**
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

Tools picker. Needed: none. One of these, depending on your part: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.). Helpful: none. (✓ = the owner has it)

Time shown for this bike: 27 to 32 min (depends on how the bike is held).

#### Steps

##### – Look at the rear derailleur · `derailleur-alignment` · not shown again: answered earlier in this session ("It hangs straight down, in line with the sprockets")

##### 1. Find the barrel adjuster · `barrel-adjuster-present` · inspection · 1 min

Find the barrel adjuster: a small ribbed knob where the gear cable goes in. Look at the rear derailleur, then where the gear cable leaves the right shifter. If there is one at both, pick either.

<sub>3D: focus barrel_adjuster · show frame, fork, front_wheel, rear_wheel, handlebar, brake_lever, shifter_rear, shift_cable, saddle, seat_post, drivetrain · view barrel_adjuster_close</sub>

Animation: "A small ribbed knob you can turn by hand, where the gear cable goes in. Often at the rear derailleur or where the cable leaves the right shifter. On drop bars it can sit in the cable near the handlebar." (clip barrel-tour)

**Where is it?** <sub>A tap on an answer that goes on moves to the next card at once.</sub>

- [ ] **At the derailleur** — The cable tension can be set at the derailleur. → continue · learned for the bike (kept if the user agrees; then this card is not shown again): Barrel adjuster = At the derailleur
- [ ] **At the shifter** — The cable tension can be set at the shifter. It works the same way. → continue · learned for the bike (kept if the user agrees; then this card is not shown again): Barrel adjuster = At the shifter
- [ ] **I cannot find it** — Look along the cable next. → next card: "Look along the cable" (`barrel-adjuster-search`), shown only after this answer ◀ **this path**

##### 2. Look along the cable · `barrel-adjuster-search` · inspection · 1 min

Follow the gear cable from the right shifter to the rear derailleur. On some bikes the barrel adjuster sits in the cable itself: a small ribbed knob, often near the handlebar.

<sub>3D: focus shift_cable, front_barrel · show frame, fork, front_wheel, rear_wheel, handlebar, brake_lever, shifter_rear, drivetrain · view drive_side</sub>
<sub>Shown only after the answer "I cannot find it" to `barrel-adjuster-present`.</sub>


**Found it?** <sub>A tap on an answer that goes on moves to the next card at once.</sub>

- [ ] **It is on the cable** — The cable tension can be set there. It works the same way. → continue · learned for the bike (kept if the user agrees; then this card is not shown again): Barrel adjuster = On the cable ◀ **this path**
- [ ] **I still cannot find it** — This bike may have no barrel adjuster. → **EXIT, not covered**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you.

Learned for the bike: `drive.barrel_adjuster` = inline.

##### 3. Park the bike · `park-bike` · action · 1 min

Put the bike on its kickstand, or lean it against a wall at the saddle and rear wheel, with the gears facing you. Never lean it on the handlebar: it can turn, and the bike falls.

<sub>3D: focus kickstand, rear_wheel · view whole_bike</sub>

##### 4. Ride into the hardest gear · `ride-to-smallest-sprocket` · action · 2 min

Ride slowly on a quiet path and shift into the hardest gear, the smallest sprocket. Listen to the chain, then stop and park the bike as before.

<sub>3D: focus shifter_rear, smallest_sprocket · show frame, fork, front_wheel, rear_wheel, handlebar, saddle, seat_post, shift_cable, drivetrain · view drive_side</sub>

##### 5. Set the outer limit (H screw) · `check-high-limit` · check · 3 min

The chain is on the smallest sprocket. Look from directly behind the bike: the upper of the two small toothed wheels on the derailleur should be in line with the smallest sprocket.

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · show rear_derailleur, derailleur_hanger, cassette, chain, chainring · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

**Not in line?**

- [ ] **Further out, away from the spokes** <sub>`too-far-out`</sub> → The chain can fall off the outside and jam. With the screwdriver or hex key, turn the screw marked H clockwise a quarter turn at a time, until the toothed wheel is in line.
  - Plays at once: "Turn the H screw clockwise a quarter turn" (h_screw rotate, clockwise, a quarter turn)
- [ ] **Further in, towards the spokes** <sub>`too-far-in`</sub> → The chain rattles or jumps to a bigger sprocket. With the screwdriver or hex key, turn the screw marked H counterclockwise a quarter turn at a time, until the toothed wheel is in line. If it does not move, stop turning: the cable holds it, and a later step sets the cable.
  - Plays at once: "Turn the H screw counterclockwise a quarter turn" (h_screw rotate, counterclockwise, a quarter turn)
- [ ] **Next** (no answer) → the goal in the text is met ◀ **this path**

##### 6. Ride into the easiest gear · `ride-to-largest-sprocket` · action · 2 min

Ride slowly and shift one gear at a time into the easiest gear, the largest sprocket, then stop and park the bike as before. If the chain moves past it towards the spokes, stop pedalling at once.

<sub>3D: focus shifter_rear, largest_sprocket · show frame, fork, front_wheel, rear_wheel, handlebar, saddle, seat_post, shift_cable, drivetrain · view drive_side</sub>

##### 7. Set the inner limit (L screw) · `check-low-limit` · check · 3 min

The chain is on the largest sprocket. Look from directly behind the bike: the upper of the two small toothed wheels on the derailleur should be in line with the largest sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, l_screw · show rear_derailleur, derailleur_hanger, cassette, chain, chainring · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

**Not in line?**

- [ ] **Further in, towards the spokes** <sub>`too-far-in`</sub> → The chain can fall into the spokes. With the screwdriver or hex key, turn the screw marked L clockwise a quarter turn at a time, until the toothed wheel is in line.
  - Plays at once: "Turn the L screw clockwise a quarter turn" (l_screw rotate, clockwise, a quarter turn)
- [ ] **Further out, away from the spokes** <sub>`too-far-out`</sub> → The chain rattles or slips off the largest sprocket. With the screwdriver or hex key, turn the screw marked L counterclockwise a quarter turn at a time, until the toothed wheel is in line. ◀ **this path**
  - Plays at once: "Turn the L screw counterclockwise a quarter turn" (l_screw rotate, counterclockwise, a quarter turn)
- [ ] **Next** (no answer) → the goal in the text is met

##### 8. Double-check the inner limit · `check-low-limit-by-hand` · safety check · 2 min

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: the upper toothed wheel should stay in line with the largest sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, l_screw · show rear_derailleur, derailleur_hanger, cassette, chain, chainring · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards_spokes, as far as it goes)

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

**Does it go further in?**

- [ ] **Past the largest sprocket, towards the spokes** <sub>`too-far-in`</sub> → **UNSAFE until fixed**: Do not ride like this: the chain can fall into the spokes. With the screwdriver or hex key, turn the screw marked L clockwise a quarter turn, then push and look again. Next means it is fixed now
  - Plays at once: "Turn the L screw clockwise a quarter turn" (l_screw rotate, clockwise, a quarter turn)
- [ ] **Next** (no answer) → the goal in the text is met ◀ **this path**

##### 9. Check the gap to the sprockets · `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side: the gap between the upper toothed wheel of the derailleur and the sprocket should be small, and the teeth should not touch.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · show rear_derailleur, derailleur_hanger, cassette, chain · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or Small hex keys (Look at the small screws on the back of the rear derailleur. A cross in the screw head needs the screwdriver. A six-sided hole needs a hex key.)

**Wrong gap?**

- [ ] **The wheel touches the sprocket, or almost** <sub>`touching`</sub> → With the screwdriver or hex key, turn the B screw at the back of the derailleur clockwise, a little at a time, until there is a small gap.
  - Plays at once: "Turn the B screw clockwise a little" (b_screw rotate, clockwise, a little)
- [ ] **A big gap, and shifting here was slow** <sub>`wide-gap`</sub> → With the screwdriver or hex key, turn the B screw counterclockwise, a little at a time, until the gap is small but the teeth do not touch.
  - Plays at once: "Turn the B screw counterclockwise a little" (b_screw rotate, counterclockwise, a little)
- [ ] **Next** (no answer) → the goal in the text is met ◀ **this path**

##### 10. Set the cable tension on short rides · `check-cable-tension-riding` · check · 10 min

Ride slowly and shift one gear at a time, through all gears and back: every shift should be quick and quiet. Stop and park the bike before you turn anything.

<sub>3D: focus chain · show drivetrain · view drive_side</sub>

**Slow or noisy?**

- [ ] **Slow or noisy shifting to easier gears** <sub>`slow-easier`</sub> → The cable is too loose. Park the bike. Look at the barrel adjuster from the side where the cable goes in, turn it counterclockwise a quarter turn, then ride and shift again. Never turn it all the way out.
  - Plays at once: "Turn the barrel adjuster counterclockwise a quarter turn" (barrel_adjuster rotate, counterclockwise, a quarter turn)
- [ ] **Slow or noisy shifting to harder gears** <sub>`slow-harder`</sub> → The cable is too tight. Park the bike. Look at the barrel adjuster from the side where the cable goes in, turn it clockwise a quarter turn, then ride and shift again. If four turns do not help, a shop can check the cable.
  - Plays at once: "Turn the barrel adjuster clockwise a quarter turn" (barrel_adjuster rotate, clockwise, a quarter turn)
- [ ] **Next** (no answer) → the goal in the text is met ◀ **this path**

##### Finish

##### 11. Test ride the gears · `test-ride-gears` · safety check · 3 min

Ride slowly on a quiet, flat path and shift one gear at a time, from the hardest to the easiest gear and back. Every gear should change quickly and run quietly, and the chain should stay on the sprockets.

<sub>3D: focus chain · show frame, fork, front_wheel, rear_wheel, handlebar, saddle, seat_post, shift_cable, drivetrain · view drive_side</sub>

Animation: "Shift one gear at a time while you ride" (clip shift-test-ride)

**Something wrong?**

- [ ] **It shifts slowly or rattles in some gears** <sub>`rattles`</sub> → **EXIT, shop only**: Your gears still do not shift cleanly. You can ride carefully, but take the bike to a shop soon. Most often the gear cable is the cause: the inner cable can be dirty, rusty or frayed, and its outer cover can be worn or kinked. The derailleur, or the hanger that holds it, can also be bent so little that you cannot see it. Other parts can cause this too. A shop can find the cause.
- [ ] **The chain jumps or falls off** <sub>`chain-off`</sub> → **EXIT, unsafe**: Stop riding: a chain that jumps can make you fall, and a chain that falls inwards can catch in the spokes and lock the wheel. Push the bike to a shop. Often the derailleur, or the hanger that holds it, is bent so little that you cannot see it. A worn chain or worn sprockets can also make the chain jump.
- [ ] **Next** (no answer) → the goal in the text is met ◀ **this path**

#### End

Done. Nothing is left apart. Tutorial time: 31 min.

**Journey ends:** tutorial complete. **Time:** 36 min. **Questions asked:** 2.

---
