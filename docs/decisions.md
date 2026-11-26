# Owner decisions

Decisions the owner made after `idea.md` and `approach.md` were written that still guide future work. Where they disagree with those two documents, this file wins. Only owner decisions go here, one or two lines each; an agent that adds one tells the owner. What the schema, the build tool or a guide already shows is not repeated here.

## Experience

- **2026-11-17 Holding the bike.** For work that needs the rear wheel free, the user picks how to hold the bike: work stand (recommended), hook or rope, upside down, or on its wheels with short test rides. The app recommends and warns (every option and step that lifts, hangs or turns the bike warns about heavy bikes) but never decides, and never judges by bike type.
- **2026-11-17 Test rides.** Without a way to lift the bike, the user adjusts while it stands and tests by riding, changing settings only when stopped. No loops: the user taps a different answer once it is fixed.
- **2026-11-17 Niche variants.** Rare variants a beginner cannot recognise are never asked about; when the bike's data reveals one, the user sees "not supported yet" with a shop and the assistant. Rare variants the user can see are found by a look before any work starts and end the same way.
- **2026-11-20 Limit screws.** Set by the owner's method: H at the smallest sprocket, L at the largest, each until the upper toothed wheel is in line with that sprocket, and counterclockwise if the chain rattles or jumps. The hand push towards the spokes stays as a double-check after L.
- **2026-11-20 Checks a diagnosis also runs.** A tutorial keeps the hands-off checks it needs before the work (users who open it directly skip the diagnosis), declared once per tutorial, not per case. Hard rule 12 hides them after a diagnosis.
- **2026-11-20 Service intervals** start as unverified placeholder values until a mechanic signs them off.
- **2026-11-20 Complete-bike lookup** (database, then an AI web search) is a stub in test builds.
- **2026-11-25 Barrel adjuster check.** No default; three answers: at the derailleur, at the shifter, "I cannot find it". The last opens a card on where else to look ("on the cable" goes on, "still cannot find it" ends as not supported). With one at both spots the user picks either. The answer is kept on the bike if the user agrees, and the check is then skipped.
- **2026-11-25 Barrel adjusters in 3D.** Every position the bar type has is always drawn: at the derailleur; at the shifter on flat and riser bars (drop-bar shifters have none); in the cable behind the bar on drop bars. The fact only picks the one that is marked, turned and framed; an adjuster on the cable is shown at the shifter on flat bars.
- **2026-11-26 Two barrel adjusters, cable-tension steps in 3D.** Only the rear barrel belongs to the drivetrain group. The cable-tension cards are about shifting: focus the chain, show the drivetrain. Their solution clip adds what is around the picked barrel (derailleur: rear end, hanger, cable; front: handlebar, shifter, cable, frame), marks it and turns it; afterwards the card returns to its own scene. The barrel tour plays once; its caption says what to look for and where.
- **2026-11-26 Last test ride.** Both ways of holding the bike end with one safety check, "Test ride the gears" (the stand's "Test every gear" is gone). Two problems, both to a shop: slow or rattling (ride there carefully), the chain jumps or falls off (do not ride). Each exit names the likely causes: the inner cable or its housing, a hanger or derailleur bent too little to see.
- **2026-11-26 Shifting stops on a tap.** The cable-tension card shows the pedals turning and the chain going through every gear until a problem is tapped; then the pedals stand still while the barrel turns.

## 3D view

- **2026-11-21 Parts library.** Realistic parts come from CC BY models in `assets-src/` (first the "Rigid Bike [Touring Bike]"), split into a parts library. Frame, wheels, sprockets, chainrings and chain stay generated from the facts. The app credits every model it uses (title, creator, link, licence, "modified").
- **2026-11-21 Real sprocket spacing.** Sprockets sit at their real spacing; closer camera views make up for it.
- **2026-11-21 Wide cassettes.** Above 36 teeth the same derailleur gets a longer cage, until a source for a mountain bike derailleur exists. The trigger is the largest sprocket only; the wrap only sets the cage's length.
- **2026-11-21 Source models in git.** Only the touring bike's source is committed; the others stay out of git until they are used.
- **2026-11-22 Shown, marked, hidden.** A step's `focus` lists only the small parts it marks in colour; a new `show` lists the parts drawn plain; every other part is hidden completely (no grey). Steps without `show` keep the old behaviour until they get one. When the frame is hidden, so are stand and hook.
- **2026-11-22 Clips own the scene.** A named clip decides how the scene looks while it plays: red marking (a part that is bent or wrong), and contours of the correct or starting position. Generic motions (push, rotate, …) add no contours.
- **2026-11-22 Hanger check.** `derailleur-alignment` gets a clip that bends the hanger in and out (hanger red) with the straight derailleur's contour; shown: hanger, derailleur, sprockets, rear end of the frame with the hub. The chain is left out at first.
- **2026-11-22 Answers are the exception.** A step states its goal ("the upper wheel should be in line with the smallest sprocket"); Next means it is met. A short question ("Not in line?") offers only the problems; each says briefly what goes wrong (rattling, jumping, unsafe) and plays its solution animation at once.
- **2026-11-22 Next is never locked** on such a card, and stays a plain "Next": after a problem answer it means "fixed now". No "all good" button. An answer that exits still exits.
- **2026-11-22 Defaults for inspections.** An inspection may name a default state (with a short question); in tutorials that state has no button and Next takes it. Diagnoses and the routine check keep explicit answers.
- **2026-11-22 What is safety relevant.** Of the limit screws only L (the chain must not fall towards the spokes) is a safety check; H is a plain check. Safety steps get a red label next to the title.

## Where approach.md is out of date

- **Ending a flow:** one construct, `exit: { kind: unsafe | not_covered | not_needed | shop_only, text, show_how_from? }`, replaces `stop`, `end`, and `shop` / `not_covered` on cases. `block` is unchanged. The schema is the reference.
- **Review:** review units (cards, flow trees, journeys), each with a hash and signed in `reviews/ledger.yaml`, replace walkthroughs per path and "sign-off follows paths".
- **Session state labels** cover anything to undo before riding, including a bike in a stand, hung or upside down.
- **`hands_off`** means nothing is taken apart and no setting is changed. Riding and shifting count as hands-off.
- **Run choices** (`choice.<id>`, such as `hold_bike`) are asked fresh in each tutorial and never stored. The one nested branch may test one.
- **3D names** come from the player's registry through `build/3d-manifest.json`, not from `schema/3d-catalog.yaml`.
- **History only:** the sections "Changes to the existing YAML files", "Requirements check" and the build order, and in "How content gets made" the policy book and the assumption list (replaced by "Decisions" in `CLAUDE.md`).
