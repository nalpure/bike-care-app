# Session C (flows and content): progress

## Status

Parts 1 and 2 of 3 done. Next: part 3, data the app sessions need.

## Done

- Part 1 (shifting flow): `3f3f6a6` mention rule, torch gone · `c2457c0` tool tiers · `c9c3495` no `do_not_use` · `b42d2e7` SR-07 enum, `93ef37e` clockwise wording and limit screw method · `3e12b8c` questions name the part, `help` · `a898fa5` rapid-rise removed · `b8a0574` H fix text.
- 2.1 `79b3686` Tutorial `checks`: `derailleur-alignment` and `barrel-adjuster-present` written once in `tutorial.yaml`, run before the case's sequence. Replaces `entry.requires_finding` / `not_needed_message` (an outcome can `exit: { kind: not_needed }`); `entry.parts` is now `parts`.
- 2.2 `bbb2e6a` Coverage once: `covers` on the job; the tutorial reads it before any case, the diagnosis with `covers_like`. One text per uncovered bike.
- 2.3 `89c5c7b` Tutorial id, job and `job.tutorial` come from the folder name; diagnosis `override`, `if_unknown: ask` on tutorial and diagnosis, rule `too-many-buttons` and `schema/3d-catalog.yaml` removed; empty tool lists dropped.

## Interfaces other sessions rely on

- **Tools**: `tools[]` `{ id, name, kind, mentions?, substitutes? }`; `tool_sets[]` `{ id, name, tell_apart, options: [{ tool, when? }] }`; step/inspection `tools: { required?, one_of?: [setId], helpful? }`. Resolver `ToolList = { required, one_of: ToolSetUse[], helpful }`, `ToolSetUse = { set, options, decided }`; `mergeTools`, `toolSetUse`. Tools screen `{ kind: 'tools', required, oneOf, helpful, ticked, canBack }`.
- **Facts**: optional `help: { en, de }`; `drive.rear_derailleur_screws` (`cross | hex`, `ask: never`).
- **Animation `direction`**: `clockwise, counterclockwise, forward, backward, towards_spokes, away_from_spokes, up, down`.
- **Jobs** (bundle): `{ id, title, shop, tutorial?, covers? }`. `tutorial` is filled in by the build when `content/tutorials/<id>/` exists. `covers: { when, not_covered: [{ when, text }] }`.
- **Tutorials** (bundle): `{ id, job, difficulty, choices?, parts?, checks?: [{ inspect, outcomes }], cases }`. `id` = `job` = folder name. Cases have `include` (inlined as `case`) or nested `cases`; no `exit`. `entry` and `if_unknown` are gone.
- **Diagnoses** (bundle): `{ id, symptom, covers_like?, checks: [{ inspect }], no_hit }`. `applies_when`, `not_covered`, `if_unknown`, `override` are gone.
- **Resolver** (`tools/lib/resolve.ts`): new `coverageExit(ix, jobId, reader, params?, loc?)` returns `undefined` or the `not_covered` exit. `resolveTutorial` calls it first, then picks the case and puts `t.checks` in front of the case's sequence. `resolveDiagnosis` calls it for `covers_like`.
- **Player** (`engine/journey.ts`): the "Is this needed?" screen, `neededCheck`, `neededAnswer`, `fromFinding` and the `fromFinding` start option are gone. Parts screen reads `def.parts`.
- **3D names**: only `build/3d-manifest.json`; `npm run check` fails with `missing-file` without it.

## Choices made without the owner

- Part 1 choices stand (see `b8a0574` version of this file): mention rule reads all card text; tool sets defined once in `tools.yaml`; screwdriver and hex key without sizes (R-17); "in line with"; barrel adjuster seen from the cable side (R-01); `dirSign` keeps its free-text fallback; torch removed from the catalog.
- Uncovered-bike texts merged from the tutorial's and the diagnosis's versions (`content/jobs.yaml`). They now say only why; the shop and assistant come from the screen. Small wording change the user sees.
- Tutorial `checks` must be hands-off and cannot jump (rules `hands-off-only`, `exit-jump-outside`). A tutorial now has no mechanism branch when its job covers one mechanism.
- Kept although no content uses them, because the next content needs them: `params` (front/rear, brakes), step `when` / `if_unknown` / `generic_text`, button `when`, `skips`, `parts`.
- Kept as two steps: `check-cable-tension` / `-riding` and `check-all-gears` / `-riding` share labels and solutions. One step would need a text-variant construct and would be harder to review.
- Removed `player/test/stage.test.ts`'s check against the old catalog (S had finished).

## Questions for the owner

1. RO-04: your limit-screw note breaks off: "… turned counter clockwise to get …". Recommended: "… to get the chain to run quietly on that sprocket", as the steps say now.

## Next steps

1. Part 3.1 facts (`content/facts.yaml`, `schema/facts.schema.json`): the shared names table in `prompts/04-plan.md`; `label: { en, de }` on every fact (SR-02: implement, remove from `docs/schema-requests.md`, update the README line "labels facts by their question until SR-02"); a group label and icon id per group (key before the first dot); `unit`, `min`, `max` for numbers. Use S's names `drive.shifter_model`, `drive.cassette_model`, `drive.chain_model`, `drive.crankset_model` (`player/src/stage/registry.ts`, `model_fact`). Compare ranges with `GEOMETRY_RANGES` in `player/src/stage/bike.ts`; say in the handoff where they came from. Detail facts get no question (hard rule 11); check what `fact-needs-question` and the question schema require.
2. Part 3.2: `service: { interval_km }` on `adjust-rear-shifting` and `chain-care`, placeholder numbers marked unverified, entry in `content/review/adjust-rear-shifting.md` (and a chain-care note).
3. Part 3.3: `demo_bikes` in the bundle (`tools/lib/output.ts` / `bundle.ts`): profile names and facts; give profiles brand, model, year (invented names); the app never reads journeys.
4. Done-when list of `prompts/04-c-content.md`: verify, read the shifting cards as a beginner, list every bundle change above.

## Gotchas

- No Python. Patch with small node scripts in `$TMP` and `<<'EOF'`; a template literal containing backticks breaks the script. For those lines use Read and Edit.
- Re-serialising a JSON schema with `JSON.stringify` expands it and loses `\\.` escapes; edit schemas as text.
- `npm run test:e2e` takes about 2 minutes. Run it whenever the bundle changes.
- Test sandboxes (`tools/test/helpers.ts`) copy `schema`, `content`, `profiles` and `build/3d-manifest.json`.
- A test that makes a job not cover some bike trips `coverage` twice: once for the tutorial and once for the diagnosis.
