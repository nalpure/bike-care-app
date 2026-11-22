# Follow-up F: calm the pedal animation (no strobing)

Read `CLAUDE.md`, `prompts/05-plan.md` ("Rules for every session"), `prompts/05-c-drivetrain-progress.md` ("Interfaces", "Gotchas") and `player/CLAUDE.md`. Model: Sonnet. Run after session C; it does not depend on D or E, but D also edits `anim.ts` (derailleur clips), so pull first and touch only the lines named here.

## The problem

When the pedals turn in the 3D view, the cassette looks as if it turned slowly backwards, the chain flickers, and the rear wheel seems to move backwards and forwards with doubled spokes. The cause is the speed, not the drawing: the stage draws about 60 pictures a second, and anything that moves more than half of its repeat distance per picture looks like it moves backwards (the wagon-wheel effect).

- `PEDAL = 4.2` rad/s in `anim.ts` turns the cranks 0.67 times a second. With a 50 tooth ring and an 11 tooth sprocket the sprockets turn 4.5 times as fast: 0.31 rad per picture, a tooth is 0.57 rad, so 0.55 of a tooth per picture. Anything above 0.5 reads as backwards.
- The rear wheel turns at the same ratio: about 19 rad/s, 3 times a second. The spokes repeat every 20°, so above 10° per picture (0.17 rad, 10.5 rad/s) they strobe. Spokes sit alternately on both sides of the hub, which makes them look doubled.
- Session C already made the chain, the cranks and the sprocket block follow the exact path at any speed (test: "moves the chain smoothly and turns the sprockets the way the chain goes, however fast"). What is left is the speed shown.

## Tasks

1. **Slow the cranks by half:** `PEDAL` 4.2 to 2.1, and the `crank` and `chainring` rotate clip (`sign * 2.6`) to 1.3. Keep `wheelSpeed` for the explicit wheel clip as it is unless task 2 needs it.
2. **Wheel speed in `three-stage.ts`** (the lines that set `wheelAngle.rear_wheel` and `front_wheel`, near the `crankAngle` update): the rear wheel's turn follows the pedals by the gear ratio, so it is fast in the hardest gears. Cap the speed that is drawn so it never moves more than 0.12 rad (7°) per picture at 60 pictures a second, i.e. 7 rad/s, and keep the direction and the freewheel (turns only when pedalling forward). Put the rule in one small pure function (for example `wheelStep(crank, rc, r, dt)`) so a test can call it. Write the rule as a comment: it is a drawing rule against strobing, not physics.
3. **Tests** (`player/test/stage.test.ts`): for every cassette row in `spec.ts` (all 3 kinds) at `PEDAL` and at the `crank` clip speed, in every gear: the sprocket block's step per picture at 60 pictures a second is below half a tooth of that sprocket (0.5 * 2 pi / teeth), and the wheel's drawn step is at most 0.12 rad. Also the same at 30 pictures a second for the wheel.
4. **Check by looking once:** `npm run build && npm run shots -- --only road`, read the shift-to-smallest card (hardest gear). One screenshot of a moving scene cannot show strobing, so rely on the tests; look only that nothing else changed.

## Done when

- The numbers in task 3 hold and `npm run check`, `npm test` (at most 30 s slower than at your start), `npm run test:e2e` pass.
- Run the `verify` skill, then the `handoff` skill (`prompts/05-f-motion-progress.md`).

Not in this prompt: the derailleur pulleys must also turn with the chain. That is in session D (task 4, last bullet).
