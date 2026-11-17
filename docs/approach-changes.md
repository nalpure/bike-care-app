# Changes to the solution approach

This file records every decision that changes, extends or clarifies [approach.md](approach.md). It uses the same sections in the same order, so you can read both side by side. **Where this file and `approach.md` disagree, this file wins.**

Each entry has an id (`AC-nn`), a type (**changes**, **extends** or **clarifies**), what `approach.md` says, what holds now, why, and where it is implemented. Add new entries at the end of their section; never reuse an id.

## At a glance

No changes.

## Building blocks

### AC-01 Run choices: a ninth building block (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **approach.md:** Tools are picked fresh per run; a tutorial can branch on a helpful tool such as `tool.bike-stand`.
- **Now:** A *run choice* is a question asked fresh at the start of each tutorial and never stored on the bike, for example `hold_bike` with the options stand, hang, upside down and on its wheels (test rides). Each option can carry a note, a warning, `recommended`, and the tools it needs (`requires_tools`). Conditions read it as `choice.<id>`. Tool conditions (`tool.<id>`) still work.
- **Why:** How to hold the bike is not a tool. The owner wants the user to decide what they are comfortable with (a heavy bike upside down, a light e-bike in a small stand). The app recommends and warns but does not decide.
- **Where:** `schema/choices.schema.json`, `content/choices.yaml`, `tutorial.choices`.

### AC-02 Route facts and detail facts (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **approach.md:** Facts are asked when needed.
- **Now:** A fact is asked only if a condition in the user's flow reads it (a *route fact*). Every other fact is a *detail fact*: never asked, but when known it makes the text more specific through a placeholder `{fact.key|fallback wording}` or a `details` line that shows only when all facts in its `needs` are known. Example: the B-gap step names the derailleur model when it is known, and says "your derailleur" when it is not.
- **Why:** The owner does not want questions whose answer does not change the steps (such as the number of gears).
- **Where:** `facts.yaml` (`question` is required only for facts that conditions read; the build checks it), `details` on steps and inspections, `tools/lib/conditions.ts` (`fillText`).

### AC-19 Facts the app never asks (extends)

- **Date:** 2026-11-17 · **Decided by:** owner ("too niche, but catch them with a not-supported message")
- **Now:** A fact can be marked `ask: never`. Conditions may read it, but the app never asks; it is unknown unless the bike's data provides it (a parts list, a partner's QR code, a lookup). Use it for facts a beginner cannot tell, so that niche bikes end at "not supported" when the data is there, and everyone else gets the normal guide. Example: `drive.rear_derailleur_type` (rapid-rise derailleurs). In walkthroughs such a fact shows as "never asked; from the bike's data", and combinations that differ only in it but give the same result are one path.
- **Where:** `schema/facts.schema.json` (`ask`), `tools/lib/expand.ts`, `tools/lib/flows.ts` (`ComboIds`).

### AC-03 Session state also covers "not ready to ride" (clarifies)

- **Date:** 2026-11-17 · **Decided by:** owner (confirmed in conversation)
- **approach.md:** Session state labels are "what is currently taken apart".
- **Now:** A label is anything the user must undo before riding, including a bike clamped in a stand, hanging, or upside down. The same rules apply: every path ends with no label set, and a stop reached while a label is set names what to put back and has `show_how_from`. Labels are declared in `content/states.yaml`, with `put_back` wording, an optional standing `warning`, and optional `safety_checks` that every path must pass after the label is cleared.
- **Where:** `schema/states.schema.json`, `content/states.yaml`, `tools/lib/simulate.ts`.

## Diagnosis, tutorial and routine check

### AC-04 What hands_off means (clarifies)

- **Date:** 2026-11-17 · **Decided by:** owner (confirmed in conversation)
- **approach.md:** "Diagnosis is hands-off. It looks, listens and feels, with a torch at most."
- **Now:** `hands_off: true` means the inspection takes nothing apart and changes no setting. Riding and shifting count as hands-off, so a diagnosis may ask for a short test ride (`shift-test-ride`).
- **Where:** `content/inspections.yaml`.

### AC-05 A tutorial may repeat a diagnosis inspection at its start (clarifies)

- **Date:** 2026-11-17 · **Decided by:** agent, owner informed
- **Now:** `adjust-rear-shifting` starts with `derailleur-alignment`, which the diagnosis also runs. Users who open the tutorial directly skip the diagnosis, and a stop there costs nothing because nothing is apart yet. See AC-20 for what happens when the user just answered it.

### AC-20 No inspection twice in one session (changes)

- **Date:** 2026-11-17 · **Decided by:** owner ("a user shouldn't need to do the same step twice")
- **Now:** Every inspection state the user reports in a session (diagnosis, routine check, tutorial) is kept for that session. In a tutorial, an inspection call **before the first step** whose inspection was already answered in this session is not shown again; the earlier answer decides its outcome. After the first step it is a re-check of the result (for example the test ride in `finish`) and is always shown. The player must implement this rule; the profile journeys apply it.
- **Open:** whether a finding from an earlier day also counts (see "How long findings are kept" in approach.md).
- **Where:** `tools/lib/journeys.ts` (`session`, `workStarted`), note in each tutorial walkthrough.

## Findings, jobs and the to-do list

No changes.

## Tutorial rules

### AC-06 The nested branch may be on a run choice (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **approach.md:** "One further nested branch is allowed where the order of work differs." "No branches on several facts at once."
- **Now:** The nested branch may test a run choice. `adjust-rear-shifting` branches first by mechanism (mechanical derailleur), then by how the bike is held: rear wheel free (stand, hang, upside down) or on its wheels with test rides. The order of work differs, so this is the allowed nested branch. The top branch may test two facts together when the second only refines the first (`drive.gear_type` then `drive.shifting`); conditions are evaluated in written order, so `drive.shifting` is only asked for derailleur bikes.
- **Where:** `schema/tutorial.schema.json` (`cases` inside a case, one level only).

### AC-07 Repeated test rides without loops (clarifies)

- **Date:** 2026-11-17 · **Decided by:** owner
- **Now:** Without a way to lift the rear wheel, the user adjusts while the bike stands and tests with short rides. The app does not loop. A check step asks what the user noticed on the ride; the button text says what to turn and to ride again, and the user taps a different button when it is fixed, as in the prototype. While adjusting, the bike stands on its kickstand or leans against a wall at the saddle and rear wheel, never at the handlebar.
- **Where:** `content/tutorials/adjust-rear-shifting/cases/test-rides.yaml`.

### AC-08 Unknown is an explicit value (extends)

- **Date:** 2026-11-17 · **Decided by:** agent (cautious default)
- **approach.md:** "Every condition says what happens when a fact is unknown."
- **Now:** A route fact that is still unknown after the question ("I'll check later") has the value `unknown`, and conditions can test it, for example `{ drive.gear_type: [unknown] }`. The coverage check treats `unknown` as a value, so every flow must say what happens then; usually a `not_covered` case that says what to find out. Tutorials and procedures use `if_unknown: ask`. A step with a `when` uses `if_unknown`: `ask`, `generic` (show `generic_text`), `skip` or `include`.
- **Why:** The owner expects users to answer, but a missing answer must never block or produce a guess.

### AC-09 show_how_from may name a procedure (extends)

- **Date:** 2026-11-17 · **Decided by:** agent
- **Now:** `show_how_from` names a step or a procedure called later in the same sequence. The jump lands on that procedure's first step for the user's choice (for example `release-bike` lands on "take the bike out of the stand" or "turn it back onto its wheels").

### AC-21 Buttons may skip later steps (extends)

- **Date:** 2026-11-17 · **Decided by:** owner (accepted SR-01)
- **approach.md:** No skip construct; the legacy `skip_to` was replaced by stops and the jump-ahead.
- **Now:** A button on a check step may carry `skips: [step-id, ...]`: later steps in the same sequence that this answer makes unnecessary. Never a safety check, an inspection call, or a step that sets or clears a state label. A target that a case does not contain is ignored; a target before the button is an error. Expansion adds one path per skipping button.
- **Where:** `schema/common.schema.json` (button `skips`), rules `skip-unsafe` and `skip-not-ahead`.

### AC-22 "Not supported" during a tutorial is an inspection call before the work (clarifies)

- **Date:** 2026-11-17 · **Decided by:** agent, following the owner's request to catch niche bikes
- **Now:** When a bike turns out to be unsupported only once the user looks at it (no barrel adjuster), the tutorial calls a hands-off inspection **before anything is opened or the bike is lifted**, with a `stop` outcome whose message says "not supported yet" and offers a shop. Because nothing is set yet, no jump is needed. This keeps `stop` within inspection calls (hard rule 5).
- **Where:** inspection `barrel-adjuster-present`, both cases of `adjust-rear-shifting`.

### AC-23 One exit construct with a kind (changes)

- **Date:** 2026-11-17 · **Decided by:** owner
- **approach.md:** Inspection outcomes are continue, block, stop or end; buttons may stop; cases and procedures may say `shop` or `not_covered`.
- **Now:** Everything that ends a flow is `exit: { kind, text, show_how_from? }`, on a button, an inspection outcome, a tutorial case or a procedure implementation. `block` stays as it was. The kinds and what the player shows:

| Kind | Meaning | Screen buttons | Allowed in |
| --- | --- | --- | --- |
| `unsafe` | Do not ride | Find a shop | Safety checks and inspection calls only |
| `not_covered` | This bike or part is not supported yet | Find a shop, Ask the assistant | Any check, inspection call, case, procedure |
| `not_needed` | The repair is not needed | Done | Any check, inspection call, case, procedure |
| `shop_only` | A shop has to do this | Find a shop | Any check, inspection call, case, procedure |

  Whatever the kind, an exit reached while something is apart names what to put back and has `show_how_from`; the screen then also offers "Show me how to put it back". Exits on cases and in procedures run before the first step and never jump.
- **Why:** "Not supported" and "not needed" are not safety stops, and should look different to the user.
- **Replaces:** `stop` and `end` (AC-22 now uses `exit: { kind: not_covered }`), and the case and procedure keys `shop` and `not_covered`. The diagnosis keeps its own `not_covered` list.
- **Where:** `schema/common.schema.json` (`exit`), rules `unsafe-only-in-safety-checks`, `exit-needs-show-how-from`, `exit-jump-outside`.

### AC-10 Heavy-bike warnings (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **Now:** Bike weight is not a fact. Every option and step that lifts, hangs or turns the bike carries a short warning for heavy bikes, both in the run choice and in the step text.

## File layout and YAML structure

### AC-24 Titles on steps and inspections (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **Now:** Every step and inspection has a required `title`: the short heading of its card, a few words in the imperative ("Check the inner limit (L screw)"). The prototype had one; the player needs it, and walkthroughs show it next to the id.

### AC-25 Button ids (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **Now:** Every button has a required `id`, unique within its step. Profiles name the tapped button by id, and path ids use it (`--unsafe-check-all-gears-chain-off`), so changing a label's wording breaks nothing. Replaces assumption A-10.

### AC-11 New files (extends)

- **Date:** 2026-11-17
- **Now:**

| File | Holds |
| --- | --- |
| `content/choices.yaml` | Run choices (AC-01) |
| `content/states.yaml` | Session state labels (AC-03) |
| `content/tools.yaml` | Tools, and parts under `parts:` |
| `schema/*.schema.json` | One JSON Schema per file type, plus `common.schema.json` |
| `schema/3d-catalog.yaml` | 3D node, view and clip names until the player exports `build/3d-manifest.json` |
| `profiles/*.yaml` | Test bikes with journeys (AC-15) |
| `docs/approach-changes.md`, `docs/idea-changes.md` | This file and its twin |

### AC-12 Fields beyond the examples in approach.md (extends)

- **Date:** 2026-11-17 · **Decided by:** agent, while writing the schema
- **Now:**
  - Facts: `type` (enum, boolean, text, number), `answers` (answer text per value), `note`.
  - Steps: `generic_text`, `details`; `if_unknown` is required whenever `when` is present.
  - Buttons: optional `when` (a button set that depends on facts).
  - Inspections: optional `animation` and `details`.
  - Tutorials: `choices`, nested `cases` (AC-06).
  - Diagnoses: `if_unknown: ask`; an `override` value of `null` makes a state not a hit for that symptom.
  - Procedures: implementation steps may also be `{ not_covered: text }`, next to `{ shop: text }`.
  - Animation: either `{ target, motion, direction, amount, caption }` or `{ clip, caption }`, both with optional `view`. A button's `solution` is a list of one to three animations.
- **Rule:** content authors still may not invent constructs. New needs go to `docs/schema-requests.md`.

## Build tool

### AC-13 Paths branch only on what is read (clarifies)

- **Date:** 2026-11-17 · **Decided by:** agent
- **Now:** Expansion reads conditions in written order and branches only on keys that are actually read. A path exists for each combination of route facts, run choices and tools that changes a case, an implementation, a conditional step or a button set. Detail facts never create paths. Each stop adds one path that ends there and, if something is set, one that takes the jump ahead.

### AC-14 Rule interpretations (clarifies)

- **Date:** 2026-11-17 · **Decided by:** agent
- "A stop that needs nothing taken apart sits before the first step that opens something" is checked like this: a `hands_off` inspection call with a `stop` or `end` outcome must not be reached while any state label is set.
- "Every path passes the safety checks for what was opened" is checked through `safety_checks` on each state label in `states.yaml`.
- "No step runs while a state it forbids holds" uses `forbidden_while`. Riding steps forbid every holding label.

### AC-15 Profiles describe journeys, strictly (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **Now:** Profiles exist only for reviewers; the app never reads them. A profile holds the bike's known `facts`, the `answers` the owner gives when asked, the `tools` they have, and one or more `journeys`. A journey names its start (diagnosis, tutorial or routine check), what the owner `sees` at each inspection, the job screen choice, the run choices, what they tap at each inspection and safety check in the tutorial (`tutorial_sees`), and whether they follow the jump after a stop (`after_stop`). Every question or inspection a journey reaches must be answered in the profile, or the check fails. There are no silent defaults.

### AC-16 Output and failure behaviour (extends)

- **Date:** 2026-11-17 · **Decided by:** agent
- **Now:** The check runs in stages: schema, references, then expansion, simulation and coverage. Later stages run only when the earlier ones pass. `build/report.md` is written whenever expansion ran; `build/bundle.json` only when there are no errors. Every error is one line: `ERROR <file>:<line> | <id> | <rule> | <message>`.
- `build/` is committed to git. Its output is deterministic (no timestamps), so reviewers can diff walkthroughs and see which paths changed.

### AC-17 3D names before the player exists (extends)

- **Date:** 2026-11-17 · **Decided by:** agent
- **Now:** Until the player exports `build/3d-manifest.json`, focus nodes, views, clips and animation targets are checked against `schema/3d-catalog.yaml`, which was seeded from the prototype. Once the manifest exists it wins.

## Player and 3D

No changes yet. AC-17 names the interim 3D catalog.

## Bike data

No changes.

## How content gets made

No changes.

## Changes to the existing YAML files

No changes.

## Requirements check

No changes.

## Open decisions and build order

### AC-18 B-screw step kept (clarifies)

- **Date:** 2026-11-17 · **Decided by:** owner
- **Now:** The tutorial keeps the prototype's B-gap step. It gives no number: the prototype's "about 5 to 6 mm" depends on the derailleur and is unverified. The text points to the derailleur's manual and names the model when it is known. Listed for the mechanic in `content/review/adjust-rear-shifting.md`.
