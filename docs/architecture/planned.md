# Planned, not built

What the owner agreed to that is not built yet. Build one only when a task asks for it, and remove it here once it is built (its rule then lives in the guide of its area). Keep this file short; it is not a log. Mechanics and prices are not verified.

## Agreed on 27 November 2026

- **Restructure** (the target architecture page, version 6, accepted): a shared `core/` for the flow logic; one flow walker, with the committed journey review files as the cross-check and the sign-off ledger removed; bundle, report and 3D manifest out of git; SR-07 (a branch chosen by an answer) for the disc-pad compare card; on the exit screen of a bike not saved, "Save this bike to keep the to-do". Built in parts; each part's commits start with `Part <id>:`.
- **Disc brake pads.** Diagnosis and routine check only look (wheel in, light from above), with a third answer "I can't see it clearly"; worn and unclear both lead to one tutorial, "Check and replace the brake pads". The pads come out only there; a compare card then decides between the same pads back and new pads, so nothing is put together only to be taken apart again. New pads are optional on the parts screen, with a warning that worn pads without new ones leave the bike unrideable. After a diagnosis that found them worn, the compare card is skipped.
- **Review grid.** On a laptop, several phone screens side by side with one Next for all; a column whose path has fewer steps waits until the others reach the next shared step. Default columns: one test bike, every way of holding it; a dropdown switches to another test bike the job covers. Tapping a problem in one column shows its solution and animation there. Review happens in files first, in the app later.
- **Phones** get the web app in a Capacitor shell.
- **Holding options per job** (SR-08, accepted): a job offers only the ways of holding that suit it.

The rest is from the solution approach agreed on 16 November 2026.

## Bike data

Launch without a licensed bike catalog. Flows need about ten facts per job, and those can be collected directly.

| Route | What it gives | Cost | When |
| --- | --- | --- | --- |
| Picture questions at the moment a fact is needed | Every route fact | None | Launch |
| One photo of the bike, read by a vision model, confirmed by taps | Visible facts: disc or rim, hub gear, motor position | Small per photo | Launch, after a test on about 30 photos |
| Photo of the code printed on a part or old pad | Part identity for parts and safety values | Small per photo | Launch |
| Free text (brand, model, year) plus an agent that searches maker and retailer pages | The bike as sold | Per lookup; once on the free tier | After launch |
| Partner brand hands over the parts list behind its QR code | The exact bike, no questions | None | With the first partner |
| 99 Spokes on-demand access (from 100 USD per month) | Catalog lookups | Monthly | Only once revenue covers it and caching is allowed |

- **Shared cache.** Every lookup result is stored in the app's own catalog, so each bike model is paid for once across all users.
- **No scraping of aggregator sites.** The lookup agent reads maker and retailer pages.
- **Service table for parts.** Hidden or safety-relevant part properties (pad shape, pad retainer, wear limit) sit in one flat table per part family, each row with its source page. A row is used only after it has been checked against the maker's document. Unknown families fall back to a picture question or to "read it off the part".
- **Which fact wins** when sources disagree: confirmed by the user, then a checked part row, then a confirmed photo reading, then the bike as sold. Never a category default for a safety value.
- **Storage.** PostgreSQL is fine. Bikes hold facts, findings, to-do items and session state; the content bundle is built from the repository and never edited in the database.

## Flows

- **The assistant** is a fourth way into the same flows, not a fourth kind of flow. It opens a diagnosis, the routine check or a tutorial by id and passes on what it learned. Facts it inferred are shown once for a one-tap confirmation before they are stored.
- **A diagnosis may read a state differently.** For the symptom "squeals", a squealing but strong brake is a hit; in a routine check it is not. A diagnosis can override the default for single states.
- **A tutorial opened from a finding** skips the "is this needed?" question, because the finding already answers it.
- **To-do items** clear when the tutorial is finished or a later check reports the good state.
- **State labels** will also let a paused session resume with "Does your bike look like this?" (what a label hides in 3D is SR-05).

## Shops

- **Price ranges** start as a hand-curated table for Germany, labelled as estimates with a date (`price_eur`, `price_source` on a job's shop route are placeholders now). A later shop database attaches shops and their prices to the same job ids.

## How content gets made

Agents write, a script checks, a second agent reads the result cold, and a mechanic signs what touches safety.

| Role | Does | Sees |
| --- | --- | --- |
| Writer agent | Writes or revises one job, one diagnosis or a set of checks | Schema, the guides, one polished example, checked part rows |
| Build script | Validates, expands, simulates, writes the review output | Everything |
| Auditor agent | Reads the review output as a mechanic and as a beginner; files findings | The review output and source pages only, never the writer's context |
| Research agent | Finds the maker document for one part family and fills its row | Web, the table schema |
| Mechanic | Signs part rows and the review units for brakes, wheels and anything load-bearing | The review output with the changed units marked |
| Owner | Decides policy questions once | A short decision list with a recommended default each |

- **Low-risk content needs no mechanic:** chain care, tyre pressure, wording changes that the build shows do not alter a safety path.
- **Legal check** on guided brake work is still needed before brake content ships.
