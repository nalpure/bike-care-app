# Bike care app

A phone app that helps a beginner find out what is wrong with their bike and fix it, step by step, with a 3D view of the part. Test build: https://bike-care-app.netlify.app/

The rule behind it: **all repair knowledge lives in `content/`; the player has none.** The build tool checks the content and writes the bundle the player reads.

## The map

**[`docs/architecture/overview.md`](docs/architecture/overview.md)** shows the whole structure on one page: the areas and their folders, how data flows from content and 3D models to the app, which guide and which skill an agent uses for which task, the commands, and the tools that already exist.

## How work is done

There are no session prompt files. You describe a task in chat; for a big one the agent proposes a plan and a split into parts and waits for your okay. All state is in:

- **`git log`**: what was done.
- **the agent's final message**: the choices it made without you, each asked as a question with enough context to answer it. Nothing is kept in a file of choices or decisions; an answer that matters later becomes a rule where it applies (a guide, a job file, `docs/architecture/content-model.md`, or `docs/architecture/planned.md` while not built).
- **the `CLAUDE.md` guides**: how each area works, kept short and next to its code, so an agent loads only the area it works in. The root `CLAUDE.md` has only the rules for every agent.
- **the skills** in `.claude/skills/`: step-by-step recipes (finish a task, change content, check the 3D view, deploy the test build, verify, add a 3D part).

Before every commit the `verify` skill runs the checks (`npm run check`, `npm test`, and for player changes the e2e journeys plus a few screenshots).

## Pictures

No picture is committed except the model textures in `assets-src/`. Screenshots and probe images are written to `scratch/` by the agent that asks for them, are read only by that agent, and are regenerated on demand.
