# Bike maintenance app: solution approach

Nov 16, 2026 · @Benedikt

## At a glance

Content is authored as plain, ordered data; a build script proves it safe; one player shows it. Nothing is planned on the phone. This document describes how to build what the [idea document](https://claude.ai/artifact/16KHPAf8QoVWuWe6qKuT3A) asks for, and the two together are meant to be sufficient.

- **One shared library of inspections** is used by diagnosis, the routine check and tutorials.
- **Three thin flow types, one player.** A diagnosis and a routine check are ordered lists of inspections. A tutorial is an ordered list of steps.
- **Findings and jobs connect everything.** An inspection state becomes a finding on the bike; a finding points to a job; a job has a tutorial, a shop summary and a price range.
- **One tutorial per job,** with a single branch by mechanism (for brakes: hydraulic disc, mechanical disc, cable rim, hydraulic rim).
- **A stop never jumps.** It shows what to put back and a button that jumps ahead to the steps that show how.
- **Steps carry state labels and a duration.** A build script uses them to check every path and to compute the time for the user's bike.

Status: a proposal agreed in conversation with the owner on 16 November 2026. Mechanics and prices are not verified.

## Building blocks

All content is made from eight kinds of thing. The first five exist in the current YAML files; the last three are new.

| Block | What it is | Example |
| --- | --- | --- |
| Fact | A lasting property of the bike, asked at most once | `brake.type.front = disc_hydraulic` |
| Inspection | A look, listen or feel that reports one of two or three named states. Shared by all flows. | `disc-pad-wear`: ok, worn, very-worn |
| Step | One action, check or safety check with up to three state buttons | `slide-out-pads`, `wheel-secure` |
| Procedure | A reusable run of steps with one implementation per fact or tool value | `remove-front-wheel` by axle type |
| Tool and part | What the user needs; tools are picked fresh per run, parts are bought | `tyre-lever`, `disc-pads` |
| Finding | The dated state an inspection reported for one bike | `disc-pad-wear.front = worn`, 16 Nov |
| Job | Something that can be done about a finding: a tutorial, a shop visit, or both | `brake-pads-replace` |
| Session state | What is currently taken apart, as simple labels | `wheel_out.front`, `pads_out.front` |

Two kinds of user input stay strictly apart. A fact is stored on the bike. A button tap inside a step is not stored and never steers later steps. The only observations that are kept are inspection states, as findings.

## Diagnosis, tutorial and routine check

Treat them as the same thing on screen and as three small, different files underneath. Every screen in all three is the same card: a text, a 3D scene and up to three buttons. What differs is only what a tapped state leads to.

|  | Diagnosis | Routine check | Tutorial |
| --- | --- | --- | --- |
| Starts from | A symptom in the user's words | Nothing; a fixed list | A job |
| Made of | An ordered list of inspections | An ordered list of inspections | Steps, procedures and a few inspections |
| A non-ok state | Ends the diagnosis with a result | Adds a to-do item and goes on | Continue, block, stop or end |
| Changes the bike | Never | Never | Yes |
| Ends with | A job: do it yourself or go to a shop | A to-do list on the bike | A repaired bike, or a stop with a shop summary |
| File size | About 10 lines | About 10 lines | Long |

**Why this works.** The inspection carries the knowledge (what to look at, which states exist, what each state usually calls for). A diagnosis or routine check then only has to say which inspections to run and in what order. No decision trees are authored.

**Diagnosis is hands-off.** It looks, listens and feels, with a torch at most. It never takes anything apart. Where a cause can only be confirmed with the part in hand (pads that cannot be seen), the result is the tutorial, which opens the brake and checks first. If the pads turn out fine, the tutorial ends there and shows how to put things back. This departs from the owner's draft policy P2 and is listed under open decisions.

**Order inside a diagnosis.** Cheapest and most likely checks first. The first state that calls for a job ends the diagnosis. After the job, "Did it fix it?" continues with the remaining checks if the answer is no.

**The assistant** is a fourth way into the same flows, not a fourth flow type. It opens a diagnosis, a routine check or a tutorial by id and passes on what it learned. Facts it inferred are shown once for a one-tap confirmation before they are stored.

## Findings, jobs and the to-do list

A finding points to a job, and the job is the one place that knows both the tutorial and the shop route. This single link serves the diagnosis result, the to-do list, the shop exit and later the shop database.

1. **Inspection state.** Each non-ok state names what it usually calls for: a job and an urgency (`soon` or `do_not_ride`). Labels and meanings stay neutral; this is routing data, not wording.
2. **Finding.** When a diagnosis or routine check records a state, it is stored on the bike with the brake or wheel position and the date.
3. **To-do item.** Every finding with a job shows on the bike's to-do list. Tapping it opens the job. It clears when the tutorial is finished or a later inspection reports ok.
4. **Job screen.** Always two choices: "Do it myself" (the tutorial, with time and difficulty for this bike) and "Take it to a shop".
5. **Tutorial entry.** A tutorial opened from a finding skips the "is this needed?" question, because the finding already answers it.

**The shop route** of a job holds a short text to tell the mechanic and a price range. The app adds the bike, the findings and what was already done, and shows it as a summary to hand over. Price ranges start as a hand-curated table for Germany, labelled as estimates with a date. A later shop database attaches shops and their prices to the same job ids.

**A diagnosis may read a state differently.** For the symptom "squeals", a squealing but strong brake is a hit; in a routine check it is not. A diagnosis can override the default for single states. Tutorials always map states themselves, to continue, block, stop or end.

## Tutorial rules

A tutorial is one ordered list per mechanism, written by an author in the order a mechanic would work. The step interaction from v0.2 is unchanged: up to three state buttons, a text on tap, "Show solution" in the same step, no loops.

**One tutorial per job, one branch**

- The user sees one tutorial ("Replace brake pads"). Diagnosis, the to-do list and the assistant point at one id.
- It has a single routing branch at the top, by mechanism. Each case may live in its own included file for editing comfort.
- One further nested branch is allowed where the order of work differs (one-piece or cartridge rim pads). No branches on several facts at once.
- "This wheel cannot come out at home" is not a branch. Procedures already hold those shop cases; the app dry-runs the user's path before the start and shows the shop exit before anything is opened.

**Branches exist only in the file.** The case and the procedure implementations are chosen from the user's answers before the first step, so the user sees one straight list of steps. Two exceptions, neither felt as a jump: a fact that is easier to answer while looking at the part (the pad retainer) is asked at its step and can change the remaining step count by one or two, and the jump-ahead button after a stop, which the user presses knowingly.

**Not everything is covered.** A bike, part or symptom outside the content ends on a clear "not covered yet" screen that offers a shop and the assistant. In the files this is an explicit `not_covered` on a tutorial case or a diagnosis. The build fails if any combination of the facts a flow reads has neither a path, a shop exit nor a `not_covered`.

**Order of a case**

1. Checks that need nothing taken apart come first (lever feel, rotor or rim condition). A stop here costs the user nothing.
2. The work, ending with the safety checks that every path must pass.
3. A `finish` section for the good path only: bed-in, test ride, success message.

**Pre-steps are generated,** as in v0.2: bike, brake or wheel, missing route facts, "is this needed?", parts, tools. Each is skipped when the entry context already answers it.

**Stops, blocks and ends**

- **Block:** an unsafe state the user can fix in the step. Next stays disabled until a good state is tapped.
- **Stop:** an unsafe state the user cannot fix. The tutorial stays on that step; the progress bar does not move. The screen shows the message, a primary button "Show me how to put it back" and "Find a shop".
- **The message is written per stop** and names what to put back, because the author knows what is apart at that point. When a wheel is out, it also names the wheel check.
- **The button jumps forward** to the step named by the stop (`show_how_from`). The user knows they jumped ahead in the same tutorial, so the steps keep their normal wording. The path then runs through the safety checks, skips `finish` and ends with the shop summary.
- **End:** the same mechanics with a friendly message, for "this repair is not needed".
- A stop with nothing apart has no jump button.

**State labels.** Action steps declare what they take apart or put back (`sets`, `clears`), and what must not be apart when they run (`forbidden_while`). The labels change nothing the user sees except three things: the 3D scene hides removed parts, standing warnings such as "Do not squeeze the brake lever" show while their state holds, and a paused session can resume with "Does your bike look like this?".

**Durations.** Every step and inspection has `minutes`. The app sums them along the user's actual path and shows a time for this bike, this brake and these tools.

**Unknown facts, tools and safety values** follow v0.2: every condition says what happens when a fact is unknown; tools are required or helpful with safe substitutes and a do-not-use list; safety values are never invented.

## File layout and YAML structure

Content lives in a git repository as YAML, checked against a strict schema on every write. Texts and values in the examples are illustrative.

| File | Holds |
| --- | --- |
| `facts.yaml` | Fact keys, allowed values, beginner question in German and English, safety flag |
| `tools.yaml` | Tool catalog with `substitutes` and `do_not_use` |
| `inspections.yaml` | All inspections |
| `jobs.yaml` | Jobs with tutorial id and shop route |
| `steps/*.yaml`, `procedures.yaml` | Shared steps and procedures |
| `tutorials/<job>/tutorial.yaml` and `cases/*.yaml` | One tutorial, one file per mechanism |
| `diagnoses/*.yaml` | One short file per symptom |
| `checks/routine.yaml` | The routine check |
| `review/` | Mechanic questions and assumptions, kept out of the content files |

**Inspection.** New compared with today: `hands_off`, `minutes`, `focus` and `view` instead of a free-text scene, and `leads_to` on non-ok states.

```yaml
inspections:
  - id: disc-pad-wear
    applies_when: { brake.type.<pos>: [disc_hydraulic, disc_mechanical] }
    hands_off: true              # may be used by diagnosis and the routine check
    minutes: 1
    text: "Shine a light into the brake from above and find the pad material on both sides of the disc."
    tools: { required: [], helpful: [torch] }
    focus: [brake_pads, rotor]   # named 3D nodes to highlight
    view: caliper_from_above     # named camera position
    states:
      - id: ok
        label: "<neutral wear cue, mechanic-approved>"
        meaning: "The pads have plenty of material left."
      - id: worn
        label: "<neutral wear cue>"
        meaning: "The pads are worn and close to their limit."
        leads_to: { job: brake-pads-replace, urgency: soon }
      - id: very-worn
        label: "No material visible, or metal scrapes on the disc"
        meaning: "The pads are worn through. The disc may be damaged."
        leads_to: { job: brake-pads-replace, urgency: do_not_ride }
```

**Job.**

```yaml
jobs:
  - id: brake-pads-replace
    title: "Replace brake pads"
    tutorial: brake-pads-replace       # left out when there is no home tutorial
    shop:
      tell: "The brake pads on this brake are worn and need replacing."
      price_eur: "<range>"             # hand-curated estimate
      price_source: "<source, date>"
```

**Diagnosis.** A symptom, an ordered list, optional overrides.

```yaml
diagnosis:
  id: brake-squeals
  symptom: "My brake squeals"
  params: { pos: { values: [front, rear], from: entry } }
  checks:                    # cheapest and most likely first; the first hit ends the diagnosis
    - inspect: pad-contamination
    - inspect: disc-pad-wear
    - inspect: rotor-condition
    - inspect: brake-power-riding
      override:              # only where this symptom reads a state differently
        squeals: { job: clean-disc-and-pads, urgency: soon }
  no_hit: { job: brake-check-at-shop }
```

**Routine check.** Only a list. Every non-ok state becomes a to-do item through `leads_to`.

```yaml
check:
  id: routine-check
  inspections:
    - { inspect: tyre-pressure, pos: [front, rear] }
    - { inspect: disc-pad-wear, pos: [front, rear] }
    - { inspect: rim-pad-wear, pos: [front, rear] }
    - { inspect: brake-stops-bike, pos: [front, rear] }
    - { inspect: chain-wear }
```

**Step.** New compared with today: `minutes`, `sets`, `clears`, `forbidden_while`, `focus` and `view`.

```yaml
steps:
  - id: slide-out-pads
    kind: action
    minutes: 2
    text: "Pull both pads out of the brake, together with the spring between them."
    sets: [pads_out.<pos>]
    tools: { required: [], helpful: [gloves] }
    focus: [brake_pads]
    view: caliper_side
    animation: { target: brake_pads, motion: remove, direction: "out of the brake", amount: "fully", caption: "Pull the pads out" }

  - id: pump-lever
    kind: action
    minutes: 1
    text: "Squeeze the brake lever slowly several times, until the pads touch the disc."
    forbidden_while: [wheel_out.<pos>, pads_out.<pos>, spacer_in.<pos>]
    focus: [brake_lever]
    view: handlebar_from_above
    animation: { target: brake_lever, motion: squeeze, amount: "fully, several times", caption: "Squeeze the lever several times" }
```

**Tutorial.** One branch by mechanism; cases included.

```yaml
tutorial:
  id: brake-pads-replace
  job: brake-pads-replace
  params: { pos: { values: [front, rear], from: entry } }
  difficulty: 2
  entry:
    requires_finding:
      - { when: { brake.type.<pos>: [disc_hydraulic, disc_mechanical] }, inspection: disc-pad-wear, states: [worn, very-worn] }
      - { when: { brake.type.<pos>: [rim_v, rim_caliper, rim_cantilever, rim_hydraulic] }, inspection: rim-pad-wear, states: [worn, very-worn] }
    not_needed_message: "These pads do not need replacing yet."
    parts: [ ... ]
  cases:
    - when: { brake.type.<pos>: [disc_hydraulic] }
      include: cases/disc-hydraulic.yaml
    - when: { brake.type.<pos>: [disc_mechanical] }
      include: cases/disc-mechanical.yaml
    - when: { brake.type.<pos>: [rim_v, rim_caliper, rim_cantilever] }
      include: cases/rim-cable.yaml
    - when: { brake.type.<pos>: [rim_hydraulic] }
      include: cases/rim-hydraulic.yaml
    - when: { brake.type.<pos>: [roller, coaster] }
      shop: "Roller and coaster brakes have no pads you can replace yourself."
  if_unknown: ask
```

**Case.** Early checks, the work, then `finish`.

```yaml
# cases/disc-hydraulic.yaml
sequence:
  # nothing is apart yet: a stop here has no jump button
  - inspect: hydraulic-lever-feel
    outcomes:
      firm: continue
      soft: { stop: "Do not ride. The brake may have air in it. Take the bike to a shop." }
      reaches-bar: { stop: "Do not ride. The brake builds too little pressure. Take the bike to a shop." }
  - inspect: rotor-condition
    outcomes:
      ok: continue
      damaged: { stop: "Do not ride with this disc. Have a shop check it before you fit new pads." }

  # the work
  - step: ebike-battery-out
  - procedure: hold-bike-<pos>-wheel-out
  - step: photo-before
  - procedure: remove-<pos>-wheel            # sets wheel_out
  - step: push-pistons-back
  - step: pistons-back                        # its stop: show_how_from install-<pos>-wheel
  - procedure: remove-pad-retainer
  - step: slide-out-pads                      # sets pads_out
  - inspect: pad-contamination
    outcomes:
      dry: continue
      oily:
        stop: "Do not ride. There is oil on the brake. Put the old pads and the wheel back, and check that the wheel sits firm, so you can push the bike to a shop."
        show_how_from: insert-pads
  - step: compare-pads                        # its stop: show_how_from insert-pads
  - step: clean-rotor
  - step: insert-pads                         # clears pads_out
  - step: insert-pad-spacer
  - procedure: install-pad-retainer
  - step: pad-pin-secure
  - step: remove-pad-spacer
  - procedure: install-<pos>-wheel            # clears wheel_out
  - step: wheel-secure
  - step: pump-lever
  - step: check-disc-rub
  - procedure: release-bike-<pos>-wheel-out
  - inspect: hydraulic-lever-feel
    outcomes: { firm: continue, soft: { stop: "..." }, reaches-bar: { stop: "..." } }
  - step: ebike-battery-in
  - inspect: brake-stops-bike
    outcomes: { stops: continue, weak: { stop: "..." }, grinds: { stop: "..." } }

finish:                                       # good path only; skipped after a jump ahead
  - step: bed-in-pads
  - inspect: brake-power-riding
    outcomes: { strong: continue, squeals: continue, weak: { stop: "..." } }
```

**Why YAML.** It is readable for reviewers, allows comments and diffs well. Its traps are handled by the schema and by parsing as YAML 1.2. The key `on:` is renamed `outcomes:` because older parsers read `on` as true.

## Build tool

A script runs after every content change and fails loudly. It replaces the self-check that the authoring agent did on its own work.

1. **Validate** every file against the schema. Constructs outside the schema are errors; agents may request a schema change but not invent one.
2. **Expand** each tutorial into every concrete path: one per combination of the facts and tool choices that select a case, an implementation or a conditional step.
3. **Simulate** each path, tracking the state labels, including every stop with and without the jump ahead.
4. **Generate walkthroughs** per path as plain numbered text. Reviewers read these, never the YAML.
5. **Compile** the content to one JSON bundle for the player. The player evaluates the same simple conditions with the same code; it plans nothing.

**Rules the simulation enforces**

- Every path that reaches the end has nothing left apart.
- No step runs while a state it forbids holds.
- Every stop reached with something apart has a `show_how_from`, and the steps from there put back everything that is apart.
- Every path, including each jump-ahead path, passes the safety checks for what was opened (wheel secure, pads secure, lever feel).
- A stop that needs nothing taken apart sits before the first step that opens something.
- At most three buttons or states per screen; `block` and `stop` only in safety checks and inspection calls; no solution on a stop; every block has a fix.
- Diagnoses and the routine check use only `hands_off` inspections.
- Every `leads_to` names an existing job; every job's tutorial exists.
- Every tool, fact, focus target and animation target exists in its catalog or 3D part.
- Safety values come from checked data or from wording that sends the user to the part.

**Reports.** Time range per tutorial and bike profile, and the share of test bikes that end at a shop and why. The second number ranks what to build next.

## Player and 3D

The HTML prototype becomes the player: same feel, but fed by the content bundle instead of hard-coded steps.

- **One card component** for inspections, steps, diagnosis results and stop screens: pinned 3D stage, text, up to three buttons, swipe or Next, progress bar.
- **Progress bar** counts the steps of the user's path. It moves forward only: by Next, or once by the jump-ahead button.
- **Whole bike plus close-ups.** Keep the prototype's simple generated bike for orientation and the camera flight to the part. Add detailed generic parts (caliper, lever, axle end, rim brake arm) for the close-up work. Parts are swapped by facts.
- **Named nodes.** Content refers to parts by node name in `focus` and `animation.target`. The build checks that the names exist.
- **Scenes follow state.** A wheel that is out is not drawn. Authors write `focus` and `view`, not scene descriptions.
- **Kept from the prototype:** tappable parts with names and aliases, explore mode, labels, replay, text-only mode.
- **Assistant button** floats on every card and receives the flow id, the step id, the bike's facts and the session state as context.
- **Technology:** TypeScript with three.js, built to a static link for testers. The final app platform stays open; the player is kept independent of it.

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
- **Storage.** PostgreSQL as proposed in v0.2 is fine. Bikes hold facts, findings, to-do items and session state; the content bundle is built from the repository and never edited in the database.

## How content gets made

Agents write, a script checks, a second agent reads the result cold, and a mechanic signs what touches safety.

| Role | Does | Sees |
| --- | --- | --- |
| Writer agent | Writes or revises one case, one diagnosis or a set of inspections | Schema, policy book, one polished example, checked part rows |
| Build script | Validates, expands, simulates, generates walkthroughs | Everything |
| Auditor agent | Reads the walkthroughs as a mechanic and as a beginner; files findings | Walkthroughs and source pages only, never the writer's context |
| Research agent | Finds the maker document for one part family and fills its row | Web, the table schema |
| Mechanic | Signs part rows and one walkthrough per path for brakes, wheels and anything load-bearing | Walkthroughs with the changed paths marked |
| Owner | Decides policy questions once | A short decision list with a recommended default each |

- **Schema first.** The first agent run produced good content but invented its notation while writing. The schema and the build script exist before more content is written.
- **Policy book.** Owner decisions are recorded once with a date and read by every agent, so answered questions are not asked again.
- **Assumptions instead of questions.** An agent that is unsure writes down an assumption with a cautious default and moves on. Assumptions are sorted to the mechanic or the owner in `review/`.
- **Sign-off follows paths, not files.** A change marks only the walkthroughs it alters for a new signature.
- **Low-risk content needs no mechanic:** chain care, tyre pressure, wording changes that the build shows do not alter a safety path.
- **Legal check** on guided brake work is still needed before brake content ships.

## Changes to the existing YAML files

Most of `brake-pads-replace.yaml` (draft 2) and `inspections.yaml` (draft 1) stays: the steps and their texts, buttons, blocks, tools, parts, procedures and the fact manifest.

**brake-pads-replace.yaml**

| Change | Where |
| --- | --- |
| Rename `on:` to `outcomes:` | Every inspection call |
| Add `minutes` to every step; drop `meta.duration_minutes` | All steps |
| Add `sets`, `clears`, `forbidden_while` | Action steps that open or close something, and `pump-lever` |
| Remove hand-written standing warnings from step texts | `drop-front-wheel`, `drop-rear-wheel`, `hs-remove-pads` |
| Replace free-text `scene` with `focus` and `view` | All steps |
| Rewrite stop messages reached with something apart, and add `show_how_from` | `pistons-back`, `pad-contamination`, `compare-pads`, `rotor-condition` if it stays after wheel removal |
| Move checks that need nothing apart to the start of the case | `rotor-condition`; add `hydraulic-lever-feel` at the start of both hydraulic cases |
| Move good-path-only steps into `finish` | `bed-in-pads`, `brake-power-riding` |
| Rename `insert-new-pads` to `insert-pads` | It is also the jump target after a stop |
| Delete the route branches | `disc-hydraulic-route`, `disc-mechanical-route`; the shop cases already in `remove-front-wheel` and `remove-rear-wheel` are found by the dry run |
| Park the wheel-in draft | Four steps, its case, `brake.pad_loading` |
| Add `job:`; move each case to `cases/*.yaml` | Tutorial header |
| Move `mechanic_review` and `open_questions` to `review/` | End of file |

**inspections.yaml**

| Change | Where |
| --- | --- |
| Add `leads_to` (job and urgency) | Every non-ok state |
| Add `hands_off` and `minutes` | Every inspection |
| Replace `scene` with `focus` and `view` | Every inspection |
| Add inspections for the other launch jobs | Tyres, chain, shifting, lights |

**New files:** the schema, `jobs.yaml`, the first diagnoses, `checks/routine.yaml`, and the tools catalog moved out of the tutorial.

**Unchanged but still unverified:** the wear cues, the piston push-back method, the Magura HS steps and the other items on the mechanic list.

## Requirements check

Each expectation from the idea document, and how this approach meets it.

| Requirement | How it is met | Status |
| --- | --- | --- |
| A. Symptom, diagnosis, then tutorial or shop | A diagnosis file per symptom; the first hit opens the job screen with both choices | Covered; no diagnosis content exists yet |
| Shop exit says what to tell them and what it costs | Job's shop route plus generated summary; curated price ranges | Covered in structure; price data is open |
| Works for someone who knows nothing about bikes | Inspections describe what is seen; picture questions; no part names required | Covered; depends on wording and reference pictures |
| B. Open a tutorial directly, only needed questions | Generated pre-steps, skipped when already answered | Covered |
| C. Assistant leads into flows and pre-fills | Opens flows by id with an entry context; inferred facts confirmed by one tap | Covered in structure; the assistant itself is not designed |
| Assistant available inside a tutorial | Button on every card with flow, step, facts and state as context | Covered in structure |
| D. Routine check with a to-do list on the bike | A list of inspections; findings with a job become to-do items that open tutorials | Covered |
| Swiping steps, clear animations, highlighted and tappable parts | The prototype becomes the player; whole-bike view is kept | Covered |
| Progress bar without surprising jumps | Forward only; a stop stays put; one jump only when the user presses the button | Covered |
| Bike never left in pieces | Stop message names what to put back; jump ahead shows how; the build checks it | Covered |
| Unknown bike works; vague part names are fine | Facts asked when needed; free text kept as a claim | Covered |
| Never invent safety values | Checked rows or "read it off the part" | Covered |
| Cheap bike identification, one AI lookup on the free tier | Questions and photos free; lookup metered and cached | Covered; the lookup agent is not built |
| Online parts shop with matching part | Parts carry the code from the part or the service table; partner search hooks into the parts pre-step and the to-do list | Structure only |
| Database of local shops and prices | Shops attach to job ids | Later |
| QR code from a maker: bike pre-filled | The parts list arrives as facts, so pre-steps ask nothing | Covered in structure |
| Welcome and assembly guide | An ordinary tutorial tied to the partner's bike | Covered in structure |
| Warranty claim after diagnosis | For a partner bike, the job screen gains a third choice, "Send to the maker", with the findings attached | Structure only |
| Chat with the company | Outside the content model; a feature of the app shell | Not designed |
| Content by agents with minimal human review | Schema, build checks, auditor agent; mechanic limited to safety paths | Partly: a mechanic stays for brakes |
| Slider scenes | Not included; no use case | Dropped for now |

## Open decisions and build order

**For the owner**

- **Hands-off diagnosis.** This approach never takes anything apart during diagnosis; the in-hand check happens at the start of the tutorial. Your draft policy P2 had diagnosis pull the pads on some calipers. Confirm or overrule.
- **How long findings and to-do items are kept,** and whether an old finding still skips the "is this needed?" question.
- **Where shop price ranges come from** and who maintains them.
- **First content.** Recommended: low-risk, frequent jobs first (chain care, tyre pressure, flat tyre, cable brake adjustment), with hydraulic disc pads as the test of the model rather than the first release.
- **First partner brand** for the QR route, since it also solves bike data.

**For a mechanic:** the list already in the brake pad file, moved to `review/`.

**Build order**

1. Write the schema and the build script (validate, expand, simulate, walkthroughs).
2. Turn the prototype into the player, fed by one small low-risk tutorial in the new format.
3. Add `jobs.yaml`, one diagnosis ("my brake squeals") and the routine check, to prove the shared inspections, findings and the to-do list end to end.
4. Convert the brake pad files as listed above and run them through the build.
5. Bring in the mechanic and the legal check before any brake content reaches users.
