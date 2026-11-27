# Writing content: guide for agents

Read first, in this order: `docs/idea.md` (what the app should be), `docs/decisions.md` (owner decisions; where `approach.md` is out of date), and `docs/approach.md` from "Building blocks" to "Build tool". These win over anything in `legacy/`.

Everything the user reads about repairs lives here. The schema in `schema/` defines every field; the golden example (`diagnoses/gears-shift-badly.yaml`, `tutorials/adjust-rear-shifting/`) shows how they are used. Copy its patterns, not its mechanics: they are unverified.

## Workflow

1. Edit the YAML here (and `profiles/` when a journey changes).
2. Run `npm run check` and fix every error from its message.
3. Read what the user will see in `build/review/` (cards, trees, journeys), not the YAML. `npm run walk -- <path-id>` prints one path.
4. A doubt about mechanics goes to `review/<job>.md`. Something the schema cannot express goes to `docs/schema-requests.md`.

## Texts

- English, short, plain words, one action per step, easy to translate into German.
- Name the part and say where it is: "the small screw marked L on the back of the derailleur".
- **Turning: say which way.** "Turn the screw marked L clockwise a quarter turn." Never "screw in", "screw out", "tighten" or "loosen" on their own. Clockwise is seen looking at the screw head; where that is unclear (a barrel adjuster), say where to look from. The animation's `direction` uses the same words.
- Buttons describe what the user sees ("The chain rattles on the largest sprocket"), never a judgement ("L limit too tight"). At most three.
- **One button per result** (decisions.md, 2026-11-26). Count what happens next, not the symptoms: two problems with the same fix or the same exit share one button; split only where the fix, the exit or its severity differs. One button is fine; word it as the answer to the question ("Does it go further in?" / "Yes, past the largest sprocket"). The check's `same-outcome` rule enforces it.
- **Answers are the exception** (decisions.md, 2026-11-22; example `check-high-limit`). The `text` states the goal ("… should be in line with the smallest sprocket."); `question` ("Not in line?") stands above buttons that are only the problems. Each says briefly what goes wrong and what to do, with a `solution` that plays at once. No "all good" button: Next means it (the build cannot tell one, so leave it out). Steps without `question` work the old way until converted. An inspection may name `default` and `question`: in tutorials that state has no button and Next takes it; leave it out of a profile's `tutorial_sees`.
- **Follow-ups and learned facts** (example `barrel-adjuster-present`): an outcome `{ inspect, outcomes }` shows another inspection only after that answer; a state's `sets` stores a fact no condition reads (kept only if the user agrees) and skips the card once the fact is known.
- **Warnings** go in the step text, and only when they are about safety or a very common mistake. A wrong screwdriver size does not qualify.
- Facts that are only nice to know appear in text only when known: `{fact.key|fallback wording}` or `details`.

## Questions (facts)

- Ask by the part's name and offer the types the user can see: "Which gears does your bike have?" with "Chain and derailleur" and "Hub gear". Put the longer explanation, how to tell the answers apart, in the fact's `help: { en, de }`, not in the question. The app adds a last line pointing to the assistant; do not write it.
- Ask only what changes the steps (hard rule 11). Never ask what a beginner cannot tell; mark it `ask: never`.
- Every fact has a short `label` for the bike sheet ("Gears", "Rear derailleur"). Its group is the key before the first dot and needs an entry in `fact_groups`. Number facts get `unit`, and `min` and `max` (plausible values, not safety values) or a fixed `values` list.

## Tools

- List a tool on a step only when the step's text uses it. Nothing goes on the list "just in case".
- Three tiers. `required`: the step cannot be done without it. `one_of`: a tool set (`tool_sets` in `tools.yaml`) when the bike needs only one of several tools, depending on its part; an option's `when` reads an `ask: never` fact, and the set's `tell_apart` says how to choose. `helpful`: the text mentions it as an aid.
- The build checks that the text names each listed tool, by its name or a word in its `mentions`.
- No "do not use" lists. A real danger goes into the step text as a warning (see Texts).

## 3D view

- `focus` lists the small parts the step marks in colour; `show` lists the parts drawn plain; the 3D view will hide every other part (decisions.md, 2026-11-22). A node goes in one list only, and the check rejects both. `show: [bike]` draws the whole bike (every part, not the work stand clamp); `drivetrain` and `rear_end` are groups. `show` is optional; a step without it keeps the old 3D look until it gets one.

## Safety

- Never invent torque, fluid, wear limits, part compatibility or service intervals (hard rule 3). Send the user to the part or its manual, or use a placeholder in angle brackets with an entry in `review/<job>.md`.
- `block` and `exit: { kind: unsafe }` only in safety checks and inspection calls. An exit reached with something apart names what to put back and has `show_how_from`.

## Structure

- Diagnoses and the routine check: `hands_off` inspections only, cheapest and most likely first.
- Tutorials: one per job. One branch by mechanism, plus at most one nested branch where the order of work differs. Hands-off checks that every case needs before the work go once in the tutorial's `checks`, not in each case file (hard rule 12 hides them after a diagnosis). In each case: the work ending with the safety checks, then `finish`.
- Anything not covered ends in `not_covered` with a clear message (hard rule 7). Which bikes a job covers is written once, in the job's `covers` (`jobs.yaml`). Its tutorial reads it before any case; a diagnosis reads it with `covers_like: <job>`. Tutorial cases then only split the covered bikes. The not-covered screen offers a shop and the assistant itself, so the texts say only why.
- Write each thing once. Shared steps go in `steps/`; a run used by more than one tutorial is a procedure. Never copy a text or a condition into a second file.

## Hard rules for content

Numbers are kept from the repo's list (the other rules, 1 to 3 and 7 to 10, are in the root `CLAUDE.md` and apply here too).

4. At most three state buttons per screen. Labels describe what the user sees, never a technical judgement.
5. `block` and `exit: { kind: unsafe }` only in safety checks and inspection calls. Any exit (unsafe, not_covered, not_needed, shop_only) reached with something apart (or the bike not ready to ride) names what to put back and has `show_how_from`.
6. Diagnoses and the routine check use only `hands_off` inspections.
11. Ask only what changes the steps. A fact read by a condition must have a question, unless it is `ask: never` (a beginner cannot tell; it comes only from the bike's data). Any other fact is only used in text when it is known (`{fact.key|fallback}` or `details`).
12. Never the same check twice in a session. An inspection the user already answered is not shown again before the work starts; after the work, a check is a re-check and is shown.

## Commands and reviewing

- `npm run check` after every edit; `npm run walk -- --list` and `npm run walk -- <path-id>` render paths on demand.
- `npm run review -- status` lists review units; `npm run review -- sign <unit> --role <role> --by <name>` signs one.
- Review units, not paths: cards (`build/review/cards.md`), flow trees (`build/review/trees/`) and profile journeys (`build/review/journeys/`). Each has a hash; a sign-off in `reviews/ledger.yaml` holds while the hash is unchanged. Findings name the unit id, and the path id when it came from a single path. Never edit the ledger by hand except to append; never sign a unit you did not read.
