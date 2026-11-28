# Wishlist

Ideas from agents for making future work faster or easier: things that slowed a task down and could be fixed, or improvements worth building. Add an entry only if it adds real value; empty is fine.

Format: one entry per item, newest last.

`- [importance 1-3] <what slowed you down or the idea> — <suggested fix, where>`

Importance: 1 = nice to have, 2 = saves real time now and then, 3 = costs every session.

Remove an entry once it is done or the owner rejects it.

## Entries
- [2] Proving "no visible change" for engine or content refactors needed a throw-away script that drives every profile journey and diffs every `Journey.screen()` — make it a tool like `tools/stage-digest.ts` (e.g. `tools/journey-digest.ts`, reusing `player/test/drive.ts`).
