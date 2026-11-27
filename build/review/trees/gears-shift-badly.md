# Flow tree: Diagnosis: My gears don't shift cleanly

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

<sub>Unit `tree:diagnosis:gears-shift-badly` · hash `6dda312c4612` · mechanic: ⬜ not reviewed</sub>

The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).
To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.

Symptom: "My gears don't shift cleanly"

## Bikes covered

The same bikes as the job (covers_like). From job `adjust-rear-shifting` (content/jobs/adjust-rear-shifting.yaml). Covers bikes where drive.gear_type is derailleur and drive.shifting is mechanical. Any other bike ends at the first match:

- when drive.gear_type is hub_gear → **EXIT, not covered**: "Hub gears are not covered yet. They are adjusted differently from gears with a derailleur."
- when drive.gear_type is gearbox → **EXIT, not covered**: "Gearboxes at the pedals are not covered yet."
- when drive.gear_type is single_speed → **EXIT, not covered**: "Your bike has only one gear, so there are no gears to adjust. If the chain is loose, skips or clunks, a shop can help."
- when drive.gear_type is unknown → **EXIT, not covered**: "We need to know what kind of gears your bike has. Look at the rear wheel and come back."
- when drive.shifting is electronic → **EXIT, not covered**: "Electronic shifting is not covered yet. It is adjusted with the maker's app or buttons, not with a cable."
- when drive.shifting is unknown → **EXIT, not covered**: "We need to know whether your gears use a cable. Look at the right shifter and come back."

Checks, in order. The first state that leads to a job ends the diagnosis:

1. Look at the rear derailleur · `derailleur-alignment` · 1 min · only when drive.gear_type is derailleur
   - `straight` → next check
   - `crooked` → job **Have the rear gears checked** (do_not_ride)
2. Look at the chain · `chain-condition` · 1 min · only when drive.gear_type is derailleur or hub_gear or gearbox or single_speed
   - `clean` → next check
   - `dry-or-rusty` → job **Clean and oil the chain** (soon)
   - `dirty` → job **Clean and oil the chain** (soon)
3. Test ride the gears · `shift-test-ride` · 3 min · only when drive.gear_type is derailleur
   - `slow-to-bigger` → job **Adjust the rear gears** (soon)
   - `slow-to-smaller` → job **Adjust the rear gears** (soon)
   - `fine` → next check

No hit → job **Have the rear gears checked**.
