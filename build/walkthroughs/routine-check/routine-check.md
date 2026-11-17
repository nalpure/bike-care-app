# Routine check (`routine-check`)

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

Every state that leads to a job becomes a to-do item on the bike. Inspections that do not apply to the bike are skipped.

### 1. `derailleur-alignment` · 1 min

<sub>Only when: drive.gear_type is derailleur</sub>

Stand behind the bike and look at the rear derailleur, the part below the sprockets that guides the chain.

- [ ] **It hangs straight down, in line with the sprockets** — The derailleur does not look bent. → ok
- [ ] **It leans towards the spokes, or looks twisted** — The derailleur or the part that holds it may be bent. → to-do: **Have the rear gears checked** (do_not_ride)

### 2. `chain-condition` · 1 min

<sub>Only when: drive.gear_type is derailleur or hub_gear or gearbox or single_speed</sub>

Look at the chain below the pedals. Turn the pedals backwards slowly to see all of it.

- [ ] **Clean, with a thin film of oil** — The chain looks cared for. → ok
- [ ] **Dry, rusty, or it squeaks** — The chain needs cleaning and oil. → to-do: **Clean and oil the chain** (soon)
- [ ] **Black and gritty** — The chain needs cleaning and oil. → to-do: **Clean and oil the chain** (soon)

### 3. `shift-test-ride` · 3 min

<sub>Only when: drive.gear_type is derailleur</sub>

Ride slowly on a quiet, flat path. Use only the right shifter and change one gear at a time, all the way up and down.

- [ ] **Slow or rattling when pedalling gets lighter** — The chain is slow to climb to the bigger sprockets. → to-do: **Adjust the rear gears** (soon)
- [ ] **Slow or rattling when pedalling gets harder** — The chain is slow to drop to the smaller sprockets. → to-do: **Adjust the rear gears** (soon)
- [ ] **Every gear changes quickly and runs quietly** — The rear gears shift well. → ok
