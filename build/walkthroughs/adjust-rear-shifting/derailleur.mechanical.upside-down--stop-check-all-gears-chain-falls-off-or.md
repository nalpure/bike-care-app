# Adjust the rear gears: derailleur.mechanical.upside-down (stop)

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical.upside-down--stop-check-all-gears-chain-falls-off-or` |
| Tutorial | `adjust-rear-shifting` · case `wheel-free` · difficulty 2 |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing") |
| Run choices | How will you hold the bike while you work? → Upside down, on saddle and handlebar |
| Ends | stop at step 10 (`check-all-gears`: "The chain falls off, or touches the spokes"); user taps "Find a shop" with "bike_upside_down" still set |
| Time | 22 min |
| Tools | Needed: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur<br>Helpful: Torch or phone light; Soft mat or old blanket |

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
- Upside down, on saddle and handlebar ◀ **chosen**
  - Needs no tools. The rear wheel turns freely.
  - ⚠ Turning a heavy bike over can hurt you. Ask someone to help.
- On its wheels, and test with short rides
  - Needs no tools, but takes longer. You adjust while the bike stands and test by riding.

Tools picker. Needed: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur. Helpful: Torch or phone light; Soft mat or old blanket.

## Steps

### 1. `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

Tools: Torch or phone light (helpful)

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → continue
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → **STOP**: Do not ride. The derailleur or the part that holds it may be bent, and it can catch in the spokes. Take the bike to a shop.

### 2. `turn-upside-down` · action · 2 min · from procedure `hold-bike`

Lay a soft mat on the floor and turn the bike over onto its saddle and handlebar. With a heavy bike, ask someone to help.

<sub>3D: focus saddle, handlebar · view whole_bike</sub>

Animation: "Turn the bike over onto the mat" (bike rotate, over, wheels up, half a turn)

Tools: Soft mat or old blanket (helpful)

<sub>State: +bike_upside_down → now: bike_upside_down</sub>

### 3. `shift-to-smallest-sprocket` · action · 1 min

Turn the pedals forward by hand and use the right shifter until the chain sits on the smallest sprocket.

<sub>3D: focus shifter_rear, smallest_sprocket, chain · view drive_side</sub>

Animation: "Shift while the pedals turn" (clip shift-to-smallest)

### 4. `check-high-limit` · check · 3 min

Look from directly behind the bike. Where is the upper pulley wheel of the derailleur, compared with the smallest sprocket?

<sub>3D: focus upper_pulley, smallest_sprocket, h_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **Straight below the sprocket** → The H screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** → Unscrew the screw marked H a quarter turn at a time, until the pulley sits straight below the sprocket.
  - Show solution: "Unscrew the H screw a quarter turn" (clip limit-screw-align)
- [ ] **Further out, away from the spokes** → The chain could fall off the outside. Screw in the screw marked H a quarter turn at a time, until the pulley sits straight below the sprocket.
  - Show solution: "Screw in the H screw a quarter turn" (clip limit-screw-align)

### 5. `shift-to-largest-sprocket` · action · 1 min

Turn the pedals by hand and shift one gear at a time until the chain sits on the largest sprocket. Stop shifting if the chain moves past it towards the spokes.

<sub>3D: focus shifter_rear, largest_sprocket, chain · view drive_side</sub>

Animation: "Shift one gear at a time" (clip shift-to-largest)

### 6. `check-low-limit` · safety check · 3 min

Look from directly behind the bike again. Where is the upper pulley wheel, compared with the largest sprocket?

<sub>3D: focus upper_pulley, largest_sprocket, l_screw · view derailleur_from_behind</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **Straight below the sprocket** → The L screw is set. Nothing to change.
- [ ] **Further in, towards the spokes** → **BLOCK** (Next stays disabled): Do not ride like this: the chain can fall into the spokes. Screw in the screw marked L a quarter turn at a time, until the pulley sits straight below the sprocket.
  - Show solution: "Screw in the L screw a quarter turn" (clip limit-screw-align)
- [ ] **Further out, it does not reach** → The chain cannot reach the largest sprocket. Unscrew the screw marked L a quarter turn at a time, until the pulley sits straight below the sprocket.
  - Show solution: "Unscrew the L screw a quarter turn" (clip limit-screw-align)

### 7. `check-b-gap` · check · 3 min

Keep the chain on the largest sprocket. Look from the side at the gap between the upper pulley wheel and the sprocket.

<sub>3D: focus upper_pulley, largest_sprocket, b_screw · view derailleur_side_close</sub>

Tools: Small cross-head screwdriver or small hex key, whichever fits the small screws on the derailleur; Torch or phone light (helpful)

- [ ] **A small gap, the teeth do not touch** → The gap is fine. The manual for your derailleur gives the exact gap, if you want to check it.
- [ ] **The pulley touches the sprocket, or almost** → Screw in the B screw, at the back of the derailleur, a little at a time until there is a small gap.
  - Show solution: "Screw in the B screw a little" (clip b-gap-adjust)
- [ ] **A big gap, and shifting here was slow** → Unscrew the B screw a little at a time, until the gap is small but the teeth do not touch.
  - Show solution: "Unscrew the B screw a little" (clip b-gap-adjust)

### 8. `find-barrel-adjuster` · action · 1 min

Find the barrel adjuster: a small ribbed knob where the gear cable enters the derailleur, or where it leaves the right shifter.

<sub>3D: focus barrel_adjuster, shift_cable · view barrel_adjuster_close</sub>

### 9. `check-cable-tension` · check · 5 min

Turn the pedals by hand and shift one gear at a time, up through all gears and back. Watch the chain.

<sub>3D: focus barrel_adjuster, chain, cassette · view drive_side</sub>

- [ ] **Slow or noisy going to bigger sprockets** → The cable is too loose. Unscrew the barrel adjuster a quarter turn, then shift again.
  - Show solution: "Unscrew the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Slow or noisy going to smaller sprockets** → The cable is too tight. Screw in the barrel adjuster a quarter turn, then shift again.
  - Show solution: "Screw in the barrel adjuster a quarter turn" (clip cable-tension-shift)
- [ ] **Every shift is quick and quiet** → The cable tension is right.

### 10. `check-all-gears` · safety check · 2 min

Turn the pedals and shift through every gear, from the smallest sprocket to the largest and back. Watch and listen.

> _Only when drive.rear_speeds is known:_ Your bike has {drive.rear_speeds} gears at the rear.

<sub>3D: focus cassette, chain, rear_derailleur · view drive_side</sub>

- [ ] **Every gear runs quietly** → Your rear gears are set.
- [ ] **It rattles or jumps in some gears** → Turn the barrel adjuster a quarter turn, as in the earlier step, and shift through again. If it does not get better, a shop can check the cable.
- [ ] **The chain falls off, or touches the spokes** → **STOP**: Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop. · jump: `release-bike` ◀ **this path**

**Stop screen** (the progress bar does not move): "Do not ride: the chain can catch in the spokes and lock the wheel. Put the bike back on its wheels and take it to a shop."

Buttons: [Show me how to put it back] [Find a shop]

## End

Shop summary, shown to hand over at the shop:

- Job: Adjust the rear gears
- Tell the mechanic: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable."
- Found: "The chain falls off, or touches the spokes" at `check-all-gears`
- Already done: steps 1 to 10 of this tutorial
- Price: no estimate yet
- **Still set: bike_upside_down**
