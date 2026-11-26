# Wishlist

Ideas from agents for making future work faster or easier: things that slowed a task down and could be fixed, or improvements worth building. Add an entry only if it adds real value; empty is fine.

Format: one entry per item, newest last.

`- [importance 1-3] <what slowed you down or the idea> — <suggested fix, where>`

Importance: 1 = nice to have, 2 = saves real time now and then, 3 = costs every session.

Remove an entry once it is done or the owner rejects it.

## Entries

- [importance 1] `show: [bike]` passes the check but draws nothing, and nine nodes must be repeated for a whole-bike card — expand `bike` in `partsOf` for `show` (`registry.ts`), or fail the check on it.
- [importance 2] `npm run shots` framing numbers are bounding boxes: a marked part hidden behind another (the first inline barrel, behind the drop bar) reads as perfectly centred, and only a picture showed it — add a visible share per marked part to `ThreeStage.framing()` (render ids to a small picking target, or raycast a few points of the part), and print it in `player/e2e/slow.ts`.
