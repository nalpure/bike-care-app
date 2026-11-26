# UI: guide for agents

`player/src/ui/` renders one screen at a time. Neutral UI wording only; repair text comes from the bundle (hard rule 1).

Read first: `docs/decisions.md`, section "Experience".

- **ui/** renders one screen at a time with `h()` from `dom.ts`. `flow.ts` has every journey screen; one card component serves inspections, steps and checks. `#root[data-view]` names the screen (`journey:card:<id>`); the e2e tests and `window.__app` (the App) rely on it.
- **Navigation:** `App.backTarget()` says what Back does on the current screen (null on the main tabs); the arrow, the edge swipe (`ui/edge.ts`) and the browser's back (`popstate`; the app keeps one history entry while it can go back) all call `App.goBack()`. On a card, Next, the swipe up (`attachSwipe` in `flow.ts`, touch events on the text only) and the arrow keys go through `App.advance()`; a swipe down on the text does what Back does (not on a flow's first screen, where Back would leave the flow), which slides the text out before the next one slides in from below (not with reduced motion). A touchpad or mouse wheel anywhere on the card does the same (`attachWheel`): one step per gesture, only past the text's end or top, never in a gesture that scrolled the text. The progress bar is vertical, left of the text.
- **Assistant button:** `ui/assistant.ts`, one button on every screen. Drag it; it sticks to the left or right edge and `store.data.assistant` keeps `{ side, y }`. `placeAssistant` moves it (not saved) out of the way of `PROTECTED` buttons and, where possible, text; add a selector there when a new screen has a button it must not cover. One element serves every screen (`assistantButton` keeps it), so it slides only when its place changes; a new element would slide in from the CSS default.

## Known gaps

- The edge swipe works from the first 24 px of the left edge only. Safari on iOS has its own edge swipe there; the app keeps a history entry so that swipe also goes back in the app, and ignores a browser back within 0.7 s of its own swipe. Chrome on Android uses a system gesture the page never sees; it goes through the same history entry.
- Swipe up and down work with touch and the wheel, not a mouse drag. A second touchpad swipe while the first still coasts counts as the same gesture and is ignored; the e2e test sends touch events through the Chrome DevTools protocol.
