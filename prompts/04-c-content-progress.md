# Session C (flows and content): progress

## Status

Finished: parts 1 to 3 done. A1 can start once S is merged.

## Done

- Part 1 (shifting flow): `3f3f6a6` mention rule · `c2457c0` tool tiers · `c9c3495` no `do_not_use` · `b42d2e7`, `93ef37e` SR-07 and clockwise wording · `3e12b8c` questions name the part, `help` · `a898fa5` rapid-rise removed · `b8a0574` H fix text.
- Part 2 (structure): `79b3686` tutorial `checks` · `bbb2e6a` coverage once (`covers` on the job) · `89c5c7b` tutorial id from the folder, unused constructs removed.
- RO-04 answered: `8feceda` limit screws turn counterclockwise until the toothed wheel is in line and the chain runs quietly; beginner wording ("toothed wheel", not "wheel") in the last commit.
- Part 3: `07e9acc` fact labels, groups, shared names, ranges (SR-02 done) · `1bc7643` service intervals · `b36b627` `demo_bikes`.

## Interfaces other sessions rely on

- **Facts** (bundle `facts[]`): every fact has `label: { en, de? }`. Number facts may have `unit` (`mm` | `deg`), `min`, `max`, or a fixed `values` list of integers (`geometry.wheel_bsd_mm`: 559, 584, 622, with `answers` such as "28 or 29 inch, 700C (622 mm)"). Optional `help: { en, de }`. `drive.rear_derailleur_screws` is `cross | hex`, `ask: never`.
- **Fact groups** (bundle `fact_groups[]`): `{ id, label: { en, de }, icon }`; a fact's group is its key before the first dot. Now: `bike` (icon `bike`), `drive` (`drivetrain`), `geometry` (`geometry`). The build fails (`fact-group`) when a group has no entry or no facts.
- **Shared names** from `04-plan.md` all exist, plus `drive.shifter_model`, `drive.cassette_model`, `drive.chain_model`, `drive.crankset_model` (text). `bike.handlebar` values are `drop | flat | riser`; "unknown" is the general unknown, not a value.
- **Ranges** (min to max): stack 450–720, reach 330–520, head tube 80–260, seat tube 330–640, top tube 480–700, chainstay 390–520, wheelbase 900–1400, BB drop 0–90 (mm); head angle 62–76, seat angle 68–79 (deg); `bike.year` 1970–2030; `drive.rear_speeds` 1–13.
- **Jobs**: `{ id, title, shop, tutorial?, covers?, service? }`. `service: { interval_km, source }`; `source` `<source, date>` means unverified. Now `adjust-rear-shifting` 1500 km, `chain-care` 300 km.
- **demo_bikes** (bundle): `[{ id, name, facts }]`, one per profile that knows any fact (`city-derailleur-no-stand`, `e-trekking-hub-gear`, `road-bike-stand`). `name` is the profile name. No journeys, tools or answers.
- **Tools**: `tools[]` `{ id, name, kind, mentions?, substitutes? }`; `tool_sets[]` `{ id, name, tell_apart, options: [{ tool, when? }] }`; step/inspection `tools: { required?, one_of?: [setId], helpful? }`. Resolver `ToolList = { required, one_of: ToolSetUse[], helpful }`.
- **Tutorials**: `{ id, job, difficulty, choices?, parts?, checks?: [{ inspect, outcomes }], cases }`; **diagnoses**: `{ id, symptom, covers_like?, checks, no_hit }`; `coverageExit(ix, jobId, reader, params?, loc?)` in `tools/lib/resolve.ts`.
- **Animation `direction`**: `clockwise, counterclockwise, forward, backward, towards_spokes, away_from_spokes, up, down`.
- **Review units**: `card:fact-group:<id>` ("Bike sheet: …") replaces the per-fact "Bike record" cards. Question cards show the label.

## Choices made without the owner

- Part 1 and 2 choices stand (see the `89c5c7b` version of this file): mention rule, tool sets in `tools.yaml`, tool options without sizes (R-17), "in line with", merged uncovered-bike texts, kept unused-but-needed constructs, two riding/stand step pairs.
- Geometry ranges: typical published manufacturer geometry (road, gravel, MTB, trekking, city, XS to XXL), kept equal to S's `GEOMETRY_RANGES` where S has one. Cargo bikes can exceed wheelbase and chainstay; the app would refuse those. `bike.year` max 2030 needs raising later.
- Wheel size as a number with a fixed `values` list and answers, not an enum, so it stays a number as the plan says.
- Service intervals 1500 km (shifting) and 300 km (chain) are guesses; R-19 and C-01 (new `content/review/chain-care.md`) ask the mechanic.
- Demo bikes: invented brands (Brightwater City 8, Lindholm E-Tour 5, Corvana Strada SL 3); the unknown-bike profile is left out because it knows nothing; the garage names are the profile names ("Road bike with a work stand").
- Profile fact values may be decimals (`schema/profile.schema.json`), for a seat angle of 73.5.
- The player's bike sheet now shows `label` (`player/src/ui/home.ts`), one flat list; A1 builds the grouped garage.

## Questions for the owner

1. Demo bike names: keep the profile names, or give profiles a separate bike name (for example "Corvana Strada")? Recommended: a separate optional `bike_name`, if A1 finds the scenario names odd in the garage.

## Next steps

1. Owner: review the new cards (`build/review/cards.md`, "Bike sheet") and R-18/R-19/C-01 with a mechanic.
2. Session A1 (`prompts/04-a1-garage.md`) reads `fact_groups`, `label`, `min`/`max`, `service` and `demo_bikes` as above.

## Gotchas

- No Python. Patch with small node scripts in `$TMP` and `<<'EOF'`; a template literal containing backticks breaks the script, and a parse error applies nothing. For those lines use Edit.
- Re-serialising a JSON schema with `JSON.stringify` loses `\\.` escapes; edit schemas as text. Ajv strict mode wants `"type": "array"` next to `items`, even inside `then`.
- A test that counts errors breaks when profiles gain facts; match the exact messages instead.
- `npm run test:e2e` takes about 2 minutes. Run it whenever the bundle changes.
