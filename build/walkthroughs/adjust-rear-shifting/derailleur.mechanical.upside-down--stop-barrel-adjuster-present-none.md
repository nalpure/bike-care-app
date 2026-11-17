# Adjust the rear gears: derailleur.mechanical.upside-down (stop)

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical.upside-down--stop-barrel-adjuster-present-none` |
| Tutorial | `adjust-rear-shifting` · case `wheel-free` · difficulty 2 |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) |
| Run choices | How will you hold the bike while you work? → Upside down, on saddle and handlebar |
| Ends | stop at step 2 (`barrel-adjuster-present`: "I cannot find one"); nothing apart, ends with "Find a shop" |
| Time | 2 min |
| Tools | Needed: none<br>Helpful: Torch or phone light |

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

Tools picker. Needed: none. Helpful: Torch or phone light.

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
- [ ] **I cannot find one** — This bike may have no barrel adjuster. → **STOP**: Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you. ◀ **this path**

**Stop screen** (the progress bar does not move): "Bikes without a barrel adjuster are not supported yet. A shop can set the gear cable for you."

Buttons: [Find a shop]

## End

Shop summary, shown to hand over at the shop:

- Job: Adjust the rear gears
- Tell the mechanic: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable."
- Found: "I cannot find one" at `barrel-adjuster-present`
- Already done: steps 1 to 2 of this tutorial
- Price: no estimate yet
