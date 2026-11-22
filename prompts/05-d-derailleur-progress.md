# Session D: the real derailleur: progress

## Status

Part 1 of 3 done (tasks 1 to 3: rig, closure, round trip). Part 2: tasks 4, 5, 8 (Opus). Part 3: tasks 6, 7, 9, 10 (Sonnet will do; owner's call).

## Done

- `344e8a4` `tools/assets/measure-rd.ts` (`npm run parts:rig`, about 45 s; `-- --explore` lists every cylinder per piece and the coaxial pairs; `-- --shots` writes `tools/assets/out/rig-{drive,behind,above}.png` through `explore/rig-view.html`). Writes `player/src/stage/rd-rig.ts` (`RD_RIG`, generated, scene units, library space). `player/src/stage/rd-kin.ts` (kinematics). `player/test/derailleur.test.ts` (4 tests). `docs/decisions.md`: long cage line clarified (owner).
- Verified: `npm run check`, `npm test` (109 tests, 11.9 s; 11.5 s at session C's end), `npm run typecheck`, `npm run test:e2e` (11 of 11). No shots: the app does not use the new modules yet.
- Marker renders looked at once from 3 sides: every axis sits on its feature.

### Measured (mm; all from the exact source meshes)

Trusted (two pieces agree within 0.04 mm and 0.2 deg): B-axis = hanger hole (r 5) = body bolt, exactly along z. Four pins all along `pinDir` (0.533, 0.683, -0.500), spread 0.01 deg. Links 38.50 / 38.50, upper pins 16.03 apart, lower pins 15.00: **not a parallelogram**, solved as a four-bar. P-axis: lower body boss r 11.0 / outer cage plate, 0.04 mm / 0.19 deg apart (direction taken from the cage plates). Pulley axles in both plates: 0.00 mm. Pulley centres 82.14 apart. Barrel: 18 mm long, r 4.5, housing socket at the rear end. Hanger plate z 66 to 72.

Less sure: **H and L** are two fused r 2.5 shanks with r 3 counterbores on the back of the upper body, 14 mm apart, parallel to the barrel; which is H is not marked. **B screw**: a fused r 1.5 shank in the B-knuckle behind the bolt, 23.3 mm long, lever arm 12.6 mm about the bolt, tip in the hanger's plane. **Clamp**: r 3 bolt boss on the lower body, square to the link plates; the barrel's axis passes about 45 mm from it, so the wire cannot run straight out of the barrel to it. **Pulleys**: the model's are generic gears, 10 teeth with seats 36 deg apart on a 22.5 mm circle (tip r 21, tooth 1.84 mm wide). Chain-true at 22.5 mm is 11 teeth (pitch radius 22.54).

## Interfaces other sessions rely on

- `rd-rig.ts`: `RD_RIG.{bAxis{p,d}, hangerZ, pinDir, pins{upperOuter,upperInner,lowerOuter,lowerInner}, pAxis, pulleys.{upper,lower}{c,d,teeth,rPitch,teethModel,rSeat,rTip,width}, barrel{p,d,head,seat,r}, clamp{p,d}, screws{h,l,b{p,d},bLen}}`. Screw `p` = head seat, `d` = head into thread. Barrel `d` = head into thread.
- `rd-kin.ts`: `RIG` (Vector3s, `src` angles), `rdPose(bolt, {body, link, cage})` gives `{upper, linkOuter, linkInner, lower, cage, ok}` (Matrix4 from each piece's library pose to bike space; the B-axis keeps its direction), `pulleySpin(which, ang)` (multiply after `cage`), `anglesOf(pose)`, `rotAbout`, `LINK_SWING {min,max}` (src -30 to +80 deg; folds at about -33).
- Angles are absolute (see the file header). Source pose: link angle near the smallest sprocket; **raising the link angle moves the P-knuckle inwards** (37 mm over 70 deg), down 15 mm and back 12 mm. Lower body turns up to 3 deg at +40 (four-bar).

## Choices made without the owner

- **H is the upper of the two limit screws** (`measure-rd.ts`, `hlScrews.sort`).
- **Pulleys drawn with 11 teeth** at the model's seat circle (`RD_RIG.pulleys.*.teeth`, `rPitch`); the model's 10-tooth mesh is not chain-true. Part 2 decides how to draw them (see next steps).
- **P-axis direction from the cage plates**, point from the lower body's boss.
- Kinematics in a new file `rd-kin.ts` (pure maths, like `pins.ts`), not inside `derailleur.ts`.

## Questions for the owner

None open.

## Next steps

1. Part 2 (tasks 4, 5, 8), same prompt. Build `derailleur.ts` on `rdPose`: each `rd_*` piece is one mesh with `libGeo`, its matrix set from the pose (put `matrixAutoUpdate = false` or decompose). Library space has its origin at the source BB: map to bike space with the bike's own BB (check `bby` in `spec.ts`) when choosing the bolt.
2. Bolt below and slightly behind the axle; hanger built in code in the hanger plane (`hangerZ` width) at `zDrop`, with a tab under the B screw's tip (`screws.b.p + d * bLen`). Lateral: solve `link` (bisection over `LINK_SWING`) for the upper pulley's centre plane at the sprocket z. Body angle from `gap` on the largest sprocket. Cage angle from fixed chain length (`chordLength`), N = big-big plus 2 links.
3. Pulleys: set `RP` (spec.ts) and `circ[2]`, `circ[3]` to `rPitch` 0.04508; suggested: generated 11-tooth ring (`sprocketGeo`) about the library's hub, or scale nothing and accept the 10-tooth mesh only if rollers clear it. Spin them from `pins.wheel === 2 / 3`.
4. Long cage when the largest sprocket is above 36 (owner): stretch the plates beyond the upper axle along upper to lower pulley.
5. Screws (`m.screw`, M4), barrel (`rd_barrel` re-centred on `barrel.p/d`), cable stop when `barrelAt === 'shifter'`, wire from `barrel.seat` to `clamp.p` (check it clears the links). Then task 8 tests per cassette.

## Gotchas

- Scratch scripts that import `three` must live inside the repo (`tools/assets/out/` is git-ignored) but `tsc` checks them: delete them before `npm run typecheck`.
- `measure-rd.ts` RANSAC is seeded, so its output is stable; it takes about 45 s.
- `git pull --rebase` needs `--autostash` while the three deleted prompt files stay unstaged.
