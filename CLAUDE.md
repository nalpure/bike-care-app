# Bike maintenance app: repo guide for agents

Read `docs/idea.md` (what the app is) and `docs/approach.md` (how content and player work) before any task. They win over anything in `legacy/`.

## Layout

```
docs/            idea.md, approach.md, assumptions.md, schema-requests.md
legacy/          old prototype HTML and the brake pad YAML drafts. Reference only, never imported.
schema/          JSON Schema for every content file
content/         facts.yaml, tools.yaml, inspections.yaml, jobs.yaml, steps/, procedures.yaml,
                 tutorials/<job>/, diagnoses/, checks/, review/
profiles/        test bikes (facts + tool choices), one YAML each
tools/           build script: validate, expand, simulate, walkthroughs, bundle
build/           generated: bundle.json, walkthroughs/, report.md (never edited by hand)
player/          the web app (Vite, TypeScript, three.js)
.claude/         subagent definitions, commands, hooks for the content workflow
```

## Commands

- `npm run check`  validate, expand, simulate, write `build/`. Must pass before any task is done.
- `npm run dev`    start the player locally.
- `npm run build`  static build of the player for sharing.

## Hard rules

1. Repair content lives in `content/` only. The player contains no repair text and no bike-specific logic.
2. Do not invent schema constructs. If the schema cannot express something, add an entry to `docs/schema-requests.md` and use the closest allowed form.
3. Never invent safety values (torque, fluid, wear limits, part compatibility). Use a placeholder with wording that sends the user to the part.
4. At most three state buttons per screen. Labels describe what the user sees, never a technical judgement.
5. `block` and `stop` only in safety checks and inspection calls. A stop reached with something apart names what to put back and has `show_how_from`.
6. Diagnoses and the routine check use only `hands_off` inspections.
7. Not everything is covered. Any bike, part or symptom outside the content ends on a clear "not covered yet" screen that offers a shop and the assistant. Never show a guess.
8. Do not stop to ask the owner. Write the assumption with a cautious default to `docs/assumptions.md` and continue.
9. Mechanics in this repo are unverified drafts. The test build shows a notice saying so.
10. Texts are written in English, short, one action per step, easy to translate into German.
