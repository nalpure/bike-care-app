# Flow tree: Routine check

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

<sub>Unit `tree:check:routine-check` · hash `605a90674452` · mechanic: ⬜ not reviewed</sub>

The structure of the flow, each part once: order, branches, what is apart, exits and jumps. Card texts are in [cards.md](../cards.md).
To read one complete path as the user sees it: `npm run walk -- --list`, then `npm run walk -- <path-id>`.

- Questions, in this order, each only when not yet known and a path ahead reads it: `drive.gear_type`

Every state that leads to a job becomes a to-do item. Inspections that do not apply to the bike are skipped.

1. Look at the rear derailleur · `derailleur-alignment` · only when drive.gear_type is derailleur
   - `straight` → ok
   - `crooked` → to-do **Have the rear gears checked** (do_not_ride)
2. Look at the chain · `chain-condition` · only when drive.gear_type is derailleur or hub_gear or gearbox or single_speed
   - `clean` → ok
   - `dry-or-rusty` → to-do **Clean and oil the chain** (soon)
   - `dirty` → to-do **Clean and oil the chain** (soon)
3. Test ride the gears · `shift-test-ride` · only when drive.gear_type is derailleur
   - `slow-to-bigger` → to-do **Adjust the rear gears** (soon)
   - `slow-to-smaller` → to-do **Adjust the rear gears** (soon)
   - `fine` → ok
