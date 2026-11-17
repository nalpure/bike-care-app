# Diagnosis "My gears don't shift cleanly": no check found a cause

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical--no-hit` |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing") |
| Ends | Job `derailleur-check-at-shop` |
| Time | 5 min |

## Before you start

1. Question, skipped when already known: "Look at the rear wheel. Which picture looks like your bike?" → Several sprockets, and a part below them that guides the chain
2. Question, skipped when already known: "Follow the shifter on the right of the handlebar. What connects it to the rear gears?" → A thin cable in a housing

## Checks

The first state that leads to a job ends the diagnosis.

### 1. `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check ◀ **this path**
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride)

### 2. `chain-condition` · inspection · 1 min

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

<sub>3D: focus chain · view chain_close</sub>

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → next check ◀ **this path**
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. → result: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. → result: **Clean and oil the chain** (soon)

### 3. `shift-test-ride` · inspection · 3 min

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

<sub>3D: focus shifter_rear, cassette · view drive_side</sub>

- [ ] **Slow or rattling when pedalling gets lighter** — The chain is slow to climb to the bigger sprockets. → result: **Adjust the rear gears** (soon)
- [ ] **Slow or rattling when pedalling gets harder** — The chain is slow to drop to the smaller sprockets. → result: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → next check ◀ **this path**

## Job screen: Have the rear gears checked

- Do it myself: no guide yet
- **Take it to a shop**: "The rear gears do not work as they should. Please check the rear derailleur, the part that holds it, and the gear cable." Price: no estimate yet.
