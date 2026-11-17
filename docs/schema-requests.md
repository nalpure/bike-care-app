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

None.

## Accepted

## SR-01 A button that skips the next step (accepted 2026-11-17, see AC-21)
- 2026-11-17, requested by the agent writing the golden example (after a cold review)
- Needed for: `content/steps/rear-shifting.yaml`, step `find-barrel-adjuster`, button "I cannot find one"
- What cannot be expressed: a forward skip over one optional step. The legacy draft had `skip_to`; approach.md replaced it with stops and the jump-ahead, which only exist in safety checks.
- Closest allowed form used meanwhile: the button text says "Skip the next step"; the user swipes past it.
- Proposal: an optional `skips: [step-id]` on a check button, limited to later steps that are not safety checks and set or clear no state label. The simulation would add one path per such button.
