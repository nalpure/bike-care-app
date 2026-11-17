# Prompt 1: schema, build tool and one golden example

## Goal

Set up the repository so that content can be written as YAML, checked by a script, and compiled into one bundle for the player. Prove it with one small, complete example: the symptom "My gears don't shift cleanly".

Read `CLAUDE.md`, `docs/idea.md` and `docs/approach.md` first. The section "File layout and YAML structure" in `approach.md` is the starting point for the schema. You may challenge it: if something there is unclear or wrong, write the problem and your choice to `docs/assumptions.md` and go on.

## Deliverables

### 1. Scaffold

- Node and TypeScript project with the layout in `CLAUDE.md`.
- Scripts `check`, `dev`, `build` in `package.json`. `dev` and `build` may be stubs until prompt 2.

### 2. Schema (`schema/`)

JSON Schema for: facts, tools, inspections, jobs, steps, procedures, tutorial, case, diagnosis, check, profile. Strict: unknown keys are errors.

Must cover at least:

- Inspection: `id`, `applies_when`, `hands_off`, `minutes`, `text`, `tools`, `focus`, `view`, `states` (2 or 3, each with `id`, `label`, `meaning`, optional `leads_to: { job, urgency }`).
- Step: `id`, `kind` (action, check, safety_check), `minutes`, `text`, optional `when`, `if_unknown`, `tools`, `parts`, `sets`, `clears`, `forbidden_while`, `focus`, `view`, `animation`, `buttons` (max 3, each with `label`, `text`, optional `solution`, `block`, `stop`, `show_how_from`, `when`).
- Animation: either a generic motion (`target`, `motion`, `direction`, `amount`, `caption`) or a named clip (`clip`, `caption`).
- Tutorial: `id`, `job`, `params`, `difficulty`, `entry`, `cases` (each `when` plus `include`, `shop` or `not_covered`), `if_unknown`.
- Case: `sequence` and optional `finish`; items are `step`, `procedure`, or `inspect` with `outcomes` (`continue`, `block`, `stop`, `end`).
- Diagnosis: `id`, `symptom`, `params`, `applies_when`, `checks` (with optional `override`), `no_hit`, `not_covered`.
- Job: `id`, `title`, optional `tutorial`, `shop: { tell, price_eur, price_source }`.
- Profile: `id`, `name`, `facts`, `tools`.

### 3. Build tool (`tools/`, run by `npm run check`)

1. Validate every content file against the schema. Parse as YAML 1.2.
2. Check references: every job, tutorial, inspection, step, procedure, tool, fact key and `show_how_from` target exists.
3. Expand each tutorial and diagnosis into every concrete path: one per combination of facts and tool choices that changes a case, an implementation, a conditional step or a button set. Include, for each stop, the path that ends there and the path that takes the jump ahead.
4. Simulate each path with the state labels and enforce the rules in `approach.md`, section "Build tool".
5. Coverage: for every combination of the facts a flow reads, the result is one of: a path, a shop exit, or an explicit `not_covered`. A combination with none of these is an error.
6. Write `build/walkthroughs/<flow>/<path-id>.md`: a plain numbered rendering of what the user sees, with the facts and tools of that path in a header, each button with its text, and the minutes summed.
7. For each file in `profiles/`, write `build/walkthroughs/profiles/<profile>.md` with the full journey for that bike: pre-step questions, diagnosis, job screen, tutorial.
8. Write `build/report.md`: number of paths, time range per flow, which fact combinations end at shop or not covered, and all rule results.
9. Write `build/bundle.json` for the player.

Errors must name file, id and rule, in one line each, so an agent can fix them without reading the tool's code.

### 4. Golden example content

Symptom: "My gears don't shift cleanly" (rear shifting). It is low risk and the old prototype in `legacy/` already has 3D parts and animations for it.

- **Facts used:** `drive.gear_type`, `drive.shifting`, and the tool choice `bike-stand`.
- **Covered:** derailleur with mechanical shifting.
- **Not covered, stated plainly:** hub gear, gearbox, single speed, electronic shifting. Each gets a `not_covered` message that offers a shop and the assistant.
- **Inspections (all hands-off):** chain condition; rear derailleur looks bent or hangs crooked; shift test one gear at a time (slow to bigger sprockets, slow to smaller, fine).
- **Jobs:** `adjust-rear-shifting` (with tutorial), `chain-care` (no tutorial yet), `derailleur-check-at-shop` (shop only). Price fields stay placeholders.
- **Diagnosis:** `gears-shift-badly`, checks ordered cheapest first.
- **Tutorial:** `adjust-rear-shifting`. Use the four steps of the legacy prototype as raw material and rewrite them to the writing rules: hold the bike (stand, or upside down without one), high limit, low limit, cable tension, then a closing check through all gears. Holding the bike sets a state, so include at least one stop that needs "put the bike back on its wheels" with `show_how_from`, and a `finish` section with a short test ride.
- **Routine check:** `checks/routine.yaml` with the three inspections above, so findings and to-do items can be tested.
- **Profiles:** city bike with derailleur and no stand; road bike with a stand; e-trekking bike with hub gear (ends at not covered); unknown bike with nothing known.
- Put every doubt about the mechanics into `content/review/adjust-rear-shifting.md`. Do not present guesses as facts.

## Done when

- `npm run check` passes and produces the bundle, the walkthroughs and the report.
- Breaking a rule on purpose (a fourth button, a missing `show_how_from`, an unknown tool) makes it fail with a clear message. Add these as automated tests of the build tool.
- The four profile walkthroughs read as a sensible journey when read top to bottom.

## Out of scope

The player, brake content, any database, user accounts, the assistant.
