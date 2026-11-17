# Diagnosis "My gears don't shift cleanly": `chain-condition`: dry-or-rusty

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical--chain-condition-dry-or-rusty` |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) |
| Ends | Job `chain-care` (soon) |
| Time | 2 min |

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

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → next check
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon) ◀ **this path**
- [ ] **Black and gritty** — The chain needs cleaning and oil. If the gears still shift badly afterwards, check again. → result: **Clean and oil the chain** (soon)

## Job screen: Clean and oil the chain · soon

- Do it myself: no guide yet
- **Take it to a shop**: "The chain is dry, dirty or rusty. Please clean and oil it, and check it for wear." Price: no estimate yet.

After the job: "Did it fix it?" If not, the diagnosis continues with `shift-test-ride`.
