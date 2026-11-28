# Open: choices made without the owner, and questions

The one place for what an agent chose or asked while you were not there. **Nothing here is decided.** The owner answers an item; then it moves to `decisions.md` (if it matters later) or is deleted. Keep each item to two lines. Newest at the bottom of each list. Everything else about the past is in `git log`.

## Choices made without the owner

- **No unknown answer: `allow_unknown: false`** on a fact (enum or boolean). The question then shows only its answers; nothing replaces "I'll check later" (the help's assistant line and Back are the way on). `facts.schema.json`, `ui/flow.ts`.
- **The barrel is read by the cards that turn it** (`check-cable-tension`, `-riding`: `when` all three places, `if_unknown: ask`), not by a covers block, so only the tutorial asks it. `content/jobs/adjust-rear-shifting.yaml`.
- **Per-journey `answers` in profiles removed**: only the deleted journey `no-barrel-adjuster` used them. `profile.schema.json`, `journeys.ts`.
- **`questions` lists exactly what a flow can ask**: a missing fact and a listed fact no path reads are both errors (`questions-list`); a flow that asks nothing leaves the list out. `flows.ts`.
- **Facts phase first everywhere**: "a path ahead" tries every open answer, choice and tool, so a fact read after a choice is still asked before it; the routine check asks before its first card. `resolve.ts` (`factsAhead`), `journey.ts`.
- **Review path lists** of the shifting tutorial now run hold by hold (ids unchanged: they follow the questions list). `flows.ts`.

## Questions for the owner
