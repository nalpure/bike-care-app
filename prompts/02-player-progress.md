# Prompt 2: progress and handoff

Prompt 2 (the player, `prompts/02-player-frontend-prompt.md`) is **finished** (2026-11-18). It was done in three parts with the context cleared in between (owner decision, 2026-11-17).

| Part | Scope | Status |
| --- | --- | --- |
| 1 | Shared resolver; milestones 1–3; the logic of milestone 6 (exits, jump ahead); journey tests | done (2026-11-17) |
| 2 | Milestones 4–5: 3D stage ported from the prototype, focus, views, clips, state, `build/3d-manifest.json` | done (2026-11-17) |
| 3 | Exit screens with 3D (A-31), static build checked from a plain host under a subpath, short-landscape layout, tags that don't overlap, `_headers`, `docs/sharing.md`, `npm run shots`, `player/README.md` | done (2026-11-18) |

To continue work on the player, read `player/README.md`: the code map, commands, the recipe for changing the 3D bike, and the known gaps. Publishing and tester feedback are in `docs/sharing.md`.

## Owner decisions for this prompt

- Stack: Vite + TypeScript + three.js, no UI framework. No React, no Next.js.
- Hosting: Netlify for now; Cloudflare Pages with Access when access must be limited (`docs/sharing.md`). The repo stays private.
- Feedback notes: copied or shared as text by the tester; no address built in.
- Playwright with Chromium is a dev dependency (`npm run test:e2e`, `npm run shots`).
- `tools/lib/journeys.ts` stays an independent implementation; the player tests compare against it.
- Screenshot passes: the agent looks only at critical screens; the owner clicks through everything (2026-11-18).
