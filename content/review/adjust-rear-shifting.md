# Review: adjust the rear gears

Doubts about the mechanics of `adjust-rear-shifting`, the diagnosis `gears-shift-badly` and their inspections. Nothing below is verified. The content uses the cautious wording described in each item until a mechanic confirms or corrects it.

Each item names the step or inspection ids it affects, so a change can be traced to the walkthroughs in `build/walkthroughs/`.

## For a mechanic

| Id | Affects | Doubt | Wording in use until confirmed |
| --- | --- | --- | --- |
| R-01 | `check-high-limit`, `check-low-limit-by-hand` | Screw directions. Assumed: screwing in H moves the derailleur towards the spokes at the smallest sprocket; screwing in L moves it away from the spokes at the largest sprocket. True for all common derailleurs? | "Screw in" / "Unscrew", a quarter turn at a time. No clockwise or counter-clockwise, because the direction seen depends on where you look from. |
| R-02 | `check-high-limit` | The high limit is usually set with the cable slack. A too-tight cable can hold the derailleur in on the smallest sprocket, so the user may turn the H screw when the cable is the cause. Should the step first screw the barrel adjuster fully in to slacken the cable? | Changed after review (2026-11-17): the text says "If it does not move, stop turning: the cable holds it, and a later step sets the cable." "Further out" is now a block. |
| R-03 | `check-cable-tension`, `check-cable-tension-riding`, `find-barrel-adjuster` | (a) Unscrewing the barrel adjuster adds cable tension, whether it sits at the derailleur or at the shifter. (b) Rapid-rise (low-normal) derailleurs react the other way round. (c) Many road derailleurs have no barrel adjuster at the derailleur, only an inline adjuster on the cable, and some bikes have none at all. | (a) assumed. (b) not handled: no fact for it yet. (c) "where the gear cable enters the derailleur, or where it leaves the right shifter." A user who finds none has no exit yet. |
| R-04 | `check-b-gap` | The prototype said "about 5 to 6 mm". The right gap depends on the derailleur; some 12-speed derailleurs use a gauge and a different sprocket. Is a gap check without a number useful, or should it only catch touching and very wide gaps? | No number. Three states: small gap, touching, very wide with slow shifting. Points to the manual and names the model when known. |
| R-05 | `check-low-limit-by-hand` | The low limit is checked by pushing the derailleur towards the spokes by hand, in both ways of holding the bike, before the chain is shifted to the largest sprocket. This avoids a reading that depends on the cable tension (review finding). Is the reading reliable without the chain moving? Can it harm the chain? Would pushing while turning the pedals be better when the wheel is free? | Used as the only low-limit check, a safety check with a block. If it is not reliable, the test-ride path should end at a shop before the first ride. |
| R-06 | `hang-bike` | Hanging the bike by the front of the saddle: does the rear wheel lift enough, and is it stable while the pedals turn? | Allowed with a warning that the hook or rope must carry the bike. |
| R-07 | `turn-upside-down` | Bikes with hydraulic brakes: should they stay upside down only briefly? E-bikes: can the display or handlebar parts be damaged? | Only the heavy-bike warning. No hydraulic-brake warning, because the brake type is not asked in this flow. |
| R-08 | `check-all-gears` | The stop "chain falls off or touches the spokes" after the limit screws were checked. Could this still be a limit screw a beginner can fix (a block) rather than a bent part (a stop)? | Stop, with "Put the bike back on its wheels" and the jump to `release-bike`. |
| R-09 | `derailleur-alignment` | Seeing a bent derailleur or hanger from behind is approximate. Small bends are invisible; a leaning derailleur is always serious? | Two states, straight or leaning/twisted. Leaning leads to a shop with `do_not_ride` (A-01). |
| R-10 | `chain-condition` | Visual only. Chain wear cannot be judged by eye, and wear limits are safety values we do not invent. | No wear state. The shop text asks the shop to check wear. |
| R-11 | `shift-test-ride` | Labels map "pedalling gets lighter" to bigger sprockets (cable too loose) and "harder" to smaller sprockets (cable too tight). Correct for standard derailleurs, reversed for rapid-rise. | As R-03 (b). |
| R-12 | `ride-to-smallest-sprocket`, `ride-to-largest-sprocket`, `check-cable-tension-riding` | Test rides with a misadjusted derailleur. Is riding into the largest sprocket safe after only the hand check of the low limit? | Hand check first, then rides. Every riding step is forbidden while the bike is held. |
| R-13 | all shifting steps | Bikes with front gears: should the user pick a certain chainring before checking the limits and the B gap? `drive.front_count` exists in the fact list but is not used. | Not handled. Steps talk only about the rear sprockets. |
| R-15 | `barrel-adjuster-present` | Where to look for an inline adjuster on the frame; bikes without any adjuster. | An inspection before the bike is lifted; "I cannot find one" ends with "not supported yet" and a shop (owner decision, IC-04). |
| R-16 | `check-all-gears`, `check-all-gears-riding` | "Go back to the cable step" relies on the user going back by hand, because the app never jumps back. | Text tells the user to go back. |
| R-14 | `shift-test-ride` in `finish` | After adjusting in a stand, shifting under load on the road can differ. Is a "still not clean" result a shop case, or should it send the user back to the cable step? | Stop with a calm text: you can ride carefully; a shop can check the cable. |

## For the owner

| Id | Question | Default in use |
| --- | --- | --- |
| RO-01 | Should rapid-rise derailleurs and bikes without a barrel adjuster get their own fact and exits? | **Decided 2026-11-17:** too niche to ask; caught as "not supported" (IC-04). Rapid-rise only when the bike's data says so. |
| RO-03 | A tutorial opened right after the diagnosis repeated `derailleur-alignment`. | **Decided 2026-11-17:** never the same check twice in a session (IC-03, AC-20). |
| RO-02 | Is the test-ride path acceptable for a beginner at all, given R-05 and R-12? | Offered as the fourth option, not recommended. |
