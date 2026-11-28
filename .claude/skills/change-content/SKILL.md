---
name: change-content
description: Write or change repair content in this repo (tutorials, diagnoses, the routine check, facts, cards, checks, tools) or a test bike in profiles/, then check it and read it as the user sees it. Use for any edit under content/ or profiles/.
---

# Change content

The rules for what you write, and the golden example to copy, are in `content/CLAUDE.md`; every field is in `schema/`. In the Bash tool prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.

1. **Find where it goes.** A job's tutorial and its own cards: `content/jobs/<job>.yaml`. A card two jobs or a procedure use: `content/steps/`. A shared check: `content/inspections.yaml`. Write each thing once; never copy a text or a condition into a second file.
2. **Edit the YAML.** A new fact the flow asks goes into that flow's `questions` list, in the order the user meets it.
3. **`npm run check`** after every edit. Fix every error from its message; you should not need to read the build tool.
4. **Test bikes.** When a journey changes, update its profile in `profiles/` (answers, `tutorial_sees`, choices) until the check passes, and say in your final message which journeys now end differently.
5. **Read what the user sees**, not the YAML: `build/review/cards.md`, `build/review/trees/`, `build/review/journeys/`. `npm run walk -- --list` lists the paths; `npm run walk -- <path-id>` prints one.
6. **Doubts.** A doubt about mechanics goes to `content/review/<job>.md`, never into the content as a fact. A safety value you do not have stays a placeholder in angle brackets with an entry there (hard rule 3). Something the schema cannot express goes to `docs/schema-requests.md` (hard rule 2); use the closest allowed form meanwhile.
7. **Review units.** Cards, flow trees and profile journeys each have a hash; a sign-off in `reviews/ledger.yaml` holds while the hash is unchanged. `npm run review -- status` lists them; `npm run review -- sign <unit> --role <role> --by <name>` signs one. Never edit the ledger by hand except to append; never sign a unit you did not read. Findings name the unit id, and the path id when they came from a single path.
8. **3D fields** (`focus`, `show`, `view`, `animation`) changed: look at the result with the `check-3d` skill.
9. Finish with the `finish-task` skill.
