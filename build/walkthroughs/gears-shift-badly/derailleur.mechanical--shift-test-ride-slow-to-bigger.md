# Diagnosis "My gears don't shift cleanly": `shift-test-ride`: slow-to-bigger

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical--shift-test-ride-slow-to-bigger` |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) |
| Ends | Job `adjust-rear-shifting` (soon) |
| Time | 5 min |

## Before you start

1. Question, skipped when already known: "Look at the rear wheel. Which picture looks like your bike?" → Several sprockets, and a part below them that guides the chain
2. Question, skipped when already known: "Follow the shifter on the right of the handlebar. What connects it to the rear gears?" → A thin cable in a housing

## Checks

The first state that leads to a job ends the diagnosis.

### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride)

### 2. Look at the chain · `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → next check ◀ **this path**
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)

### 3. Test ride the gears · `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when shifting to easier gears** — The chain is slow to climb to the bigger sprockets, the easier gears. → result: **Adjust the rear gears** (soon) ◀ **this path**
- [ ] **Slow or rattling when shifting to harder gears** — The chain is slow to drop to the smaller sprockets, the harder gears. → result: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → next check

## Job screen: Adjust the rear gears · soon

- **Do it myself**: tutorial `adjust-rear-shifting`, 26 to 29 min for this bike, difficulty 2
- **Take it to a shop**: "The rear gears shift slowly or noisily. Please adjust the rear derailleur and check the gear cable." Price: no estimate yet.
