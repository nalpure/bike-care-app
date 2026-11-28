# Bike maintenance app: rules for every agent

A phone app that helps a beginner diagnose and fix their bike step by step, with a 3D view of the part. All repair knowledge is YAML in `content/`; a build tool checks it and writes a bundle; the web app in `player/` plays it. Mechanics are unverified drafts.

**Read `docs/architecture/overview.md` first.** It is the map: the areas and their folders, how data flows, which guide and which skill to use for which task, and the tools that already exist. Each area's `CLAUDE.md` sits next to its code and loads when you work there; read only the one for your task.

## Working

- One task per session. If it needs a second area, do the first part, commit, and name the next part in your final message. A large task: read, propose the plan and its parts in a few lines, and wait for the owner's okay.
- **You own the documentation of what you write.** Whatever you change (content, code, a tool, a skill), you change its documentation in the same commit when it is needed: the area's guide, `docs/architecture/`, a skill, schema descriptions, code comments. No one else will. A trap you learnt goes into the area's guide as one line.
- A behaviour change starts with a failing test.
- Probes and pictures go in `scratch/` only (git-ignored). Edit files with the Edit tool, no patch scripts. Prefer a check that prints numbers to a picture.
- Run the `verify` skill before every commit that changes content, the build tool or the player. End every task, and each part of one, with the `finish-task` skill.
- The state of the work lives only in `git log` and the documentation next to what it describes. No session prompt files, no handoff files, no file of open choices or decisions. `archive/` holds the owner's old documents: do not read it.

## Choices and decisions

- **Questions first, then act.** Ask what you need before you start, in one batch. After that, take the cautious default and carry on; stop and ask only before a change that would be expensive to revert (rule 8).
- **Your choices become questions at the end of the session**, never entries in a file. Ask each as a clear question the owner can answer without opening the code: what you chose and why, what it affects, the other options, how to undo it, and your recommendation. Never write your own choice into the documentation as if the owner had decided it.
- **An owner answer** that will matter later goes where it applies, as a rule: the area's guide, the job file's header comment, `docs/architecture/content-model.md`, or `docs/architecture/planned.md` while it is not built. Only what the code, the schema and the check's rules do not already enforce. Never a decisions file or a log. Say where you put it in your final message.- A doubt about mechanics goes to `content/review/<job>.md`, never into the content as a fact; a missing schema construct to `docs/schema-requests.md` (rule 2).

## Git

Commit in logical steps and push every commit at once. Other sessions may push to `main` meanwhile (a worktree on its own branch): before every push run `git pull --rebase origin main`, then `git push origin HEAD:main`. If files in `build/` conflict, take either side, run `npm run manifest` and `npm run check`, and commit the result; never resolve them by hand.

## Windows

- In the Bash tool, Node is not on PATH: prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Run tests only through `npm test`, never `npx vitest` (Vitest fails on the lower-case drive letter VS Code uses; `tools/run-tests.mjs` fixes it).

## Hard rules

These apply to every task. The numbering is the repo's: rules 4, 5, 6, 11 and 12 are about writing content and live in `content/CLAUDE.md`.

1. Repair content lives in `content/` only. The player contains no repair text and no bike-specific logic.
2. Do not invent schema constructs. If the schema cannot express something, add an entry to `docs/schema-requests.md` and use the closest allowed form. A schema change the owner asks for is not inventing.
3. Never invent safety values (torque, fluid, wear limits, part compatibility). Use a placeholder with wording that sends the user to the part. Dimensions used only to draw (tooth shape, chain width) are drawing data, never presented as facts about a part.
7. Not everything is covered. Any bike, part or symptom outside the content ends on a clear "not covered yet" screen that offers a shop and the assistant. Never show a guess.
8. Do not stop to ask the owner in the middle of a task. Questions you have before starting go to the owner in one batch. After that, take the cautious default, continue, and ask about the choice at the end of the session (see "Choices and decisions"). The exception: a change that would be expensive to revert (deleting what cannot be recovered from git, a published or outward-facing change, a format others build on). Stop and ask for that one.
9. Mechanics in this repo are unverified drafts. The test build shows a notice saying so.
10. Texts are written in English, short, one action per step, easy to translate into German.
