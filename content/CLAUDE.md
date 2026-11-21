# Writing content: guide for agents

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
- **Warnings** go in the step text, and only when they are about safety or a very common mistake. A wrong screwdriver size does not qualify.
- Facts that are only nice to know appear in text only when known: `{fact.key|fallback wording}` or `details`.

## Questions (facts)

- Ask by the part's name and offer the types the user can see: "Which gears does your bike have?" with "Chain and derailleur" and "Hub gear". Put the longer explanation, how to tell the answers apart, in the fact's `help: { en, de }`, not in the question. The app adds a last line pointing to the assistant; do not write it.
- Ask only what changes the steps (hard rule 11). Never ask what a beginner cannot tell; mark it `ask: never`.

## Tools

- List a tool on a step only when the step's text uses it. Nothing goes on the list "just in case".
- Three tiers. `required`: the step cannot be done without it. `one_of`: a tool set (`tool_sets` in `tools.yaml`) when the bike needs only one of several tools, depending on its part; an option's `when` reads an `ask: never` fact, and the set's `tell_apart` says how to choose. `helpful`: the text mentions it as an aid.
- The build checks that the text names each listed tool, by its name or a word in its `mentions`.
- No "do not use" lists. A real danger goes into the step text as a warning (see Texts).

## Safety

- Never invent torque, fluid, wear limits, part compatibility or service intervals (hard rule 3). Send the user to the part or its manual, or use a placeholder in angle brackets with an entry in `review/<job>.md`.
- `block` and `exit: { kind: unsafe }` only in safety checks and inspection calls. An exit reached with something apart names what to put back and has `show_how_from`.

## Structure

- Diagnoses and the routine check: `hands_off` inspections only, cheapest and most likely first.
- Tutorials: one per job. One branch by mechanism, plus at most one nested branch where the order of work differs. In each case: checks with nothing apart, then the work ending with the safety checks, then `finish`.
- Anything not covered ends in `not_covered` with a clear message (hard rule 7).
- Write each thing once. Shared steps go in `steps/`; a run used by more than one tutorial is a procedure. Never copy a text or a condition into a second file.
