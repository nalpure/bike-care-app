# Player: guide for agents

The player is the web app that plays `build/bundle.json`. Vite, TypeScript, three.js, no UI framework, no backend. It holds no repair text and no bike-specific logic (hard rule 1): everything shown comes from the bundle. When the bundle lacks something, write a schema request; don't hard-code it. Neutral UI wording ("Which one?", "Do not ride") is fine.

Each part has its own guide that loads when you work in it: `src/engine/CLAUDE.md` (journey state machine, storage, bikes), `src/ui/CLAUDE.md` (screens, navigation, assistant), `src/stage/CLAUDE.md` (3D view). Read the one for your task, not the others.

## Rules

- Keep `engine/` free of the DOM. The UI only renders `Journey.screen()` and calls its actions.
- Screenshots go to `scratch/shots/` (every run wipes them; they are never committed). Look at a few critical screens only (2 to 4: a new layout, a 3D view you just changed, both orientations where it matters). The owner clicks through the rest.
- When you change which bike `bikeSpec` draws, write the rule as a comment in `spec.ts` and list it in `docs/open.md`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server; reads `build/bundle.json` live (run `npm run check` after content changes) |
| `npm run build` | Static site in `dist/`; publishing is described in `docs/sharing.md` |
| `npm run typecheck` | `tsc` for the tools and the player |
| `npm test` | Vitest: build tool tests and `player/test/` (engine, all profile journeys, 3D registry). On Windows only through `npm test` |
| `npm run test:e2e` | Builds the player, clicks every profile journey in headless Chromium (portrait and landscape), compares endings with `build/report.md`. Screenshots in `scratch/shots/`. `-- --no-build` reuses `dist/`; `-- --only <words>` runs only the journeys whose id contains one of the comma-separated words. Profile journeys run text-only, except those in `WITH_3D` (`run.ts`); the `extras/` keep the 3D view |
| `npm run shots` | 3D screenshots, see `src/stage/CLAUDE.md` |

Before you commit: the `verify` skill. Run commands from the repo root.

## How it fits together

```
build/bundle.json --fetch--> engine/content.ts (Content: lookups, text filling)
                                   |
tools/lib/resolve.ts  ----->  engine/journey.ts (Journey: state machine, no DOM) <--- engine/store.ts (localStorage)
tools/lib/conditions.ts            |  screen(): Screen  (what to show; one union type)
                                   v
                              ui/app.ts (shell, tabs, overlays) -> ui/flow.ts (journey screens, card) / ui/home.ts (home, garage list)
                                   |                                  ui/pick.ts (which bike, before a flow) / ui/bike.ts (bike page) / ui/swipe.ts
                                   |                                  ui/assistant.ts (floating button) / ui/edge.ts (edge swipe back)
                                   |  stage.show(StageView)
                                   v
                              stage/three-stage.ts (ThreeStage)  or  ui/stage.ts (PlaceholderStage)
```

## Other known gaps

- Shop search and the Shop tab are placeholders by design. The assistant panel only shows the context it would receive.
- Question pictures are grey tiles until SR-03.
- Service intervals are unverified placeholders from the content; the lights only mean something once they are checked.
- The bike page's 3D preview and the garage pictures need the 3D stage; with `PlaceholderStage` they are left out.
- `npm audit` reports a ReDoS in `picomatch` (dev tools only, nothing in `dist/`).

Owner decisions are in `docs/decisions.md`; open schema requests in `docs/schema-requests.md`. Smaller choices are explained in comments where they are implemented.
