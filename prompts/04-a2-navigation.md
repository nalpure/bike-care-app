# Session A2: navigation and polish

Read `CLAUDE.md`, `prompts/04-plan.md`, `player/CLAUDE.md` (it includes `player/README.md`), and the handoff files `prompts/04-c-content-progress.md`, `prompts/04-s-3d-progress.md` and `prompts/04-a1-garage-progress.md`. If you have questions, ask them in one batch before you start; after that, work without stopping.

You work in the main checkout. You own `player/src/ui/`, `player/src/engine/` and `player/e2e/`. Everything about a bike or a repair comes from the bundle (hard rule 1).

## Tasks

1. **Swipe up for the next step.** "It's a better user experience if you swipe up for next step. There should be an according animation when 'next step' is pressed or the user swipes. The progress bar should maybe be vertical accordingly."
   - The card's text slides up and out, and the next one slides in from below. The 3D stage stays where it is.
   - The progress bar becomes vertical.
   - Handle the conflicts: a long text that scrolls, and dragging on the 3D view, must not trigger the swipe. Only swipe up once the text is scrolled to its end, and never on the canvas.
   - Respect reduced motion.
2. **Swipe from the edge to go back.** "The user should be able to swipe on the edge of the screen to get to the previous menu instead of having to click on the back arrow."
   - Do the same as the back arrow, with the screen following the finger.
   - Phone browsers have their own edge swipe (Safari's back). Note in the handoff where the two clash and what you chose.
3. **The assistant everywhere, and easy to spot.**
   - "The assistant should also appear when user is asked questions before a tutorial. Or in other words: always."
   - "It should visually stand out more and have a different icon instead of the text bubble, suggesting that it is AI powered."
   - "It is confusing that the location of the assistant button switches … would it be possible to have it freely moving, as in the user can move it around and it sticks at that position across all screens?"
   - Build one floating button on every screen, with an AI-style icon (for example a sparkle). The user can drag it; it snaps to the nearest screen edge, and the position is stored in settings. It must never cover the Next button or the state buttons; move it out of their way when they would overlap.
4. **Help on questions.** Show C's `help` text behind a "?" next to each question. End it with a fixed line saying that the assistant can help when in doubt.
5. **Tools screen.** Show C's three tiers ("Needed", "One of these, depending on your bike", "Helpful") cleanly. Replace C's minimal version.
6. **The repair menu.** "Symptom-based repairs, tutorials and routine checks should be clearer separated somehow. Consider there will be few symptoms, few routine checks but a reasonable amount of tutorials (aiming for 10). Default is going on a symptom, routine check is less important and going straight to the tutorial is rare."
   - Put "What's wrong?" first and largest, with the symptoms.
   - Then the routine check as one card.
   - Then "All guides" as a compact list, or collapsed. It must still work with ten guides.
7. **Short tester notes.** "The notes for the testers include a whole path which can be very long. Find a better solution that makes review easier."
   - A note shows the screen (unit id and title), the bike, the flow, and the last two or three steps. The full path goes behind "Details", or into a short code that reproduces it.
   - The Notes tab groups notes by screen.
   - If a short code needs build-tool support (for example a path id `npm run walk` understands), add a small reader to `tools/` and say so in the handoff.

## Done when

- `npm run check`, `npm test` and `npm run test:e2e` pass (the `verify` skill). The e2e run uses the new navigation: swipe or Next, and back by the edge or the arrow, where Playwright can simulate them.
- You have looked at the card in portrait and landscape, the assistant button in a few positions, the repair menu, and a note.
- `player/README.md` is up to date, including "Other known gaps".
