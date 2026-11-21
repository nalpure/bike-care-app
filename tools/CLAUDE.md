# Build tool: guide for agents

`npm run check` runs `tools/check.ts`, which runs `lib/run.ts` in four stages. A stage runs only when the stages before it found no errors.

| Stage | Files |
| --- | --- |
| 1 Load and schema | `lib/content.ts`, `lib/schema.ts`, `lib/yamlfile.ts` (YAML 1.2, keeps lines for errors) |
| 2 References and static rules | `lib/refs.ts` |
| 3 Expand, simulate, coverage, profile journeys | `lib/expand.ts`, `lib/resolve.ts`, `lib/flows.ts`, `lib/journeys.ts` |
| 4 Output | `lib/output.ts`, `lib/render.ts` (what reviewers read), `lib/review.ts` (review units, hashes, ledger), `lib/bundle.ts` |

- **Shared with the player:** `lib/conditions.ts` and `lib/resolve.ts`. They are dependency-free and work on bundle data. Change them only with the player in mind, and run `npm test` (the player tests use them).
- **`lib/journeys.ts` is independent on purpose.** The player tests compare the app's journeys with it. Do not make one call the other.
- **A new rule:** add it to `lib/rules.ts` with a one-line meaning, report it through `lib/issues.ts` in the one-line format, and add a test in `test/check.test.ts`. `test/helpers.ts` copies the content to a temp folder so a test can break it on purpose.
- **A schema change touches:** `schema/*.schema.json`, the content, `render.ts` (so reviewers see the new field), the bundle, and the player if it reads the field. List any bundle change in your handoff file.
- **Output must stay deterministic** (no timestamps, stable order). `build/` is committed.
