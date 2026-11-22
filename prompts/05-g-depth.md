# Follow-up G: depth and contours on the drive side

Read `CLAUDE.md`, `prompts/05-plan.md` ("Rules for every session"), `prompts/05-c-drivetrain-progress.md` and `player/CLAUDE.md`. Model: Sonnet. This overlaps with session E ("look" task); run it before E or hand it to E as part of its look task, but not both. Do not touch the shapes or the chain layout from session C.

## The problem

Seen from the side (drive side), the chain, the cassette and the chainring are an even grey: no contours, no feeling of depth, they look unreal. It is mostly a general problem of the stage's look, not of the chain's shape:

- Everything in a chain plate, a sprocket face or a chainring face points the same way (towards the viewer), so with flat shading and one light direction each face gets the same shade. Only the edges between faces differ, and those are thin.
- `three-stage.ts` lights the scene with a hemisphere light, a weak ambient light, a key light and a weak fill (about line 216), on the prototype's r128 look: colour management off, intensities times pi. That look is deliberately even ("keep the prototype's look" in `player/README.md`).
- Small mechanical parts get dark edge lines (`OUTLINED` in `bike.ts`, `EdgesGeometry` at 35°). The cassette sprockets are in it; the chainring and the chain are not. The chain is two `InstancedMesh`, and edge lines cannot be instanced.
- Chain plates alternate in brightness (`userData.k` 0.55 inner, 0.8 outer, in `buildChain`); on a phone that is hard to see.

## Tasks

1. **Measure first.** With `npm run build && npm run shots`, or a one-off script like the shots script, take a crop of the chain run and of the cassette from the side at the same camera (the `chain_close` view). Compute the standard deviation of the luminance in each crop (PNG pixels) and write it down; that is your "before". Aim for a clearly higher value afterwards without bright or dark patches.
2. **Try, in this order, and keep only what helps (at most 4 screenshots in all):**
   - a stronger key light and less ambient light for the whole scene, so parts that face away from the light get darker. Check that frame tubes, the wheel and the garage preview still look like the prototype;
   - the chainring in `OUTLINED`;
   - a cheap fake ambient occlusion for the generated drivetrain: vertex colours that darken towards the sprocket's inner hole and the tooth gaps, and the plates towards the rim; the materials need `vertexColors: true` where used. No new draw calls for the chain;
   - for the chain, a bevel on the plates (so the rim catches light) only if the chain stays within 20k triangles at its longest (it is at about 18k now, so probably not without fewer plate points), or a darker rim by vertex colour instead.
3. **Do not** add shadow maps, post-processing, or a second chain mesh drawn as an outline (a draw-call and triangle cost on every phone).
4. **Tests:** nothing that depends on looks. The existing budget tests (cassette 15k, chainring 3k, chain 20k, at most 4 chain meshes) must still pass.
5. Update "Known 3D shortcomings" in `player/README.md` for what you changed (the lights line).

## Done when

- The luminance spread in the chain and cassette crops is clearly higher than before, shown as numbers in your handoff file (`prompts/05-g-depth-progress.md`), and 1 to 2 screenshots show the result.
- `npm run check`, `npm test` (at most 30 s slower than at your start), `npm run test:e2e` pass.
- Run the `verify` skill, then the `handoff` skill. If a light change makes other parts of the bike worse, say so in the handoff with the numbers instead of keeping it.
