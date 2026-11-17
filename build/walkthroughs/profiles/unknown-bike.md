# Profile: Unknown bike

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

Nothing is stored about this bike. The owner can answer the picture questions. No tools.

| | |
| --- | --- |
| Known before the first flow | nothing known |
| Answers when asked | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing") |
| Tools with them | none |

## Journey 1: Slow shifting, adjusted between short test rides

<sub>journey id `test-rides`</sub>

### Symptom: "My gears don't shift cleanly"

Questions the app asks first:

1. "Look at the rear wheel. Which picture looks like your bike?" → Several sprockets, and a part below them that guides the chain
2. "Follow the shifter on the right of the handlebar. What connects it to the rear gears?" → A thin cable in a housing

#### Checks

##### 1. `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride)

##### 2. `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → next check ◀ **this path**
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. → result: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. → result: **Clean and oil the chain** (soon)

##### 3. `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when pedalling gets lighter** — The chain is slow to climb to the bigger sprockets. → result: **Adjust the rear gears** (soon) ◀ **this path**
- [ ] **Slow or rattling when pedalling gets harder** — The chain is slow to drop to the smaller sprockets. → result: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → next check

Finding stored on the bike: `shift-test-ride` = slow-to-bigger.

### Job screen: Adjust the rear gears · soon

- **Do it myself**: tutorial `adjust-rear-shifting`, 26 to 29 min for this bike, difficulty 2
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

Tools picker. Needed: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur. Helpful: Torch or phone light. (✓ = the owner has it)

Time shown for this bike: 26 to 29 min (depends on how the bike is held).

#### Steps

##### 1. `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

Tools: Torch or phone light (helpful)

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → continue ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → **STOP**: Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop.

##### 2. `park-bike` · action · 1 min

Put the bike on its kickstand, or lean it against a wall at the saddle and rear wheel, with the gears facing you. Never lean it on the handlebar: it can turn, and the bike falls.

<sub>3D: focus kickstand, rear_wheel · view whole_bike</sub>

##### 3. `check-low-limit-by-hand` · safety check · 3 min

Push the rear derailleur by hand towards the spokes, as far as it goes. Look from behind: where does the upper pulley wheel stop?

<sub>3D: focus rear_derailleur, upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Animation: "Push the derailleur in by hand" (rear_derailleur push, towards the spokes, as far as it goes)

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur

- [ ] **Straight below the largest sprocket** → The L screw is set. Let go of the derailleur. ◀ **this path**
- [ ] **Past the largest sprocket, towards the spokes** → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. Screw in the screw marked L a quarter turn, then push and look again.
  - Show solution: "Screw in the L screw a quarter turn" (l_screw rotate, screw in, a quarter turn)
- [ ] **It stops before the largest sprocket** → The chain may not reach the largest sprocket. Unscrew the screw marked L a quarter turn, then push and look again.
  - Show solution: "Unscrew the L screw a quarter turn" (l_screw rotate, unscrew, a quarter turn)

##### 4. `ride-to-smallest-sprocket` · action · 2 min

Ride slowly on a quiet path and shift into the hardest gear, the smallest sprocket. Stop, and park the bike as before.

<sub>3D: focus shifter_rear, smallest_sprocket · view drive_side</sub>

##### 5. `check-high-limit` · check · 3 min

Look from directly behind the bike. Where is the upper pulley wheel of the derailleur, compared with the smallest sprocket?

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **Straight below the sprocket** → The H screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** → Unscrew the screw marked H a quarter turn at a time, until the pulley sits straight below the sprocket.
  - Show solution: "Unscrew the H screw a quarter turn" (clip limit-screw-align)
- [ ] **Further out, away from the spokes** → The chain could fall off the outside. Screw in the screw marked H a quarter turn at a time, until the pulley sits straight below the sprocket.
  - Show solution: "Screw in the H screw a quarter turn" (clip limit-screw-align)

##### 6. `ride-to-largest-sprocket` · action · 2 min

Ride slowly and shift one gear at a time into the easiest gear, the largest sprocket. Stop, and park the bike as before.

<sub>3D: focus shifter_rear, largest_sprocket · view drive_side</sub>

##### 7. `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side at the gap between the upper pulley wheel and the sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **A small gap, the teeth do not touch** → The gap is fine. The manual for your derailleur gives the exact gap, if you want to check it.
- [ ] **The pulley touches the sprocket, or almost** → Screw in the B screw, at the back of the derailleur, a little at a time until there is a small gap.
  - Show solution: "Screw in the B screw a little" (clip b-gap-adjust)
- [ ] **A big gap, and shifting here was slow** → Unscrew the B screw a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Unscrew the B screw a little" (clip b-gap-adjust)

##### 8. `find-barrel-adjuster` · action · 1 min

Find the barrel adjuster: a small ribbed knob where the gear cable enters the derailleur, or where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

##### 9. `check-cable-tension-riding` · check · 10 min

Ride slowly and shift one gear at a time, up through all gears and back. Stop before you change anything.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy going to easier gears** → The cable is too loose. Park the bike, unscrew the barrel adjuster a quarter turn, then ride and shift again.
  - Show solution: "Unscrew the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Slow or noisy going to harder gears** → The cable is too tight. Park the bike, screw in the barrel adjuster a quarter turn, then ride and shift again.
  - Show solution: "Screw in the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Every shift is quick and quiet** → The cable tension is right.

##### 10. `check-all-gears-riding` · safety check · 3 min

Ride once more and shift through every gear, from the hardest to the easiest and back. Watch and listen.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** → Your rear gears are set. ◀ **this path**
- [ ] **It rattles or jumps in some gears** → Park the bike, turn the barrel adjuster a quarter turn as in the earlier step, and ride again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** → **STOP**: Stop riding: the chain can catch in the spokes and lock the wheel. Push the bike to a shop.

#### End

Done. Nothing is left apart.

**Journey ends:** tutorial complete. **Time:** 34 min. **Questions asked:** 2.

---
