# Round 4: improvements after the first working version

The owner tested the first working version and wrote notes on flows, app behaviour and the 3D view. This round turns them into four sessions. Each session has its own prompt file and writes its own handoff file. Prompt 3 (the content workflow) comes after this round, so its writer agents inherit the new rules.

## Sessions

| Session | Prompt | Works in | Handoff file |
| --- | --- | --- | --- |
| C: flows and content | `04-c-content.md` | `content/`, `schema/`, `tools/`, `profiles/`; small fixes in `player/src/engine` and `ui` to keep the tests green | `04-c-content-progress.md` |
| S: 3D view | `04-s-3d.md` | `player/src/stage/`, `player/test/stage.test.ts`, `build/3d-manifest.json` | `04-s-3d-progress.md` |
| A1: bikes and garage | `04-a1-garage.md` | `player/src/engine`, `player/src/ui`, `player/e2e` | `04-a1-garage-progress.md` |
| A2: navigation and polish | `04-a2-navigation.md` | `player/src/ui`, `player/src/engine`, `player/e2e` | `04-a2-navigation-progress.md` |

## Order

1. **Phase 1:** C and S at the same time, in separate checkouts (setup below). Their folders do not overlap. The only shared file is `player/src/stage/anim.ts`: C changes only `dirSign` (the turning direction), S leaves `dirSign` alone.
2. **Phase 2:** A1, then A2, in the main checkout. A1 needs C's bundle changes and S's preview mode. A2 needs A1, because both edit `ui/app.ts` and `ui/flow.ts`.

A session that gets too large splits itself into parts: it writes its handoff file, and the owner clears the context and starts the next part with the same prompt.

## Setup for phase 1

C runs in the main checkout (`bike-app`, branch `main`). S runs in a second checkout:

```
cd C:\Users\bened\Documents\bike-app
git worktree add ../bike-app-3d -b round4-3d
cd ../bike-app-3d
npm install
```

Open `bike-app-3d` in a second VS Code window and start S there. Both sessions push to `main` as described in `CLAUDE.md` (Git). When S is finished and pushed: `git worktree remove ../bike-app-3d` and `git branch -D round4-3d`.

## Owner decisions for this round (2026-11-20)

- Turning instructions say clockwise or counterclockwise: "Turn the screw marked L clockwise a quarter turn." No build rule is needed for this; it is a writing rule in `content/CLAUDE.md`.
- `derailleur-alignment` stays in the tutorial for users who open it directly. It is declared once, not in each case file.
- Rapid-rise (low-normal) derailleurs are dropped entirely: too rare.
- Service intervals start as unverified placeholder values.
- The complete-bike lookup (database, then an AI web search) is a stub in the test build.
- Agents never record their own decisions in `docs/`. See "Decisions" in `CLAUDE.md`.

## Shared names (fixed now, so C and S can work at the same time)

C adds these facts to `content/facts.yaml`. S and A1 read them. They are detail facts: no condition reads them, so they get no question (hard rule 11), but they get a short label.

| Key | Type | Values or unit |
| --- | --- | --- |
| `bike.brand`, `bike.model`, `bike.line` | text | free text |
| `bike.year` | number | year |
| `bike.handlebar` | enum | `drop`, `flat`, `riser`, `unknown` |
| `bike.colour` | text | frame colour as `#rrggbb`, chosen in the garage |
| `geometry.stack_mm`, `geometry.reach_mm`, `geometry.head_tube_mm`, `geometry.seat_tube_mm`, `geometry.top_tube_mm` (effective), `geometry.chainstay_mm`, `geometry.wheelbase_mm`, `geometry.bb_drop_mm` | number | mm |
| `geometry.head_angle_deg`, `geometry.seat_angle_deg` | number | degrees |
| `geometry.wheel_bsd_mm` | number | ISO bead seat diameter: 559, 584 or 622 |

- Part model names are text facts ending in `_model`, like the existing `drive.rear_derailleur_model`.
- S links a 3D node to its model fact with a `model_fact` field on `NODES` in `player/src/stage/registry.ts`.
- A fact's group is the part of its key before the first dot (`bike`, `drive`, `geometry`, …). C gives each group a label and an icon id in `facts.yaml`.

## Not in this round

- The real bike database and the AI lookup, real shop search, and the assistant itself (it stays a panel that shows its context).
- New repair content beyond the rear-shifting example.
- Prompt 3 (the content workflow).
