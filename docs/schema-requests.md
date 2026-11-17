# Schema requests

Content authors may not invent schema constructs (CLAUDE.md, hard rule 2). When the schema cannot express something, add an entry here, use the closest allowed form in the content, and continue. The owner or a schema agent decides; accepted requests move to `approach-changes.md`.

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
- Closest allowed form used meanwhile: player wording "Which one?" with "Front" / "Rear", and fixed headings per exit kind (assumption A-24).
- Proposal: `params.<name>.question: { en, de }` and `answers` per value; exit headings in a small `ui.yaml` with translations.

## Accepted

## SR-01 A button that skips the next step (accepted 2026-11-17, see AC-21)
- 2026-11-17, requested by the agent writing the golden example (after a cold review)
- Needed for: `content/steps/rear-shifting.yaml`, step `find-barrel-adjuster`, button "I cannot find one"
- What cannot be expressed: a forward skip over one optional step. The legacy draft had `skip_to`; approach.md replaced it with stops and the jump-ahead, which only exist in safety checks.
- Closest allowed form used meanwhile: the button text says "Skip the next step"; the user swipes past it.
- Proposal: an optional `skips: [step-id]` on a check button, limited to later steps that are not safety checks and set or clear no state label. The simulation would add one path per such button.
