# Session C (flows and content): progress

## Status

Part 1 of 3 done (the shifting flow). Next: part 2, simplify the structure.

## Done

- 1.1 `3f3f6a6` Rule `tool-not-mentioned`: a listed tool must be named in the card text. Torch removed everywhere.
- 1.2 `c2457c0` Three tool tiers; `derailleur-screw-tool` is now a tool set of `small-cross-screwdriver` and `small-hex-keys`.
- 1.3 `c9c3495` `do_not_use` removed; the thin-string warning is in `hang-bike`'s text.
- 1.4 `b42d2e7` SR-07: `direction` is an enum; `dirSign` maps it. `93ef37e` Clockwise wording everywhere.
- 1.5 `93ef37e` Owner's limit screw method; new step `check-low-limit`; hand push kept after L as a double-check.
- 1.6 `3e12b8c` Questions name the part; `help` on facts.
- 1.7 `a898fa5` Rapid-rise removed (fact, exits, profile `mtb-rapid-rise`, review notes).

## Interfaces other sessions rely on

- **Tools in the bundle.** `tools[]`: `{ id, name, kind, mentions?: string[], substitutes? }`. `do_not_use` is gone.
  New list `tool_sets[]`: `{ id, name, tell_apart, options: [{ tool, when? }] }`.
  Step and inspection `tools`: `{ required?, one_of?: [toolSetId], helpful? }`.
- **Resolver** (`tools/lib/resolve.ts`): `PathItem.tools` is `ToolList = { required: string[], one_of: ToolSetUse[], helpful: string[] }`,
  with `ToolSetUse = { set, options: string[], decided: boolean }`. `decided` is true when the bike's data picked the options,
  and then only those are listed; otherwise all options, and the UI shows the set's `tell_apart`.
  `mergeTools(lists)` merges a path's lists. `toolSetUse(ix, id, reader)` resolves one set. `Index.tool_sets` is a map.
- **Player tools screen**: `Screen` `{ kind: 'tools', required, oneOf: ToolSetUse[], helpful, ticked, canBack }`.
  `ui/flow.ts` `renderTools` is a minimal version for A2 to replace.
- **Facts**: optional `help: { en, de }`. New fact `drive.rear_derailleur_screws` (enum `cross | hex`, `ask: never`).
  `drive.rear_derailleur_type` is gone.
- **Animation `direction`** is one of `clockwise, counterclockwise, forward, backward, towards_spokes, away_from_spokes, up, down`.
- **Steps**: new `check-low-limit` (buttons `in-line`, `too-far-in` block, `rattles`). `check-high-limit` buttons: `in-line`,
  `too-far-out` block, `rattles`. `check-low-limit-by-hand` now has only `in-line` and `too-far-in`.

## Choices made without the owner

- Mention rule reads the step text, `generic_text`, details, and button labels, texts, blocks and exit texts (an inspection's state labels and meanings). For a tool set, naming one option is enough. (`tools/lib/refs.ts`, `cardText`)
- Tool sets are defined once in `tools.yaml` (`tool_sets`), not inline on steps, so the "how to tell" text is written once. An option's `when` may only read `ask: never` facts (rule `tool-set-when`).
- Screwdriver and hex keys have no sizes; the review note R-17 asks a mechanic. Their substitutes are the matching multi-tool.
- Positions stay "in line with", not "right under" (the owner's words), because the bike may be upside down.
- Barrel adjuster turns are seen "from the side where the cable goes in" (R-01 asks a mechanic).
- Turning the bike over has no `direction` (the enum has none for it; the stage takes the poses).
- `dirSign` keeps its free-text fallback after the enum map, so S's tests stay valid.
- The test-ride case uses the same order as the wheel-free case; the ride into the largest sprocket warns to stop pedalling.
- The torch is removed from the catalog entirely, not only from steps.

## Questions for the owner

1. RO-04: your note on the limit screws breaks off: "… the screw must be turned counter clockwise to get …". How does it end? Recommended: "… to get the chain to run quietly on that sprocket", as the steps say now.

## Next steps

1. Part 2.1: declare `derailleur-alignment` (and `barrel-adjuster-present`) once per tutorial. Plan: a tutorial-level list of inspection items run before the chosen case's sequence, resolved in `resolve.ts` so the player gets it too; hard rule 12 already hides it after a diagnosis because it comes before any step.
2. Part 2.2: coverage once. Plan: `covers: { when, not_covered: [{ when, text }] }` on the job; the tutorial's top-level not-covered cases and the diagnosis's `applies_when` and `not_covered` read it.
3. Part 2.3: look for duplicated conditions and texts, unused fields (`if_unknown: ask` on tutorials and diagnoses has one value), `schema/3d-catalog.yaml` (the manifest replaced it; test sandboxes need `build/3d-manifest.json` then).
4. Part 3: labels, groups, units and ranges on facts (S used `drive.shifter_model`, `drive.cassette_model`, `drive.chain_model`, `drive.crankset_model`; compare ranges with `GEOMETRY_RANGES` in `player/src/stage/bike.ts`), `service` on jobs, `demo_bikes` with invented brands (owner).

## Gotchas

- No Python. Patch with small node scripts in `$TMP`; heredocs with backticks need `<<'EOF'`.
- `npm run test:e2e` takes about 2 minutes. Run it whenever the bundle changes.
- After a `sed` on a file, Read it again before using the Edit tool.
- A test that makes a tutorial "not covered" for some bike also trips `diagnosis-tutorial-coverage`.
