# Player: rules for agents

@README.md

## Rules

- No repair text and no bike-specific logic here (hard rule 1). Neutral UI wording is fine ("Which one?", "Do not ride"). Anything about a bike or a repair comes from the bundle; when it is missing, write a schema request.
- Keep `engine/` free of the DOM. The UI only renders `Journey.screen()` and calls its actions.
- Screenshots go to `scratch/shots/` (every run wipes them; they are never committed). Look at a few critical screens only (2 to 4: a new layout, a 3D view you just changed, both orientations where it matters). The owner clicks through the rest.
- When you change which bike `bikeSpec` draws, write the rule as a comment in `spec.ts` and list it in `docs/open.md`.
