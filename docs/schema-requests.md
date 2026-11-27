# Schema requests

Content authors may not invent schema constructs (CLAUDE.md, hard rule 2). When the schema cannot express something, add an entry here, use the closest allowed form in the content, and continue. The owner or a session prompt decides. An accepted request is implemented and then removed from this file.

Entry format:

```
## SR-nn Short title
- Date, requested by (agent or run id)
- Needed for: file and id
- What cannot be expressed:
- Closest allowed form used meanwhile:
- Proposal:
```

## Open requests

## SR-03 Pictures for question answers
- 2026-11-17, requested by the agent building the player (prompt 2)
- Needed for: `facts.yaml` questions with `picture` (bike-categories, rear-gear-types, shifting-types)
- What cannot be expressed: `picture` names a picture set, but nothing says where the images are or which image belongs to which answer.
- Closest allowed form used meanwhile: the player shows a grey "Picture" tile next to each answer.
- Proposal: a folder `content/pictures/<set>/<value>.webp`, copied into the bundle build; the check fails when an answer of a set has no image.

## SR-04 Wording for the position question and exit headings
- 2026-11-17, requested by the agent building the player (prompt 2)
- Needed for: tutorials and diagnoses with `params: { pos: ... }`, and the four exit kinds
- What cannot be expressed: the question "front or rear brake / wheel?" depends on the flow (brake or wheel) and has no text in the bundle; the exit kinds have no heading text either.
- Closest allowed form used meanwhile: player wording "Which one?" with "Front" / "Rear", and fixed headings per exit kind.
- Proposal: `params.<name>.question: { en, de }` and `answers` per value; exit headings in a small `ui.yaml` with translations.

## SR-05 What a state label changes in the 3D scene
- 2026-11-17, requested by the agent building the player (prompt 2, part 2)
- Needed for: `content/states.yaml`, the 3D stage
- What cannot be expressed: how a label holds the bike (in a stand, hanging, upside down) and which parts are off the bike while it is set ("a wheel that is out is not drawn").
- Closest allowed form used meanwhile: the player maps the three label ids to a way of holding the bike in `player/src/stage/registry.ts` (`LABEL_SCENES`). A new label is drawn as if nothing changed, with a warning in the console.
- Proposal: an optional `scene` on each state label: `scene: { pose: stand | hung | upside_down, nodes_hidden: [front_wheel, ...] }`. The build checks the nodes against `build/3d-manifest.json`, and the manifest lists the poses the player can draw.

## SR-06 Part names for the 3D view
- 2026-11-17, requested by the agent building the player (prompt 2, part 2)
- Needed for: tapping a part on the 3D view, explore mode, the small tags on parts
- What cannot be expressed: a user-facing name, other common names and a one-line description per 3D node, with translations. These are texts a reviewer should see.
- Closest allowed form used meanwhile: the texts sit in the player's registry (`player/src/stage/registry.ts`, `NODES`), English only.
- Proposal: `content/parts.yaml` with one entry per node: `label`, `name`, `aliases`, `about`, each `{ en, de }`. The build checks that every node in the manifest has an entry, and lists each as a review card (`card:part:<node>`).

## SR-07 A tap that switches the rest of a tutorial
- 2026-11-27, requested by the agent that moved the content to one file per job (sketch of the disc-pad job)
- Needed for: a disc-pad tutorial's compare card (`compare-pads`): Next means "put the same pads back"; a tap on "Worn" switches the rest of the path to fitting new pads, cleaning the rotor and bedding them in.
- What cannot be expressed: ways are picked before the first card, from facts and run choices. A button can only skip later plain steps, block or exit; nothing lets an answer choose which cards follow. The parts list (`job.parts`) is also shown up front, even when the same pads go back.
- Closest allowed form used meanwhile: a run choice asked at the start ("Do you have new pads to fit?") as a way, so the user decides before seeing the pads.
- Proposal: a branch keyed by the answer of the card just before it: `- branch: { by: compare-pads, next: [...], worn: [...] }`, where `next` is the Next path and every other key a button id; the resolver (shared with the player) and the simulation enumerate each. Optional `parts` per branch.

## SR-08 A job offers only the ways of holding that suit it
- 2026-11-27, requested by the agent that moved the content to one file per job (sketch of the disc-pad job)
- Needed for: a disc-pad tutorial's wheel-out way (pads that come out only with the wheel out), and any job that needs the wheel off the ground.
- What cannot be expressed: `choices: [hold_bike]` always offers every option, including "On its wheels". A combination that no way matches is a build error, and covers' `not_covered` would end the run with a message instead of not offering the option.
- Closest allowed form used meanwhile: none needed yet; the sketch would give the wheel-out way only stand, hang and upside down and add a `not_covered` entry for the rest.
- Owner: accepted 2026-11-27.
- Proposal: `choices: [{ hold_bike: [stand, hang, upside_down] }]` in the job header, or a `when` per way that the choice screen reads to grey out options with a short reason.
