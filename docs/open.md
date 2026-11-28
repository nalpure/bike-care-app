# Open: choices made without the owner, and questions

The one place for what an agent chose or asked while you were not there. **Nothing here is decided.** The owner answers an item; then it moves to `decisions.md` (if it matters later) or is deleted. Keep each item to two lines. Newest at the bottom of each list. Everything else about the past is in `git log`.

## Choices made without the owner

- **No unknown answer: `allow_unknown: false`** on a fact (enum or boolean). The question then shows only its answers; nothing replaces "I'll check later" (the help's assistant line and Back are the way on). `facts.schema.json`, `ui/flow.ts`.
- **The barrel is read by the cards that turn it** (`check-cable-tension`, `-riding`: `when` all three places, `if_unknown: ask`), not by a covers block, so only the tutorial asks it. `content/jobs/adjust-rear-shifting.yaml`.
- **Per-journey `answers` in profiles removed**: only the deleted journey `no-barrel-adjuster` used them. `profile.schema.json`, `journeys.ts`.
- **`questions` lists exactly what a flow can ask**: a missing fact and a listed fact no path reads are both errors (`questions-list`); a flow that asks nothing leaves the list out. `flows.ts`.
- **Facts phase first everywhere**: "a path ahead" tries every open answer, choice and tool, so a fact read after a choice is still asked before it; the routine check asks before its first card. `resolve.ts` (`factsAhead`), `journey.ts`.
- **Review path lists** of the shifting tutorial now run hold by hold (ids unchanged: they follow the questions list). `flows.ts`.
- **The map is read, not imported:** the root `CLAUDE.md` says "read `docs/architecture/overview.md` first" instead of `@`-importing it, so its cost stays visible and the root stays short. `CLAUDE.md`.
- **The content model (fact, check, card, job, flow …) is its own page**, `docs/architecture/content-model.md`, read first by the content and build-tool guides and linked from the map; in the map itself it cost every 3D and app session about 550 tokens.
- **`approach.md`'s plans that are agreed but not built** (bike data routes, the assistant's hand-over, content roles, price table) moved to `docs/architecture/planned.md`, with today's names (review output, job, decisions).
- **decisions.md:** the four undated rule lines (ending a flow, state labels, `hands_off`, run choices) sit under a new heading "Content model"; "3D names" under "3D view", "Review" under "Tools for review". The "Content files" and "History only" lines were pointers only and are gone.
- **`docs/sharing.md` stays** as the owner's page on hosting and tester feedback; the `deploy-test-build` skill is the agent's recipe and deploys only when the owner asks in that session.

## Questions for the owner
