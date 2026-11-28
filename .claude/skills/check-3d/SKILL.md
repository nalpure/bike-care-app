---
name: check-3d
description: See and measure what the 3D view shows after a change to player/src/stage/ or to a card's or fact's 3D fields (focus, show, view, animation), and prove that a 3D refactor changed nothing. Prints framing numbers first; looks at 2 to 4 pictures only.
---

# Check the 3D view

How the stage works is in `player/src/stage/CLAUDE.md`. In the Bash tool prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`. Pictures go to `scratch/` only and are never committed.

1. **A node, view or clip changed in `registry.ts`:** `npm run manifest`, then `npm run check`. `player/test/stage.test.ts` fails until every node is built and the manifest matches.
2. **A refactor that must change nothing:** `npx tsx tools/stage-digest.ts scratch/digest-before.json` before the change, `... scratch/digest-after.json` after, and compare the two files: the per-bike, per-step hashes must be identical. After a split of a part compare `geo` (a hash of every triangle per part, unchanged by a split), not `steps`.
3. **Shots:** `npm run build`, then `npm run shots -- --only road`. It walks the rear-shifting tutorial and writes one picture per card to `scratch/shots/slow/NN-<card>.png`.
   - `-- --card <words>` limits it to some cards and also lists the parts drawn.
   - `-- --at <s>[,<s>]` holds the card's clip at those times for extra pictures.
   - Other bikes: `road-inline` (drop bar, barrel on the cable), `unknown-ground` (unknown bike answering the questions).
4. **Judge from the numbers first.** Per card it prints how far the drawn parts sit from each edge of the view (`ThreeStage.framing()`) and how much of each marked part is in sight (`seen`; a box cannot tell a part hidden behind another). The card is held (`holdClip(0)`: clip at 0 s, crank, wheels, sprockets and pulleys at their start angle), so two runs print the same numbers and before and after can be compared exactly.
5. **Look at 2 to 4 pictures** to confirm: the views you changed, both orientations where layout matters. The owner clicks through the rest.
6. **Rules in pure modules** (`visibility.ts`, `fitPose` in `views.ts`) get a test in `player/test/stage.test.ts`; `ThreeStage` needs WebGL and has no unit tests.
7. Then run the `verify` skill; it runs `npm run clean` at the end, which removes the pictures.
