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

## 3D view

- **2026-11-21 Parts library.** Realistic parts come from CC BY models in `assets-src/` (first the "Rigid Bike [Touring Bike]"), split into a parts library. Frame, wheels, sprockets, chainrings and chain stay generated from the facts. The app credits every model it uses (title, creator, link, licence, "modified").
- **2026-11-21 Real sprocket spacing.** Sprockets sit at their real spacing; closer camera views make up for it.
- **2026-11-21 Wide cassettes.** Above 36 teeth the same derailleur gets a longer cage, until a source for a mountain bike derailleur exists. The trigger is the largest sprocket only; the wrap only sets the cage's length.
- **2026-11-21 Source models in git.** Only the touring bike's source is committed; the others stay out of git until they are used.

## Where approach.md is out of date

- **Ending a flow:** one construct, `exit: { kind: unsafe | not_covered | not_needed | shop_only, text, show_how_from? }`, replaces `stop`, `end`, and `shop` / `not_covered` on cases. `block` is unchanged. The schema is the reference.
- **Review:** review units (cards, flow trees, journeys), each with a hash and signed in `reviews/ledger.yaml`, replace walkthroughs per path and "sign-off follows paths".
- **Session state labels** cover anything to undo before riding, including a bike in a stand, hung or upside down.
- **`hands_off`** means nothing is taken apart and no setting is changed. Riding and shifting count as hands-off.
- **Run choices** (`choice.<id>`, such as `hold_bike`) are asked fresh in each tutorial and never stored. The one nested branch may test one.
- **3D names** come from the player's registry through `build/3d-manifest.json`, not from `schema/3d-catalog.yaml`.
- **History only:** the sections "Changes to the existing YAML files", "Requirements check" and the build order, and in "How content gets made" the policy book and the assumption list (replaced by "Decisions" in `CLAUDE.md`).
