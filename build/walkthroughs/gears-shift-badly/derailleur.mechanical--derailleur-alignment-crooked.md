# Diagnosis "My gears don't shift cleanly": `derailleur-alignment`: crooked

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| | |
| --- | --- |
| Path | `derailleur.mechanical--derailleur-alignment-crooked` |
| Bike | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) |
| Ends | Job `derailleur-check-at-shop` (do_not_ride) |
| Time | 1 min |

## Before you start

1. Question, skipped when already known: "Look at the rear wheel. Which picture looks like your bike?" → Several sprockets, and a part below them that guides the chain
2. Question, skipped when already known: "Follow the shifter on the right of the handlebar. What connects it to the rear gears?" → A thin cable in a housing

## Checks

The first state that leads to a job ends the diagnosis.

### 1. Look at the rear derailleur · `derailleur-alignment` · inspection · 1 min

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

<sub>3D: focus rear_derailleur, derailleur_hanger, cassette · view derailleur_from_behind</sub>

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → next check
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → result: **Have the rear gears checked** (do_not_ride) ◀ **this path**

## Job screen: Have the rear gears checked · **do not ride**

- Do it myself: no guide yet
- **Take it to a shop**: "The rear gears do not work as they should. Please check the rear derailleur, the part that holds it, and the gear cable." Price: no estimate yet.

After the job: "Did it fix it?" If not, the diagnosis continues with `chain-condition`, `shift-test-ride`.
