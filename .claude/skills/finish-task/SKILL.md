---
name: finish-task
description: The end of every task, or of each part of a large task, in this repo. Records the guides, choices, decisions and wishlist, verifies, commits, rebases and pushes, writes the final message and notifies the owner. Use before you report a task or part as done.
---

# Finish a task

Run from the repo root; in the Bash tool prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.

1. **Documentation.** You own the documentation of what you wrote. Read again what describes it (the area's `CLAUDE.md`, `docs/architecture/`, the skills, schema descriptions, code comments) and change whatever is now wrong or missing, in the same commit. If you learnt something the next agent would otherwise pay for again (a trap, a measured fact), add one line to that guide, not to a log. A new folder, tool, skill or data path also goes into `docs/architecture/overview.md`.
2. **Verify.** Changed content, the build tool or the player: run the `verify` skill. Docs or guides only: `npm run check` must still pass. Report what ran and what it printed.
3. **Your choices** are not written to any file. Collect each choice you made without the owner for the questions at the end of your final message (step 8). Never write your own choice into the documentation as if the owner had decided it.
4. **Owner answers** that will matter later go where they apply, as a rule in plain words: the area's guide, the job file's header comment, `docs/architecture/content-model.md`, or `docs/architecture/planned.md` while not built (remove it there once built). Not what the code, the schema or the check's rules already enforce. Never a decisions file or a log.
5. **Mechanics and schema.** A doubt about mechanics goes to `content/review/<job>.md`; a missing schema construct to `docs/schema-requests.md`.
6. **Wishlist.** Add an entry to `wishlist.md` only if something slowed you down that could be fixed, or you have an idea that would make future work clearly faster. By default add nothing. Format and importance (1 to 3) are at the top of that file.
7. **Commit** in logical steps with clear subjects (a part of a planned restructure starts each subject with `Part <id>:`). No other trailers than the attribution the session asks for. Then for every push:
   ```
   git pull --rebase origin main
   git push origin HEAD:main
   ```
   If files in `build/` conflict, take either side, run `npm run manifest` and `npm run check`, and commit the result. Never resolve a conflict in `build/` by hand.
8. **Final message:** what changed; what the owner will see differently; the test results as reported; where you put the owner's answers; if the task needed a second area, what the next part is. End with **Questions for you**, numbered: one per choice you made and per point you could not settle. Each is a clear question the owner can answer without opening the code: what you chose and why, what it affects, the other options, how to undo it, and your recommended answer.
9. **Notify** as your last action: load `PushNotification` with ToolSearch if needed and send one line under 200 characters that leads with what the owner must do or what happened ("Tutorial rewrite done, check passes, 2 questions for you"). Also when you are blocked on an answer. Not for routine progress.
