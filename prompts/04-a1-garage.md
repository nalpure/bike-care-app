# Session A1: bikes and the garage

Read `CLAUDE.md`, `prompts/04-plan.md`, `player/CLAUDE.md` (it includes `player/README.md`), and the handoff files of phase 1: `prompts/04-c-content-progress.md` and `prompts/04-s-3d-progress.md`. They name the bundle fields, fact keys and the preview API you build on. If you have questions, ask them in one batch before you start; after that, work without stopping.

You work in the main checkout. You own `player/src/engine/`, `player/src/ui/` and `player/e2e/`. Everything about a bike or a repair comes from the bundle (hard rule 1). Neutral UI wording is yours to write.

## Tasks

1. **Several test bikes from the start.** "Start with having multiple bikes in the user's garage for testing purposes." On first start, and after a reset, fill the garage from the bundle's `demo_bikes`. Bump the store version if the stored shape changes, and migrate or reset cleanly.
2. **Choose the bike when a flow starts, not in general.** "Not one bike should be selected for flows in general."
   - When the user opens a symptom, a tutorial or the routine check, the first screen offers two choices: their bikes (listed) or "an unknown bike".
   - "Unknown bike" then offers two ways:
     - **"Add the complete bike"**, with the small hint "Best if you bought it complete and know its exact name". It opens a form (brand, model, line, year).
     - **"Answer a few questions"**.
   - **The lookup is a stub** (owner decision). Match the form against the demo bikes. When nothing matches, say that the real app would search online, and carry on with the questions.
   - Remove the single selected bike from the shell, and the built-in "Unknown bike" where the new flow replaces it.
3. **Keep what the app learned.** "When the app learned something new about the user's bike (usually before tutorial start) it should offer to add the data to the bike in use, or if 'unknown bike' is used, offer to create a new bike for the garage with a name that the user must enter."
   - Offer this once per flow, before the first step, on the screen after the questions.
   - Saving a new bike requires a name; skipping is allowed.
   - Answers of "I'll check later" are never stored, as today.
4. **A compact bike page.** "Priority is displaying information." It has four tabs.
   - **Characteristics:** one line per known fact ("Type: Mountain bike", "E-bike: yes", "Gears: Hub gear", "Rear speeds: unknown"), using the fact labels. Tap a line to change the answer, with the same choices as the question.
   - **Components:** the fact groups with their icons.
     - Each group lists its model facts as components, and shows "2 facts known" for the rest; tapping a group opens it, where the facts can be edited.
     - The owner described both a separate characteristics sheet and this combined view. Build both tabs, keep them small, and say in the handoff which one you would keep.
   - **Geometry:**
     - A table of the `geometry.*` facts, editable, checked against the facts' `min` and `max`: an out-of-range value is refused, with a short reason.
     - Also check that values fit together, for example that the wheelbase is clearly longer than the chainstay. Keep these checks few and lenient, and list them in the handoff.
     - A 2D schematic bike (inline SVG) shows what each value measures; tapping a row highlights its line.
     - Values from a complete bike fill in automatically.
   - **Service:** a traffic light per job that has a service interval, plus open to-do items from findings.
     - Ask once for "km per week, roughly", and estimate the km since the job was last done (since the bike was added, if never).
     - Green below 75 % of the interval. Yellow from 75 % to 100 %, or a finding with urgency `soon`. Red at 100 % or more, or a finding with `do_not_ride`.
     - Any red item shows a banner on the bike and in the garage list.
     - Finishing a tutorial records the date it was done.
   - Also show the 3D preview of the bike (S's API) at the top. A colour picker sets `bike.colour`.
5. **Delete by swiping left** on a bike in the garage: a delete button appears, and a warning comes before it is removed.
6. **The garage icon** must look like a bike.

## Done when

- `npm run check`, `npm test` and `npm run test:e2e` pass (the `verify` skill). The e2e run covers choosing a bike, the unknown-bike flow with both ways, saving a new bike, editing a fact, the geometry check refusing a value, a red service item, and deleting a bike.
- You have looked at the new screens in portrait and landscape: the garage, the bike page with each tab, and the bike choice.
- The handoff file lists the store shape, the choices you made (thresholds, geometry checks, which bike-page variant you'd keep), and what A2 needs to know.
