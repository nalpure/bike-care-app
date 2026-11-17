# Adjust the rear gears: derailleur.mechanical.hang (stop)

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical.hang--stop-shift-test-ride-slow-to-bigger` |
| Tutorial | `adjust-rear-shifting` · case `wheel-free` · difficulty 2 |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) |
| Run choices | How will you hold the bike while you work? → Hanging from a hook or a rope |
| Ends | stop at step 12 (`shift-test-ride`: "Slow or rattling when shifting to easier gears"); nothing apart, ends with "Find a shop" |
| Time | 27 min |
| Tools | Needed: Strong hook or rope that can carry the bike; Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur<br>Helpful: Torch or phone light |

## Before you start

1. Question, skipped when already known: "Look at the rear wheel. Which picture looks like your bike?" → Several sprockets, and a part below them that guides the chain
2. Question, skipped when already known: "Follow the shifter on the right of the handlebar. What connects it to the rear gears?" → A thin cable in a housing

**How will you hold the bike while you work?**

- In a work stand (recommended; needs: Bike work stand)
  - The easiest way. The rear wheel turns freely and the bike cannot fall.
  - ⚠ Heavy bikes, such as e-bikes, can be too heavy for a small stand. Check the stand's maximum load.
- Hanging from a hook or a rope (needs: Strong hook or rope that can carry the bike) ◀ **chosen**
  - The rear wheel hangs free, so you can turn the pedals by hand.
  - ⚠ The hook or rope must carry the whole bike. A heavy bike can fall and hurt you.
- Upside down, on saddle and handlebar
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- On its wheels, and test with short rides
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

Tools picker. Needed: Strong hook or rope that can carry the bike; Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur. Helpful: Torch or phone light.

## Steps

### 1. `derailleur-alignment` · inspection · 1 min

<sub>Not shown again if this session already answered it, for example in the diagnosis. The earlier answer decides the outcome.</sub>

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

Tools: Torch or phone light (helpful)

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → continue
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → **STOP**: Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop.

### 2. `barrel-adjuster-present` · inspection · 1 min

<sub>Not shown again if this session already answered it, for example in the diagnosis. The earlier answer decides the outcome.</sub>

Find the barrel adjuster: a small ribbed knob on the gear cable. Look where the cable enters the derailleur, then where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

Tools: Torch or phone light (helpful)

- [ ] **It is at the derailleur** — The cable tension can be set at the derailleur. → continue
- [ ] **It is at the shifter, or on the cable** — The cable tension can be set there. It works the same way. → continue
- [ ] **I cannot find one** — This bike may have no barrel adjuster. → **STOP**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you.

### 3. `hang-bike` · action · 3 min · from procedure `hold-bike`

Hang the bike by the front of its saddle from the hook or rope, so the rear wheel is off the ground. Check that it hangs firmly before you let go.

<sub>3D: focus saddle, rear_wheel · view whole_bike</sub>

Animation: "Lift the rear of the bike onto the hook" (bike pull, up at the saddle, until the rear wheel is off the ground)

Tools: Strong hook or rope that can carry the bike

<sub>State: +bike_hung → now: bike_hung</sub>

### 4. `check-low-limit-by-hand` · safety check · 3 min

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: where does the upper of its two small toothed wheels stop?

<sub>3D: focus rear_derailleur, upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards the spokes, as far as it goes)

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **In line with the largest sprocket** → The L screw is set. Let go of the derailleur.
- [ ] **Past the largest sprocket, towards the spokes** → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. Screw in the screw marked L a quarter turn, then push and look again.
  - Show solution: "Screw in the L screw a quarter turn" (l_screw rotate, screw in, a quarter turn)
- [ ] **It stops before the largest sprocket** → The chain may not reach the largest sprocket. Unscrew the screw marked L a quarter turn, then push and look again.
  - Show solution: "Unscrew the L screw a quarter turn" (l_screw rotate, unscrew, a quarter turn)

### 5. `shift-to-smallest-sprocket` · action · 1 min

Turn the pedals forward by hand and use the right shifter until the chain sits on the smallest sprocket, the hardest gear.

<sub>3D: focus shifter_rear, smallest_sprocket, chain · view drive_side</sub>

Animation: "Shift while the pedals turn" (clip shift-to-smallest)

### 6. `check-high-limit` · safety check · 3 min

Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur. Where is it, compared with the smallest sprocket?

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **In line with the smallest sprocket** → The H screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** → Unscrew the screw marked H a quarter turn at a time, until the wheel is in line with the sprocket. If it does not move, stop turning: the cable holds it, and a later step sets the cable.
  - Show solution: "Unscrew the H screw a quarter turn" (clip limit-screw-align)
- [ ] **Further out, away from the spokes** → **BLOCK** (Next stays disabled): The chain could fall off the outside and jam. Screw in the screw marked H a quarter turn at a time, until the wheel is in line with the sprocket.
  - Show solution: "Screw in the H screw a quarter turn" (clip limit-screw-align)

### 7. `shift-to-largest-sprocket` · action · 1 min

Turn the pedals slowly by hand and shift one gear at a time until the chain sits on the largest sprocket, the easiest gear.

<sub>3D: focus shifter_rear, largest_sprocket, chain · view drive_side</sub>

Animation: "Shift one gear at a time" (clip shift-to-largest)

### 8. `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side at the gap between the upper toothed wheel of the derailleur and the sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **A small gap, the teeth do not touch** → The gap is fine. The manual for your derailleur gives the exact gap, if you want to check it.
- [ ] **The wheel touches the sprocket, or almost** → Screw in the B screw, at the back of the derailleur, a little at a time until there is a small gap.
  - Show solution: "Screw in the B screw a little" (clip b-gap-adjust)
- [ ] **A big gap, and shifting here was slow** → Unscrew the B screw a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Unscrew the B screw a little" (clip b-gap-adjust)

### 9. `check-cable-tension` · check · 5 min

Turn the pedals by hand and shift one gear at a time, through all gears and back. Watch the chain.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy shifting to easier gears** → The cable is too loose. Unscrew the barrel adjuster a quarter turn, then shift again. Never unscrew it all the way out.
  - Show solution: "Unscrew the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Slow or noisy shifting to harder gears** → The cable is too tight. Screw in the barrel adjuster a quarter turn, then shift again. If four turns do not help, a shop can check the cable.
  - Show solution: "Screw in the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Every shift is quick and quiet** → The cable tension is right.

### 10. `check-all-gears` · safety check · 2 min

Turn the pedals and shift through every gear, from the hardest to the easiest and back. Watch and listen.

> _Only when drive.rear_speeds is known:_ Your bike has {drive.rear_speeds} gears at the rear.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** → Your rear gears are set.
- [ ] **It rattles or jumps in some gears** → Go back to the cable step and adjust as it says, then shift through again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** → **STOP**: Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop. · jump: `release-bike`

### 11. `take-bike-down` · action · 1 min · from procedure `release-bike`

Hold the bike, lift it off the hook or rope and put the rear wheel on the ground.

<sub>3D: focus saddle, rear_wheel · view whole_bike</sub>

Animation: "Lift the bike off and set it down" (bike push, down, until the rear wheel is on the ground)

Tools: Strong hook or rope that can carry the bike

<sub>State: −bike_hung → now: nothing apart</sub>

#### Finish (good path only)

### 12. `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → **STOP**: Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it. ◀ **this path**
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → **STOP**: Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it.
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → continue

**Stop screen** (the progress bar does not move): "Your gears still do not shift cleanly. You can ride carefully, but the cable may be worn or dirty. A shop can check it."

Buttons: [Find a shop]

## End

Shop summary, shown to hand over at the shop:

- Job: Adjust the rear gears
- Tell the mechanic: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable."
- Found: "Slow or rattling when shifting to easier gears" at `shift-test-ride`
- Already done: steps 1 to 12 of this tutorial
- Price: no estimate yet
