# The content model

The words content, the build tool and the app share, and how a flow runs. Every field is in `schema/`; the rules for writing are in `content/CLAUDE.md`.

| Word | What it is | Where |
| --- | --- | --- |
| fact | a lasting property of the bike (`drive.gear_type`), asked in the facts phase, kept on the bike when the user saves it | `content/facts.yaml` |
| check | a shared look, listen or feel with two or three named states (called an inspection in the files); not the routine check, not `npm run check` | `content/inspections.yaml` |
| card | one screen of a flow: an action, a check or a safety check (called a step in the files) | the job file; `content/steps/` when shared |
| procedure | a shared run of cards, one implementation per fact or tool | `content/procedures.yaml` |
| run choice | asked fresh in every run, never stored (`choice.hold_bike`, whose values are the holding options) | `content/choices.yaml` |
| tool, tool set, part | what the user needs; tools are owned, parts are bought | `content/tools.yaml` |
| state label | anything to undo before riding: what is apart, or a bike in a stand, hung or upside down (`sets`, `clears`, `forbidden_while`) | `content/states.yaml` |
| job | one fix: covers, shop route (what to tell, price), service, and maybe a tutorial | `content/jobs/<job>.yaml` |
| flow | a diagnosis, the routine check, or a tutorial (a job's `flow`) | `content/diagnoses/`, `content/checks/`, `content/jobs/` |
| test bike | a profile: a bike, its journeys and the answers its owner gives | `profiles/` |
| finding | the dated state a check reported on a bike | the garage |
| the garage | the user's saved bikes (facts, findings, finished jobs) and owned tools | `player/src/engine/store.ts` |

- A check carries the knowledge: what to look at, its states, and what each state calls for (`leads_to` a job with an urgency). A diagnosis or the routine check only lists which checks to run; no decision trees are written. A finding with a job becomes a to-do on the bike.
- A tap inside a card is not stored. Only facts, findings and finished jobs reach the garage.
- Branches exist only in the file: the app picks the way from facts and run choices, so the user sees one straight list. An exit reached with something apart names what to put back and jumps ahead to the cards that show how (`show_how_from`).
- Every card has `minutes`; the app and the report sum them along a path.

## How a flow runs

The owner's rules for every flow. Where the app does not do this yet (the phase intros, the routine check's overview), it is not built yet.

- **Three kinds, kept apart.** Diagnosis, routine check and tutorial stay separate kinds in content and in the app (never one list), each with its own look and a clear hand-over screen between phases. A routine check may lead to a diagnosis or a tutorial, a diagnosis to a tutorial; nothing else. Checks are shared by all three.
- **Phases.** Every flow runs: facts (no 3D, except questions with 3D fields, which come last), then the offer to save them, then tools, then how to hold the bike, then the main phase. The work stand is an optional tool; with it the holding question is skipped (the heavy-bike warning still shows); without it the user picks hanging, upside down or on its wheels. No hook in the tool list. The holding question comes only when the flow branches on it, and a job offers only the holding options that suit it (SR-08).
- **Phase intros.** Before a phase with several screens (facts, the main phase) a screen says which phase comes and what happens in it, with a Start button. No numbering, no progress strip. A phase of one screen (tools and parts, holding) carries the phase title on that screen instead.
- **Holding the bike.** The app recommends and warns (every option and step that lifts, hangs or turns the bike warns about heavy bikes) but never decides, and never judges by bike type. Without a way to lift the bike, the user adjusts while it stands and tests by riding, changing settings only when stopped.
- **Diagnosis.** Every check must be answered and has a help icon (why, how, ask the assistant). Fine: shown as good, then on by itself. A finding ends it: what is wrong, a to-do, maybe unrideable, then shop, tutorial or later. All fine: text on what it could still be, maybe unrideable, always a to-do. After a tutorial started from a diagnosis, "Is the problem gone?" is asked.
- **Routine check.** Same look as a diagnosis, but a finding does not end it: explained, to-do (maybe unrideable), then on. A check that needs riding after an unrideable finding is skipped with a warning. At the end an overview of all to-dos with shop price, tutorial time and parts; "no estimate yet" while prices are placeholders.
- **Tutorial.** It can be swiped from start to end; only a tap on a problem can lead to an exit. No loops: the user taps a different answer once it is fixed. It runs no checks before the work and learns no facts about the bike, only its current state (to-dos, do not ride). At the end the matching to-do is marked done.
- **Niche variants.** Rare variants a beginner cannot recognise are never asked about; when the bike's data reveals one, the user sees "not supported yet" with a shop and the assistant. Rare variants the user can see are found before any work starts and end the same way.
