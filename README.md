# Bike maintenance app

A phone app that helps a beginner find out what is wrong with their bike and fix it, step by step, with a 3D view of the part. Test build: https://iridescent-moonbeam-15ddc0.netlify.app/ (mechanics are unverified drafts; the app says so).

## How it fits together

```
 content/ + profiles/ + schema/ ──► npm run check ──► build/bundle.json ──► player/ (the app)
 (all repair text, YAML)            (tools/check.ts)   + build/review/        reads only the bundle
                                                         (what reviewers read)

 assets-src/ (3D models) ──► npm run parts ──► player/public/parts/ (parts library) ──► 3D view in player/
```

The rule behind it: **all repair knowledge lives in `content/`; the player has none.** The build tool checks the content and writes the bundle the player reads.

## Where things are

| Folder | What | Guide |
| --- | --- | --- |
| `docs/` | `idea.md` what the app should be, `decisions.md` what you decided, `open.md` what is still undecided (agent choices and questions for you) | |
| `content/`, `profiles/`, `schema/` | repair content, test bikes, the JSON Schema for every field | `content/CLAUDE.md` |
| `tools/` | the build tool, review sign-off, path viewer, clean-up | `tools/CLAUDE.md` |
| `tools/assets/` | turns source 3D models into the parts library | `tools/assets/CLAUDE.md` |
| `player/` | the web app (Vite, TypeScript, three.js) | `player/README.md`, `player/CLAUDE.md` |
| `build/` | generated, committed, never edited by hand | |
| `reviews/` | sign-offs of review units | |
| `assets-src/` | source 3D models (CC BY) | `assets-src/overview.md` |
| `legacy/` | the old prototype, reference only | |
| `scratch/` | git-ignored, agent throw-away. Delete freely (`npm run clean`) | |

## How work is done

There are no session prompt files. You describe a task in chat; for a big one the agent proposes a plan and a split into parts and waits for your okay. All state is in:

- **`git log`**: what was done.
- **`docs/open.md`**: what agents chose without you and what they want you to answer. Answer an item and it moves to `decisions.md` or disappears.
- **`docs/decisions.md`**: your decisions.
- **the `CLAUDE.md` guides**: how each area works, kept short so an agent loads only the area it works in.

Before every commit the `verify` skill runs the checks (`npm run check`, `npm test`, and for player changes the e2e journeys plus a few screenshots).

## Commands

`npm run check` (validate content, write `build/`), `npm test`, `npm run dev` (run the app), `npm run build` (static build), `npm run clean` (delete scratch and dist). The full list, with the 3D and review commands, is in `CLAUDE.md`.

## Pictures

No picture is committed except the model textures in `assets-src/`. Screenshots and probe images are written to `scratch/` by the agent that asks for them, are read only by that agent, and are regenerated on demand.
