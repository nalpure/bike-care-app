# Bike maintenance app: rules for every agent

A phone app that helps a beginner diagnose and fix their bike step by step, with a 3D view of the part. All repair knowledge is YAML in `content/`; a build tool checks it and writes a bundle; the web app in `player/` plays it. Mechanics are unverified drafts.

**Read `docs/architecture/overview.md` first.** It is the map: the areas and their folders, how data flows, which guide and which skill to use for which task, and the tools that already exist. Each area's `CLAUDE.md` sits next to its code and loads when you work there; read only the one for your task.

## Working

- One task per session. If it needs a second area, do the first part, commit, and name the next part in your final message. A large task: read, propose the plan and its parts in a few lines, and wait for the owner's okay.
- **Whoever changes how an area works updates that area's guide** in the same commit; a trap you learnt goes there as one line.
- Probes and pictures go in `scratch/` only (git-ignored). Edit files with the Edit tool, no patch scripts. Prefer a check that prints numbers to a picture.
- Run the `verify` skill before every commit that changes content, the build tool or the player. End every task, and each part of one, with the `finish-task` skill.
- The state of the work lives only in `git log`, `docs/open.md`, `docs/decisions.md` and the guides. No session prompt files, no handoff files.

## Choices and decisions

- `docs/open.md` lists what is undecided: read it before you change something it mentions.
- **Your own choices are not decisions.** Take the cautious default, carry on, and record the choice under "Choices made without the owner" in `docs/open.md` and in your final message, with why, what it affects, the other options and how to undo it. A choice that is hard to undo is not yours: stop and ask (rule 8). Questions go under "Questions for the owner" with a recommended answer. Never write your own choice into `decisions.md` or `idea.md`.
- **An owner decision** that will matter for future work gets one or two dated lines in `docs/decisions.md`; say so in your final message.
- A doubt about mechanics goes to `content/review/<job>.md`, never into the content as a fact; a missing schema construct to `docs/schema-requests.md` (rule 2).

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
8. Do not stop to ask the owner in the middle of a task. Take the cautious default, continue, and report the choice (see "Choices and decisions"). Questions you have before starting go to the owner in one batch. The exception: a choice that would be hard to undo (deleting what cannot be recovered from git, a published or outward-facing change, a format others build on). Stop and ask for that one.
9. Mechanics in this repo are unverified drafts. The test build shows a notice saying so.
10. Texts are written in English, short, one action per step, easy to translate into German.
