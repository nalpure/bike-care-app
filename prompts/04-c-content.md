# Session C: flows and content

Read `CLAUDE.md`, `prompts/04-plan.md`, `content/CLAUDE.md` and `tools/CLAUDE.md`, then the golden example and `build/review/` (cards, the trees, two journeys). If you have questions, ask them in one batch before you start; after that, work without stopping (hard rule 8).

You own `content/`, `schema/`, `tools/` and `profiles/`. You may make small changes in `player/src/engine/` and `player/src/ui/` only so that the player keeps working with your bundle changes; session A2 builds the proper UI later. In `player/src/stage/` you may change only `dirSign` in `anim.ts`. Session S works there at the same time.

The owner's notes are quoted where the wording matters.

## Part 1: the shifting flow

1. **Tools are listed only when the text uses them.** "It says light is helpful but then it never mentions it in the tutorial. … make sure in the future only tools mentioned get listed as required or helpful." Remove the torch from the shifting steps, and add a check rule so it can't happen again. Recommended rule: each tool on a step must appear in its text by its name or a short `mentions` alias in `tools.yaml`. If that turns out brittle, choose something simpler and say why in the handoff.
2. **Tool tiers.** "I don't like that it says tool X or tool Y if only one of them will fit." Use three tiers in schema, bundle and review cards: **needed**, **one of these (depends on your part)**, and **helpful**.
   - Each option in "one of these" may carry a `when` on an `ask: never` fact, for example the screw head on the derailleur. When the bike's data says which one fits, the app shows only that tool; otherwise all options, with a note on how to tell them apart.
   - No new question for this.
   - Split `derailleur-screw-tool` into its real options.
3. **No "do not use" lists.** "If it is actually safety relevant or it is a very common mistake, mention it in the step itself. For shifting, the wrong screwdriver size does not qualify." Remove `do_not_use` from the schema, the content, the review cards and the player's tools screen. The thin-string warning on `hook-or-rope` is about safety (the bike falls): move it into the text of the step that hangs the bike.
4. **Clockwise wording.** Replace "screw in / screw out / tighten / loosen" in every turning instruction, button and caption with clockwise or counterclockwise. The owner's example: "Turn the screw marked L clockwise a quarter turn."
   - Implement schema request SR-07 as part of this: `direction` on motions becomes an enum that includes `clockwise` and `counterclockwise`.
   - Update `dirSign` in `player/src/stage/anim.ts` to match, then remove SR-07 from `docs/schema-requests.md`.
5. **The L and H screw steps, the owner's method.** "Both H and L screw are adjusted by shifting to the according gear and turning it until the pulley wheel is right under the cog. If the gears start rattling / jumping to a higher / lower gear, the screw must be turned counter clockwise to get …" The note breaks off there.
   - Write the steps this way: shift to the largest sprocket (L) or the smallest (H), and turn the screw until the upper pulley sits right under that sprocket. If the chain then rattles or jumps toward the next gear, turn the screw counterclockwise until it runs quietly.
   - Add the missing end of the sentence to `content/review/adjust-rear-shifting.md` as an open question for the owner and the mechanic. Also list it in your handoff.
6. **Questions name the part.** "The question should be sth like 'Which type of drivetrain do you have?' with answers 'Regular, chain' or 'Hub'."
   - Rewrite every fact question and answer this way.
   - Add an optional help text per question (`help: { en, de }` like `question`, longer, shown behind a "?"). The player adds a fixed last line pointing to the assistant, so don't write it into each help text.
   - Update `content/CLAUDE.md` to name the field.
7. **Remove rapid-rise derailleurs:** the fact `drive.rear_derailleur_type`, its not-covered texts, the case, the profile `mtb-rapid-rise`, and the mentions in `content/review/`. Keep `ask: never` in the schema: tool tiers use it.

## Part 2: simplify the structure

"I feel like the file structure could be simplified. … Second-guess previous choices. Maintainability and ease of review are key. Check for any duplicated logic in different files."

1. **Declare `derailleur-alignment` once** for the tutorial, not in each case file (owner decision). Find the smallest construct that does it, for example a list of checks the tutorial runs before its cases. It must still be hidden after a diagnosis that answered it.
2. **Coverage is written twice.** The diagnosis `not_covered` list and the tutorial's not-covered cases repeat the same bikes and almost the same texts. Make it one source, for example "which bikes this job covers" on the job, with the diagnosis inheriting it. Keep the build's coverage check.
3. **Then look for the rest:** duplicated conditions, texts written twice, fields no one reads, schema constructs no content uses, rules the build checks twice.
   - Remove what does not earn its place.
   - Changes to the schema, `tools/` and the content are yours to make. List each one, with the reason, in your handoff.
   - Ask the owner only about changes that would alter what the user sees.

## Part 3: data the app sessions need

1. **Facts from the shared names table** in `04-plan.md`, with a short `label: { en, de }` on every fact (this implements SR-02; remove it from `schema-requests.md`). Also add `group` labels and icon ids, `unit`, `min` and `max` for numbers (plausible ranges for geometry, used by A1 to check input), and a few `_model` text facts for the main parts (shifter, cassette, chain, crankset). Take the ranges from typical published bike geometry; they are not safety values, but say in the handoff where they came from.
2. **Service intervals:** `service: { interval_km }` on jobs where it makes sense (chain care, rear shifting). Use placeholder numbers marked unverified, with an entry in `content/review/<job>.md` for the mechanic.
3. **Test bikes in the bundle:** the profiles' names and facts as `demo_bikes`, so A1 can fill the garage on first start. Give the profile bikes brand, model and year where it fits, so the stubbed lookup can find them. The app still never reads journeys.

## Done when

- `npm run check`, `npm test` and `npm run test:e2e` pass (the `verify` skill).
- `build/review/` shows the new wording. Read the shifting cards once as a beginner would.
- The handoff file lists every bundle change with its exact shape, under "Interfaces other sessions rely on".
- Commits are small and pushed: one per numbered item or close to it.
