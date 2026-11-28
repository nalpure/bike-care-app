# 3D parts tools: guide for agents

Everything that turns a source 3D model into the parts the player draws. Nothing here runs at app time. The library is built from one source model, the touring bike (`assets-src/rigid-bike-touring-bike`, a glTF in metres). The other models in `assets-src/` are candidates; `assets-src/overview.md` has the owner's notes on each.

```
tools/assets/
  library/    build the parts library and check it
    library.yaml      which source nodes make which part (data only)
    build.ts          npm run parts         -> player/public/parts/ (library.glb, library.json, CREDITS.txt)
    check.ts          npm run parts:check   compares each part with its source model; checks the size budget
    check-page.html   the page check.ts drives in headless Chromium
  measure/    measure the built library or the source, write generated code into the player
    mounts.ts         npm run parts:mounts  -> player/src/stage/mounts.ts (crank, saddle, stem, bar, grips)
    rd.ts             npm run parts:rig     -> player/src/stage/rd-rig.ts (derailleur axes, pins, pulleys)
  explore/    look at a model; each file has a header saying how to call it
    tree.mjs          node names and sizes of a glTF
    bbox.mjs          boxes (turned parts look larger than they are)
    islands.mjs       true size of each loose piece of a node
    view.html + shot.mjs   render a GLB or glTF from chosen directions to a PNG (see the shot.mjs header)
    step-extract.mjs  cut named parts out of the hardtail STEP into a small GLB (below)
    simplify.html, rig-view.html   helpers used by the scripts above
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run parts` | build the library from `library.yaml` and the source model |
| `npm run parts:check` | render every part and its source nodes as silhouettes from 6 directions, print overlap and box difference, check the budget (35k triangles, 1.5 MB); fails on a bad shape. `-- --shots` writes a PNG per part to `scratch/` |
| `npm run parts:mounts` | measure the crank, pedals, saddle, seat collar, stem, bar and grips mounting points on the built library; run `parts` first |
| `npm run parts:rig` | measure the derailleur rig on the source model (about 25 s); only when the derailleur pieces or their source change |
| `npm run manifest` | write `build/3d-manifest.json` from the player's registry |

Read first: `docs/decisions.md`, section "3D view". How the player uses the library (names, space, what is library and what is generated): `player/src/stage/library.md`. To add a part: the `new-part` skill.

## Rules

- **Check before you write.** Need a node list, a size, a view, a bounding box? Use `explore/`. Need a new measurement? Read `measure/rd.ts` first: it already finds axes, pins and pulleys. Add to these files instead of writing a new script next to them.
- **Throw-away probes** go in `scratch/` at the repo root (git-ignored, `npm run clean` deletes it). A probe you needed twice is not throw-away: give it a header comment and move it into `explore/` or `measure/`; otherwise delete it.
- **Generated files** (`mounts.ts`, `rd-rig.ts`, `player/public/parts/*`) are never edited by hand. After any change to `library.yaml`: `npm run parts`, then `npm run parts:mounts`, then `npm run parts:rig` if the derailleur nodes changed.
- Never read a `.gltf`, `.glb` or `.bin` into context. Use the tools above and print numbers.
- Pictures are for the last step, a few at a time. Prefer a check that prints numbers.

## Taking parts out of the hardtail (STEP)

`assets-src/hardtail-by-fehe` is a SolidWorks 2022 assembly as one STEP file (398 MB, about 3.6 million entities, about 340 products, one named product per part). It is too big to convert whole. `explore/step-extract.mjs` cuts the named parts (with their place in the assembly) into a small STEP, then converts that to a GLB with one node per part, named like the STEP product, in metres.

```
node tools/assets/explore/step-extract.mjs --in "assets-src/hardtail-by-fehe/fv1 - HARDTAIL by FEHE.STEP" \
  --match "^fv1_ts" --exclude "screw|hexbolt|hexsocket|washer|nut$|spring" --deflection 0.01 --angular 1.0 \
  --out scratch/hardtail/shifter
```

- Needs `occt-import-js` (Open Cascade as WebAssembly), a dev dependency installed by `npm install`. `--no-glb` needs only Node.
- A run takes about a minute. The original file is never changed.
- List the part names: `grep -o "PRODUCT ( '[^']*'" "<the .STEP>" | sort -u`. Names start with `fv1_` and a short prefix per assembly. `ts_` is the trigger shifter (checked in a render). The other prefixes are guesses from the names (`rd_` rear derailleur, `bc_` brake caliper, `bd_` brake disc, `ch_` chain, `cs_` crankset, `hb_` handlebar, `rh_` rear hub).
- Look at a result: write it under `scratch/` and use `explore/shot.mjs` with `view.html?file=scratch/<path>.glb`.

Findings (shifter, `^fv1_ts`):

| Settings | Size | Triangles |
| --- | --- | --- |
| defaults | 9.1 MB | 288,000 |
| + `--exclude` screws, washers, springs | 6.7 MB | 210,000 |
| + `--deflection 0.01 --angular 1.0` | 3.4 MB | 98,000 |

- `--angular` is the strong lever for fewer triangles. `--deflection` alone changed almost nothing. The coarse setting shows visible facets on round parts (the clamp ring); the library build simplifies per part afterwards, which is the better place for fine control.
- A pattern that matches an assembly takes only parts inside it. Without that, screws named `ts_...` but used all over the bike came with it as loose parts. With no assembly matched, every instance of a matched part is taken.
- `casep1` and `teeth` are the heaviest shifter parts.

Not done or not verified: only the shifter has been extracted and looked at. Nothing from the hardtail is in `library.yaml` or the player; `library.yaml` has a single `source` and the touring bike's node names, so a second source is not wired up. The hardtail may be used (owner, decisions.md 2026-11-27).
