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

## SR-02 A short label for every fact
- 2026-11-17, requested by the agent building the player (prompt 2)
- Needed for: the bike sheet in the garage, the shop summary
- What cannot be expressed: a fact has a beginner `question` (long, written for asking) but no short name for a list ("Gears", "Rear derailleur model"). Detail facts have neither.
- Closest allowed form used meanwhile: the player shows the question, or the fact key made readable (`drive.rear_speeds` -> "Rear speeds").
- Proposal: optional `label: { en, de }` on every fact; required for facts without a question.

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

## SR-07 Directions for animations
- 2026-11-17, requested by the agent building the player (prompt 2, part 2)
- Needed for: `content/steps/rear-shifting.yaml`, the solutions of `check-high-limit`, `check-b-gap`, `check-cable-tension`, `check-cable-tension-riding`
- What cannot be expressed: one clip that runs either way (screw in or unscrew). A clip takes no direction (rule `animation-kind`), and the `direction` of a generic motion is free text that the player has to interpret.
- Closest allowed form used meanwhile: generic `rotate` motions with `direction: "screw in"` or `"unscrew"`; the player shows the screw's effect with the ported clips.
- Proposal: `direction` on motions as an enum (`screw_in`, `unscrew`, `forward`, `backward`, `towards_spokes`, `away_from_spokes`, `up`, `down`), with the readable wording left to the caption. Optionally allow `direction` on clips that declare one in the manifest.
