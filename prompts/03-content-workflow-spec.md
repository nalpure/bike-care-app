# Prompt 3: build the content workflow (orchestrator, subagents, checkers)

## Your task

Implement, in this repository, a repeatable workflow that turns a short brief ("symptom: my brake squeals" or "job: replace brake pads") into checked content in `content/`. An orchestrator splits the work into small units, subagents each solve one unit, the build tool gates every write, and separate reviewer subagents check the result by reading generated walkthroughs.

You are implementing the workflow, not writing bike content. Use Claude Code's own mechanisms (subagent definitions, custom commands, hooks, headless runs). Check the current Claude Code documentation for their exact formats before you write them.

Read `CLAUDE.md`, `docs/idea.md`, `docs/approach.md` and the output of prompt 1 first. Everything below marked **Requirement** must hold. Everything marked **Idea** is a suggestion: keep it, change it or drop it, and write your reasoning to `docs/workflow-decisions.md`.

## Why this exists

A first attempt had one agent write a whole tutorial for five brake types in one run. The content was competent, but the agent invented notation while writing, produced 23 questions for humans, and checked its own work. The fixes are a fixed schema (done in prompt 1), small units of work, and reviewers that never see the writer's context.

## Requirements

1. **One command starts a run** from a brief file. A run has an id and a folder `runs/<id>/` holding the plan, each unit's output, findings and a log.
2. **Small units.** No subagent writes more than one of: a set of inspections for one component, one tutorial case (one mechanism), one diagnosis, one shared procedure, one research row.
3. **Writers and reviewers never share context.** A reviewer gets only generated walkthroughs and source pages.
4. **The build tool is the gate.** After every content write, `npm run check` runs and its errors go back to the agent that wrote. A unit is not finished while the check fails.
5. **No schema invention.** A writer that needs a new construct files a request and uses the closest allowed form.
6. **No questions mid-run.** Unknowns become assumptions with a cautious default and an id, collected per run.
7. **Coverage is explicit.** The plan states which bikes and components the run covers. Everything else must end at `not_covered` or a shop exit, with a clear message. A small, honest scope beats a wide, shaky one.
8. **Safety values are never invented** and never taken from a writer's memory. They come from a research row with a saved source, or the text sends the user to the part.
9. **Humans get three short files at the end of a run,** nothing else: `owner-decisions.md` (each with a recommended default), `mechanic-sheet.md` (claims to confirm, with source and affected step ids, plus the walkthroughs to read), and `summary.md` (what was built, coverage, open findings).
10. **Reruns are cheap.** Changing one unit re-checks and re-reviews only the paths that changed.

## Proposed stages (Idea)

| Stage | Who | Input | Output |
| --- | --- | --- | --- |
| 1 Plan | Planner subagent | Brief, existing content, `profiles/` | `plan.yaml`: units, their order, covered and not-covered fact combinations, which existing steps and inspections to reuse |
| 2 Research | One researcher per component family, with web access | One family from the plan | A row per family in `content/knowledge/` with the saved source page; "not found" is a valid result |
| 3 Write | One writer per unit, no web access | Schema, `CLAUDE.md`, one golden example, the unit from the plan, relevant knowledge rows | Content files for that unit |
| 4 Gate | Build tool via hook | Content | Pass, or errors back to the writer |
| 5 Review | Reviewer subagents, read-only | One walkthrough each, plus sources | Findings as JSON |
| 6 Fix | The unit's writer | Findings for its unit | Revised content; at most three rounds, then the finding goes to a human file |
| 7 Report | Orchestrator | Everything | The three human files |

**Idea: a pause after stage 1.** The plan is the cheapest place for the owner to correct scope. Offer a flag to run without the pause.

**Idea: splitting by component.** For a brake job, units could be: inspections for disc brakes, inspections for rim brakes, case hydraulic disc, case mechanical disc, case cable rim, case hydraulic rim, shared procedure wheel removal. Research units follow part families (for example one brake series of one maker). Whether research is worth running for a given job is the planner's call; a shifting adjustment needs little, a pad change needs pad shapes and retainers.

**Idea: profiles as the test set.** `profiles/` holds real bikes, including the bikes of the friends who will test the app. The planner reads them to decide coverage, and every run reports where each profile ends up.

## Checking generated content

The build tool already expands every path and writes one walkthrough per path. Use that as the review interface.

**Requirement:** reviewers read walkthroughs, not YAML. A finding must name the path id and the step or inspection id, a severity (critical, major, minor), the problem in one or two sentences, and a concrete suggestion.

**Ideas:**

- **Path selection script.** There can be many paths. Add a script that picks a small covering set: every step, every button, every block, every stop with and without jump ahead, and every not-covered exit appears in at least one selected walkthrough. Always include the profile journeys.
- **One reviewer per walkthrough, per role.** Roles could be:
  - Mechanic: order of work, missing steps, anything unsafe, claims that differ from the saved sources.
  - Beginner: sees only what the user sees. Flags unclear words, buttons that need judgement, steps where they would not know where to look.
  - Journey: reads a whole profile journey from symptom to end and flags repeated questions, dead ends and wrong time estimates.
- **Slices for shared pieces.** A shared step or inspection appears in many paths. A script could output, per shared id, the three or four contexts it appears in, so one reviewer can judge whether its wording works in all of them.
- **Dedupe and route.** The orchestrator merges findings by id, drops duplicates, and sends each to the writer of the owning unit.
- **Does the reviewer catch anything?** Occasionally seed a known fault into a copy of finished content (loosen and tighten swapped, a safety check removed) and see whether review finds it. Use this to tune reviewer prompts, not to skip human sign-off.
- **Changed-path detection.** Hash each walkthrough. After a fix, only walkthroughs whose hash changed go back to review, and only those are marked for a new mechanic signature.

## Subagent definitions

**Requirement:** one definition per role with only the tools it needs: researchers can browse but not write content; writers can write content but not browse; reviewers are read-only.

**Idea:** keep each role's prompt short and point it at the files it must read. Put the writing rules in one shared file (`docs/writing-rules.md`), taken from `approach.md` and the two authoring prompts in `legacy/`.

## Converting the old brake pad files

`legacy/brake-pads-replace.yaml` and `legacy/inspections.yaml` are good raw material in an outdated format. **Requirement:** support a brief of type "convert", where the planner maps the legacy file onto units and writers adapt existing texts instead of writing from nothing. The list of needed changes is in `approach.md`, section "Changes to the existing YAML files". Use this conversion as the first real test of the workflow.

## Done when

- A run on the brief "symptom: my gears don't shift cleanly, improve the existing golden example" completes without human input after the plan, passes the build, and produces the three human files.
- A "convert" run on the legacy brake pad files produces content that passes the build for at least the hydraulic disc and cable rim cases, with everything else marked not covered.
- `docs/workflow.md` explains in one page how to start a run, where its output lands and how to rerun one unit.
- `docs/workflow-decisions.md` lists which ideas above you kept, changed or dropped, and why.

## Challenge this spec

If a requirement seems wrong or a simpler design would do, say so in `docs/workflow-decisions.md` before building. In particular, consider whether the orchestrator should be a Claude Code session following a command, or a script that starts headless runs, and choose the one that is easier to rerun and to debug.
