---
name: handoff
description: Write or update this session's handoff file in prompts/ so a fresh session or the owner can continue cold, then commit and push. Use at the end of each session part, before a context clear, or when the owner asks for a handoff.
---

# Handoff

The file is `prompts/<session prompt name>-progress.md`, for example `prompts/04-c-content-progress.md` for `prompts/04-c-content.md`. Update it in place: replace what is out of date, don't append a log. Keep it under about 80 lines.

Sections, in this order:

1. **Status:** one line (part n of m done, or finished).
2. **Done:** what was built, with commit hashes.
3. **Interfaces other sessions rely on:** bundle fields, fact keys, registry fields, function names. Exact names and shapes.
4. **Choices made without the owner:** what, the cautious default in use, and where it is implemented. This is the only place your own choices are recorded; never in `docs/`.
5. **Questions for the owner:** each with a recommended answer.
6. **Next steps:** in order, concrete enough for a cold start.
7. **Gotchas:** what cost you time and would cost the next session time too.

Then run the `verify` skill if code changed since the last run, commit the handoff file, `git pull --rebase origin main`, and `git push origin HEAD:main`.

In your final message to the owner, repeat sections 4 and 5 briefly, and mention any line you added to `docs/decisions.md`.
