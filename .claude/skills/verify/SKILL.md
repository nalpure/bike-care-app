---
name: verify
description: Run this repo's full verification (content check, unit tests, e2e journeys, a few screenshots) and report the results honestly. Use before every commit that changes content, the build tool or the player, and whenever asked to verify.
---

# Verify

Run from the repo root. In the Bash tool, prefix every command with `export PATH="/c/Program Files/nodejs:$PATH" &&`.

1. `npm run check`. It must print `check passed`. On errors, fix them from the message and run it again.
2. If `player/src/stage/registry.ts` changed: `npm run manifest`, then `npm run check` again.
3. `npm test` (never `npx vitest`).
4. If anything under `player/` or `build/bundle.json` changed: `npm run test:e2e`, once. It is slow and keeps the machine busy for other sessions, so do not repeat it to be sure. While fixing a failure, re-run only that journey with `npm run test:e2e -- --no-build --only <id>` (add the build back after a change under `player/src/`), then run the full set once before you commit. Then read 2 to 4 PNGs in `player/e2e/shots/` that show the screens you changed (portrait and landscape where layout matters). Profile journeys run in text-only mode; only `road-bike-stand/chain-touches-spokes` and the `extras/` journeys show the 3D view.
5. If anything under `player/src/stage/` changed: `npm run build && npm run shots -- --only road`, and read the PNGs in `player/e2e/shots/slow/` for the views you changed.
6. `npm run typecheck` if you changed TypeScript.

Report one line per command: passed, or failed with the first error lines quoted. Never say something passed without running it. If you skipped a step, say which one and why.
