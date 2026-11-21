# Flow tree: Diagnosis: My gears don't shift cleanly

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

<sub>Unit `tree:diagnosis:gears-shift-badly` · hash `0cdeafe3dadb` · mechanic: ⬜ not reviewed</sub>

The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).
To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.

Symptom: "My gears don't shift cleanly"

Covers bikes where drive.gear_type is derailleur and drive.shifting is mechanical.

Not covered, checked in order:

- when drive.gear_type is hub_gear → "Hub gears are not covered yet. A shop can check them. You can also ask the assistant."
- when drive.gear_type is gearbox → "Gearboxes at the pedals are not covered yet. A shop can check it. You can also ask the assistant."
- when drive.gear_type is single_speed → "Your bike has only one gear, so this check does not fit it. If the chain skips or clunks, a shop can help. You can also ask the assistant."
- when drive.gear_type is unknown → "We need to know what kind of gears your bike has. Look at the rear wheel and come back. You can also find a shop or ask the assistant."
- when drive.shifting is electronic → "Electronic shifting is not covered yet. A shop can check it. You can also ask the assistant."
- when drive.shifting is unknown → "We need to know whether your gears use a cable. Look at the right shifter and come back. You can also find a shop or ask the assistant."

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
