---
name: finish-task
description: The end of every task, or of each part of a large task, in this repo. Records the guides, choices, decisions and wishlist, verifies, commits, rebases and pushes, writes the final message and notifies the owner. Use before you report a task or part as done.
---

# Finish a task

Run from the repo root; in the Bash tool prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.

1. **Guides.** If you changed how an area works, update that area's `CLAUDE.md` in the same commit. If you learnt something the next agent would otherwise pay for again (a trap, a measured fact), add one line to that guide, not to a log. A new folder, tool, skill or data path also goes into `docs/architecture/overview.md`.
2. **Verify.** Changed content, the build tool or the player: run the `verify` skill. Docs or guides only: `npm run check` must still pass. Report what ran and what it printed.
3. **Your choices.** Each choice you made without the owner goes under "Choices made without the owner" in `docs/open.md`: what, the default you took, where, at most two lines, newest last. A question you could not settle goes under "Questions for the owner" with a recommended answer. Never write your own choice into `decisions.md` or `idea.md`.
4. **Owner decisions** that will matter for future work get one or two lines in `docs/decisions.md` under the fitting heading, with the date. Not what the code, the schema or a guide already shows. Remove an `open.md` item once the owner has answered it.
5. **Mechanics and schema.** A doubt about mechanics goes to `content/review/<job>.md`; a missing schema construct to `docs/schema-requests.md`.
6. **Wishlist.** Add an entry to `wishlist.md` only if something slowed you down that could be fixed, or you have an idea that would make future work clearly faster. By default add nothing. Format and importance (1 to 3) are at the top of that file.
7. **Commit** in logical steps with clear subjects (a part of a planned restructure starts each subject with `Part <id>:`). No other trailers than the attribution the session asks for. Then for every push:
   ```
   git pull --rebase origin main
   git push origin HEAD:main
   ```
   If files in `build/` conflict, take either side, run `npm run manifest` and `npm run check`, and commit the result. Never resolve a conflict in `build/` by hand.
8. **Final message:** what changed; what the owner will see differently; the test results as reported; each choice with why, what it affects, the other options and how to undo it; the owner decisions you recorded; open questions; and, if the task needed a second area, what the next part is.
9. **Notify** as your last action: load `PushNotification` with ToolSearch if needed and send one line under 200 characters that leads with what the owner must do or what happened ("Tutorial rewrite done, check passes, 2 questions in docs/open.md"). Also when you are blocked on an answer. Not for routine progress.
