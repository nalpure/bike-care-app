# Adjust the rear gears: derailleur.mechanical.ground

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical.ground` |
| Tutorial | `adjust-rear-shifting` · case `test-rides` · difficulty 2 |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) |
| Run choices | How will you hold the bike while you work? → On its wheels, and test with short rides |
| Ends | Complete: all steps and the finish |
| Time | 29 min |
| Tools | Needed: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur<br>Helpful: Torch or phone light |

## Before you start

1. Question, skipped when already known: "Look at the rear wheel. Which picture looks like your bike?" → Several sprockets, and a part below them that guides the chain
2. Question, skipped when already known: "Follow the shifter on the right of the handlebar. What connects it to the rear gears?" → A thin cable in a housing

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

Tools picker. Needed: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur. Helpful: Torch or phone light.

## Steps

### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

<sub>Not shown again if this session already answered it, for example in the diagnosis. The earlier answer decides the outcome.</sub>

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

Tools: Torch or phone light (helpful)

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → continue
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → **EXIT, unsafe**: Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop.

### 2. Find the barrel adjuster · `barrel-adjuster-present` · inspection · 1 min

<sub>Not shown again if this session already answered it, for example in the diagnosis. The earlier answer decides the outcome.</sub>

Find the barrel adjuster: a small ribbed knob on the gear cable. Look where the cable enters the derailleur, then where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

Tools: Torch or phone light (helpful)

- [ ] **It is at the derailleur** — The cable tension can be set at the derailleur. → continue
- [ ] **It is at the shifter, or on the cable** — The cable tension can be set there. It works the same way. → continue
- [ ] **I cannot find one** — This bike may have no barrel adjuster. → **EXIT, not covered**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you.

### 3. Park the bike · `park-bike` · action · 1 min

Put the bike on its kickstand, or lean it against a wall at the saddle and rear wheel, with the gears facing you. Never lean it on the handlebar: it can turn, and the bike falls.

<sub>3D: focus kickstand, rear_wheel · view whole_bike</sub>

### 4. Check the inner limit (L screw) · `check-low-limit-by-hand` · safety check · 3 min

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: where does the upper of its two small toothed wheels stop?

<sub>3D: focus rear_derailleur, upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards the spokes, as far as it goes)

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **In line with the largest sprocket** <sub>`in-line`</sub> → The L screw is set. Let go of the derailleur.
- [ ] **Past the largest sprocket, towards the spokes** <sub>`too-far-in`</sub> → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. Screw in the screw marked L a quarter turn, then push and look again.
  - Show solution: "Screw in the L screw a quarter turn" (l_screw rotate, screw in, a quarter turn)
- [ ] **It stops before the largest sprocket** <sub>`short`</sub> → The chain may not reach the largest sprocket. Unscrew the screw marked L a quarter turn, then push and look again.
  - Show solution: "Unscrew the L screw a quarter turn" (l_screw rotate, unscrew, a quarter turn)

### 5. Ride into the hardest gear · `ride-to-smallest-sprocket` · action · 2 min

Ride slowly on a quiet path and shift into the hardest gear, the smallest sprocket. Stop, and park the bike as before.

<sub>3D: focus shifter_rear, smallest_sprocket · view drive_side</sub>

### 6. Check the outer limit (H screw) · `check-high-limit` · safety check · 3 min

Look from directly behind the bike at the upper of the two small toothed wheels on the derailleur. Where is it, compared with the smallest sprocket?

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **In line with the smallest sprocket** <sub>`in-line`</sub> → The H screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** <sub>`too-far-in`</sub> → Unscrew the screw marked H a quarter turn at a time, until the wheel is in line with the sprocket. If it does not move, stop turning: the cable holds it, and a later step sets the cable.
  - Show solution: "Unscrew the H screw a quarter turn" (clip limit-screw-align)
- [ ] **Further out, away from the spokes** <sub>`too-far-out`</sub> → **BLOCK** (Next stays disabled): The chain could fall off the outside and jam. Screw in the screw marked H a quarter turn at a time, until the wheel is in line with the sprocket.
  - Show solution: "Screw in the H screw a quarter turn" (clip limit-screw-align)

### 7. Ride into the easiest gear · `ride-to-largest-sprocket` · action · 2 min

Ride slowly and shift one gear at a time into the easiest gear, the largest sprocket. Stop, and park the bike as before.

<sub>3D: focus shifter_rear, largest_sprocket · view drive_side</sub>

### 8. Check the gap to the sprockets · `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side at the gap between the upper toothed wheel of the derailleur and the sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **A small gap, the teeth do not touch** <sub>`small-gap`</sub> → The gap is fine. The manual for your derailleur gives the exact gap, if you want to check it.
- [ ] **The wheel touches the sprocket, or almost** <sub>`touching`</sub> → Screw in the B screw, at the back of the derailleur, a little at a time until there is a small gap.
  - Show solution: "Screw in the B screw a little" (clip b-gap-adjust)
- [ ] **A big gap, and shifting here was slow** <sub>`wide-gap`</sub> → Unscrew the B screw a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Unscrew the B screw a little" (clip b-gap-adjust)

### 9. Set the cable tension on short rides · `check-cable-tension-riding` · check · 10 min

Ride slowly and shift one gear at a time, through all gears and back. Stop and park the bike before you turn anything.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy shifting to easier gears** <sub>`slow-easier`</sub> → The cable is too loose. Park the bike, unscrew the barrel adjuster a quarter turn, then ride and shift again. Never unscrew it all the way out.
  - Show solution: "Unscrew the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Slow or noisy shifting to harder gears** <sub>`slow-harder`</sub> → The cable is too tight. Park the bike, screw in the barrel adjuster a quarter turn, then ride and shift again. If four turns do not help, a shop can check the cable.
  - Show solution: "Screw in the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Every shift is quick and quiet** <sub>`smooth`</sub> → The cable tension is right.

### 10. Test every gear on a ride · `check-all-gears-riding` · safety check · 3 min

Ride once more and shift through every gear, from the hardest to the easiest and back. Watch and listen.

> _Only when drive.rear_speeds is known:_ Your bike has {drive.rear_speeds} gears at the rear.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** <sub>`quiet`</sub> → Your rear gears are set.
- [ ] **It rattles or jumps in some gears** <sub>`rattles`</sub> → Park the bike, go back to the cable step and adjust as it says, then ride again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** <sub>`chain-off`</sub> → **EXIT, unsafe**: Stop riding: the chain can catch in the spokes and lock the wheel. Push the bike to a shop.

## End

The tutorial is done. Nothing is left apart. Total: 29 min.
