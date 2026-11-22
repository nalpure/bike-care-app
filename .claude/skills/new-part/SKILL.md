---
name: new-part
description: Add a real part (or a second variant of a slot) to the 3D parts library, from source node to placed, measured and checked in the player. Use when the task is "use this model's part X in the 3D bike".
---

# Add a part to the 3D library

Read `player/src/stage/library.md` first (library space, API, which parts are library and which generated) and `tools/assets/CLAUDE.md` (commands, rules). Probes go in `scratch/`; use `tools/assets/explore/` to find nodes (`tree.mjs`, `islands.mjs`), do not read glTF files. Prefix commands with the Node PATH line from `CLAUDE.md`.

1. **Find the source nodes** in the model by their original glTF names. For a model other than the touring bike, `library.yaml` has a single `source`: a second source is not wired up, so stop and put it in `docs/open.md` as a question.
2. **`tools/assets/library/library.yaml`:** add the part (`nodes`, `drop` materials, `front` if it is steered in the source, triangle share). Add the name to `LIB_NAMES` in `player/src/stage/library.ts`.
3. **`npm run parts`**, then **`npm run parts:check`**: overlap at least 0.97 and a box within 0.5 mm of the source from 6 directions, library within budget. Fix the yaml until it passes; do not loosen the check.
4. **Mounting point:** if the part attaches to something, add the point to `tools/assets/measure/mounts.ts`, run `npm run parts:mounts`. Never type mount numbers by eye.
5. **Build it in the player** under its registry node, in the builder of its area (`bike.ts`, `drivetrain.ts`, `derailleur.ts`, `cockpit.ts`). Keep every node, view and clip name in `registry.ts`. A library part keeps its real size on every bike; only its position follows the geometry.
6. **A second variant** of a slot: new pieces under new names in the yaml and `LIB_NAMES`, measure its mount the same way, choose between variants in `bikeSpec` (`spec.ts`) from a fact, write the rule as a comment there and list it in `docs/open.md`. Delete the old or generated shape the new one replaces; never keep two drawings for one case.
7. **Test:** add a placement check to `player/test/parts.test.ts`. Run `npm run manifest` and `npm run check` if a node changed.
8. **Credit:** the app must credit every model it uses (`CREDITS.txt` is generated). A model without a `credit.txt` or with open usage rights ships nothing; note it in `docs/open.md`.
9. Run the `verify` skill; look at 2 to 4 screenshots of the new part only.
