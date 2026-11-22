# Parts library and source-model tools: guide for agents

What is here: `library.yaml` + `build-library.ts` build the 3D parts library (`npm run parts`), `check-library.ts` checks it (`npm run parts:check`), `measure-mounts.ts` and `measure-rd.ts` write the measured mounts and derailleur rig (`npm run parts:mounts`, `npm run parts:rig`). `explore/` holds one-off scripts for looking at source models. Each script has a header comment saying what it does and how to call it; read that first. Throw-away output goes to `tools/assets/out/` (git-ignored).

The library is built from one source model, the touring bike (`assets-src/rigid-bike-touring-bike`, a glTF in metres). Other source models in `assets-src/` are candidates; `assets-src/overview.md` has the owner's notes on each.

## Taking parts out of the hardtail (STEP)

`assets-src/hardtail-by-fehe` is a SolidWorks 2022 assembly as one STEP file (398 MB, about 3.6 million entities, about 340 products, one named product per part). It is too big to convert whole. `explore/step-extract.mjs` cuts the named parts (with their place in the assembly) into a small STEP, then converts that to a GLB with one node per part, named like the STEP product, in metres.

```
node tools/assets/explore/step-extract.mjs --in "assets-src/hardtail-by-fehe/fv1 - HARDTAIL by FEHE.STEP" \
  --match "^fv1_ts" --exclude "screw|hexbolt|hexsocket|washer|nut$|spring" --deflection 0.01 --angular 1.0 \
  --out tools/assets/out/hardtail/shifter
```

- Needs `occt-import-js` (Open Cascade as WebAssembly), a dev dependency installed by `npm install`. `--no-glb` needs only Node.
- A run takes about a minute. The original file is never changed.
- List the part names: `grep -o "PRODUCT ( '[^']*'" "<the .STEP>" | sort -u`. Names start with `fv1_` and a short prefix per assembly. `ts_` is the trigger shifter (checked in a render). The other prefixes are guesses from the names (`rd_` rear derailleur, `bc_` brake caliper, `bd_` brake disc, `ch_` chain, `cs_` crankset, `hb_` handlebar, `rh_` rear hub).
- Look at a result: copy or write it under `tools/assets/out/` and use `explore/shot.mjs` with `view.html?file=tools/assets/out/<path>.glb` (see the shot.mjs header for the arguments).

Findings (shifter, `^fv1_ts`):

| Settings | Size | Triangles |
| --- | --- | --- |
| defaults | 9.1 MB | 288,000 |
| + `--exclude` screws, washers, springs | 6.7 MB | 210,000 |
| + `--deflection 0.01 --angular 1.0` | 3.4 MB | 98,000 |

- `--angular` is the strong lever for fewer triangles. `--deflection` alone changed almost nothing. The coarse setting shows visible facets on round parts (the clamp ring); the library build simplifies per part afterwards, which is the better place for fine control.
- A pattern that matches an assembly takes only parts inside it. Without that, screws named `ts_...` but used all over the bike came with it as loose parts. With no assembly matched, every instance of a matched part is taken.
- `casep1` and `teeth` are the heaviest shifter parts.

Not done or not verified:
- Only the shifter has been extracted and looked at. Other assemblies are untested (colours, placement, size).
- Nothing from the hardtail is in `library.yaml` or the player. `library.yaml` has a single `source` and the touring bike's node names; a second source is not wired up.
- `assets-src/hardtail-by-fehe` has no `credit.txt` yet, and `assets-src/overview.md` says the creator was contacted about usage rights. Settle that before any part ships.

## Log for agents

Add one line per piece of work or finding here: date, what, where. Newest last.

- 2026-11-22: `explore/step-extract.mjs` written and run on the hardtail shifter (see above).
