# Session A1 (bikes and the garage): progress

## Status

Finished (the first part ran into a stop; this part completed it). Tasks 1 to 6 are done. `npm run check`, `npm test` (95 tests) and `npm run test:e2e` (10 journeys, including the new `extras/bike-page`) pass.

## Done

All in the A1 commit and the handoff commit that follows it (see `git log`):

- **Garage from the bundle:** `Store(kv, demos)` fills the garage from `demo_bikes` on first start and on reset ("Reset the test garage" on the garage tab keeps notes). Version 1 data is dropped.
- **Choosing the bike per flow:** `ui/pick.ts`: the bikes, or "An unknown bike" → "Add the complete bike" (form: brand, model, series, year; hint text as briefed) or "Answer a few questions". The lookup is a stub (`engine/bikes.ts` `lookupBike`) over `demo_bikes`; no match says the real app would search online and goes on with the questions, keeping what was typed. The shell has no selected bike. A to-do item on a bike page skips the choice.
- **Keeping what was learned:** `Journey` works on a copy; the `keep` screen comes once per flow after the questions ("Save this to <bike>?", or a name field for an unknown bike, which may not be empty; "Not now" skips). "I'll check later" is never stored. For an unknown bike whose flow made findings, the offer also comes at the end.
- **Bike page** (`ui/bike.ts`): 3D preview, name, frame colour (8 swatches plus a free picker, writes `bike.colour`), a red banner, four tabs.
- **Garage list:** a `snapshot` picture per bike (cached per bike and facts), the red banner, swipe left to delete with a warning (`ui/swipe.ts`), a bike icon.
- Tests: `player/test/garage.test.ts` (store, lookup, ranges, geometry fit, service lights, keep screen); e2e `extras/feedback-assistant-garage` and `extras/bike-page`.

## Interfaces other sessions rely on

- **Store** (`engine/store.ts`, key `bike-app/v2`): `AppData { version: 2, bikes: Bike[], tools, notes, noticeSeen, textOnly }`; `Bike { id, name, facts, findings, added: 'YYYY-MM-DD', done: { [job]: 'YYYY-MM-DD' }, kmPerWeek? }`. Methods: `garage()`, `bike(id)`, `addBike(name, facts?, findings?)`, `removeBike`, `reset()`, `setFact`, `addFinding`, `todos`, `clearJob` (also records `done`). `today()`.
- **App** (`ui/app.ts`): `view` is `home | garage | bike{id} | shop | notes | pick{start, step} | journey`. `start(start, bike?)` goes to `pick` unless a bike is given; `run(start, bike|null, preset, origin)` starts the journey; `confirmDelete(bike, after?)`; overlay `{ k: 'confirm', title, text, ok, run }`. `app.bikeName` replaces the old `app.bike`.
- **Journey** (`engine/journey.ts`): `new Journey(c, store, bike|null, session, start, preset?)`; `bikeName`, `bikeFacts`, `garageBike`, `learned()`, `keepSave(name?)`, `keepSkip()`; screen kind `keep`.
- **Engine helpers:** `engine/bikes.ts` (`lookupBike`, `formFacts`, `bikeTitle`, `numberProblem`, `fitProblem`, `GEOMETRY_FITS`), `engine/service.ts` (`serviceItems`, `redItems`, `kmSince`, `YELLOW_FROM`).
- **UI:** `ui/bike.ts` `renderBike`, `redBanner`, `redText`, `endPreview`; `ui/schematic.ts` `renderSchematic(facts, selectedKey, label)`; `Stage` has optional `preview`, `endPreview`, `snapshot`.
- **Selectors for e2e:** `bike-<id>`, `pick-<id>`, `pick-unknown`, `unknown-complete`, `unknown-questions`, `keep-save/skip/name`, `tab-<characteristics|components|geometry|service>`, `row-<fact key>` (button `.fline`), `fact-<key>`, `fact-save`, `fact-error`, `group-<id>`, `km-week`, `km-save`, `service-<job>`, `red-banner`, `colour-<hex>`, `remove-bike`, `confirm-ok`, `data-view` `pick:<step>` and `journey:keep:`.

## Choices made without the owner

- **Service lights:** green below 75 %, yellow from 75 % to under 100 %, red from 100 %, as briefed (`YELLOW_FROM`, `intervalLight`). A job with an interval but no `kmPerWeek` shows "Not known" (grey), never green. A finding with `soon` makes the job at least yellow, `do_not_ride` red; a cleared finding counts for nothing. The estimate is days since `done[job]` (else `added`) ÷ 7 × `kmPerWeek`; the bike counts from the day it was added. A to-do item for a job with no interval still gets a row.
- **Geometry fit checks** (`GEOMETRY_FITS`, only when both values are known): wheelbase at least 400 mm longer than the chainstay; effective top tube at least 50 mm longer than the reach; stack at least 150 mm taller than the head tube. The fact ranges are checked first, so the first rule fires only for extreme pairs.
- **Which bike-page variant I'd keep:** the Facts tab (one line per fact, flat) for beginners, and the Components tab (groups) as the way into the details. I built both as briefed; if one goes, drop Components: the groups are only a different way of listing what Facts and Geometry show, but its model-name lines (for example "Rear derailleur: …") are the only place component models appear, so they would have to move into Facts.
- Facts tab lists every fact except geometry, `*_model` and the colour (the colour has its own picker). Unknown shows "unknown", also for facts never asked.
- Colour swatches are 8 fixed neutral colours plus the browser's colour picker; "Std" clears `bike.colour`.
- Geometry drawing: a side-view schematic from the geometry values; values the bike lacks are drawn as typical ones (a medium road bike) and marked so. Only the selected row's line is highlighted. It is not to scale for the fork.
- Garage names stay the profile names ("Brightwater City 8" etc.; C's `bike_name` made them read as bike names).
- The "Do it now" action of a service row opens the tutorial (or the job screen), on that bike, with no bike choice.
- Swipe uses pointer events, so it also works with a mouse; one open row at a time is not enforced.
- The unit of `kmPerWeek` input is limited to 0 to 2000.

## Questions for the owner

1. The service rows run `app.start` for the job, so a "Do it now" on a job that has a tutorial starts the tutorial without the diagnosis. Fine? Recommended: yes.
2. Keep both the Facts and Components tabs? See the choice above; recommended: keep both for one test round, then decide.

## Next steps (A2 and later)

1. A2 edits `ui/app.ts` and `ui/flow.ts` too. `renderBike` moved out of `home.ts` into `ui/bike.ts`; `confirmDelete` lives on `App`.
2. Landscape: the bike page is two columns (preview left, sticky) below 560 px height. The garage list was not changed for landscape.
3. Not done, on purpose: real bike database and online lookup, shop search, the assistant (it still shows its context).
4. Owner: look at the bike page on a phone (preview drag, colour, geometry rows, service tab).

## Gotchas

- The stage element exists once. The bike page calls `stage.preview(...)` only when the facts changed; otherwise it moves the stage element into the new host (`previewSig` in `bike.ts`). `App.render` ends the preview on every other screen except a journey, where `show()` does it.
- `h()` has no `#id`; put the test hooks in `data-test`.
- Writing JS patch scripts: a `'\n'` inside a template literal in a heredoc ended up as a real newline once; use Edit for such lines.
- `npm run test:e2e` takes about 3 minutes; screenshots of the new screens are in `player/e2e/shots/portrait/bike-page/` and `.../extras/`.
