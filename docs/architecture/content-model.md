# The content model

The words content, the build tool and the app share. Every field is in `schema/`; the rules for writing are in `content/CLAUDE.md`.

| Word | What it is | Where |
| --- | --- | --- |
| fact | a lasting property of the bike (`drive.gear_type`), asked in the facts phase, kept on the bike when the user saves it | `content/facts.yaml` |
| check | a shared look, listen or feel with two or three named states (called an inspection in the files); not the routine check, not `npm run check` | `content/inspections.yaml` |
| card | one screen of a flow: an action, a check or a safety check (called a step in the files) | the job file; `content/steps/` when shared |
| procedure | a shared run of cards, one implementation per fact or tool | `content/procedures.yaml` |
| run choice | asked fresh in every run, never stored (`choice.hold_bike`, whose values are the holding options) | `content/choices.yaml` |
| tool, tool set, part | what the user needs; tools are owned, parts are bought | `content/tools.yaml` |
| state label | what is apart or how the bike is held right now (`sets`, `clears`, `forbidden_while`) | `content/states.yaml` |
| job | one fix: covers, shop route (what to tell, price), service, and maybe a tutorial | `content/jobs/<job>.yaml` |
| flow | a diagnosis, the routine check, or a tutorial (a job's `flow`) | `content/diagnoses/`, `content/checks/`, `content/jobs/` |
| test bike | a profile: a bike, its journeys and the answers its owner gives | `profiles/` |
| finding | the dated state a check reported on a bike | the garage |
| the garage | the user's saved bikes (facts, findings, finished jobs) and owned tools | `player/src/engine/store.ts` |

- A check carries the knowledge: what to look at, its states, and what each state calls for (`leads_to` a job with an urgency). A diagnosis or the routine check only lists which checks to run; no decision trees are written. A finding with a job becomes a to-do on the bike.
- A tap inside a card is not stored. Only facts, findings and finished jobs reach the garage.
- Branches exist only in the file: the app picks the way from facts and run choices, so the user sees one straight list. An exit reached with something apart names what to put back and jumps ahead to the cards that show how (`show_how_from`).
- Every card has `minutes`; the app and the report sum them along a path.
