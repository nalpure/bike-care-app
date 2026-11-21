# Session A2 (navigation and polish): progress

## Status

Finished (one part). Tasks 1 to 7 are done. `npm run check`, `npm test` (95 tests) and `npm run test:e2e` (11 journeys, with the new `extras/navigation`) pass.

## Done

All in the A2 commit (see `git log`):

1. **Swipe up for the next step.** The text slides up and out, the next one slides in from below (`.out-next`, `.in-next`; `App.advance`). The 3D stage stays. The progress bar is vertical, left of the text. A swipe counts only if it starts when the text is scrolled to its end, the text did not scroll during it, and it starts on the text, not the 3D view (`attachSwipeUp` in `flow.ts`, touch events). Reduced motion: no animation, same behaviour. The Next button and the arrow keys use the same path.
2. **Edge swipe back.** `ui/edge.ts`: the screen follows the finger from the first 24 px of the left edge; past a third of the width (or a quick flick) it does what the arrow does (`App.goBack`), else it springs back. `App.backTarget()` is the one place that says what Back does (overlay, journey, bike choice steps, bike page; null on the main tabs).
3. **Assistant everywhere.** `ui/assistant.ts`: one yellow button with a sparkle icon and an "AI" tag on every screen. Drag it; it snaps to the nearest side edge; `store.data.assistant = { side, y }` is kept. It moves out of the way of Next, Back, answers, the "?" and the 3D view's buttons (and, if there is room, off the step text), without saving that. Arrow keys move it too.
4. **Help on questions.** A "?" next to the question opens C's `help` text and the fixed line "Still not sure? The assistant can help."
5. **Tools screen.** Three tiers with a count each: "Needed" (also the sets the bike's data decided), "One of these, depending on your bike" (with the set's `tell_apart`), "Helpful".
6. **Repair menu.** "What is wrong?" first and large (one card per symptom), then the routine check as one card, then the to-do items (first, above the symptoms, when one says do not ride), then "All guides" collapsed with a count.
7. **Short notes.** A note keeps the screen (unit id and title), bike, flow and the last three steps. The Notes tab groups notes by screen; the whole path and the facts are under "Details", and at the end of the exported text. No change to `tools/` was needed.

## Interfaces other sessions rely on

- `App`: `backTarget()`, `goBack(instant?)`, `advance(fn, 'next' | 'back')`, `lastEdgeBack`; `Stage` unchanged.
- `ui/assistant.ts`: `assistantButton(app)`, `placeAssistant(app)`, `placeSoon(app)`; `PROTECTED` and `TEXT` are the selectors it avoids.
- `AppData.assistant?: { side: 'left' | 'right'; y: number }` (y is 0 top to 1 bottom). `Note` has new optional `title` and `last`; old notes still read.
- `Journey.context()` also returns `title`.
- e2e: `data-test` `help`, `help-text`, `tier-needed`, `tier-oneof`, `tier-helpful`, `guides` (the details element on the menu), `note-group`, `note-item`; `click(page, 'tutorial-…')` opens the guides list first; `swipe(page, from, to)` sends touch events.

## Choices made without the owner

- **Edge swipe vs the browser's.** Our zone is the first 24 px of the left edge only (the right edge is left to the browser). Safari on iOS goes back in its history from the left edge and may deliver the same touch: the app keeps one history entry while Back is possible, so that gesture also goes back in the app (`popstate`), and a browser back within 0.7 s of our own swipe is ignored so it does not count twice. Chrome on Android uses a system gesture the page never sees and goes through the same history entry. On a main tab the next back leaves the app, as usual. I could not test either phone browser; Playwright simulates our swipe and the browser back only.
- **Swipe up is touch only.** Not on a mouse, where the arrow keys and the buttons do it. A swipe down does not go back (it would clash with scrolling the text).
- Default assistant place: right edge, bottom. Snaps to left or right only (not to the top or bottom).
- "All guides" is collapsed by default; I judged ten guides too long for the menu.
- A to-do item with urgency `do_not_ride` shows above the symptoms; the rest after the routine check.
- No short code for a path: the last three steps plus Details was enough, so no reader in `tools/`.
- The "?" shows only where a fact has `help`. The line about the assistant is UI text, not content.

## Questions for the owner

1. Should the left-edge swipe also work on the right edge (for left-handed use)? Recommended: not yet; Chrome on Android already uses both edges.
2. Should swipe up also work with a mouse drag, for testing on a laptop? Recommended: no.

## Next steps

1. Owner: try the card on a real phone (swipe up on a long step, edge swipe in Safari and Chrome, dragging the assistant). The two browser edge gestures are the part I could not check.
2. Prompt 3 (the content workflow) comes next; its writer agents inherit the new rules (see `04-plan.md`).

## Gotchas

- The text scrolls inside `.guide`. A vertical drag becomes a browser scroll and sends no pointer events, which is why the swipe uses touch events.
- `App.render` rebuilds the whole screen, including the assistant button, on every change; its place is set again by `placeSoon` after each render and on scroll.
- Back on a card first undoes a tap, then goes to the previous card, then leaves the flow. The e2e test relies on that.
- Writing patch scripts with a heredoc: a `'\n'` inside a template literal came out as a real newline, and backticks broke the shell once. Use the Write tool for such files.
- `npm run test:e2e` takes about 3 minutes; screenshots of the new screens are in `player/e2e/shots/portrait/navigation/` and `.../extras/`.
