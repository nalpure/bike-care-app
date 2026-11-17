# Assumptions

Assumptions made by agents without asking the owner (CLAUDE.md, hard rule 8). Each has a cautious default that is already in the content or the tools. The owner can overrule any of them; an overruled or confirmed assumption moves to `idea-changes.md` or `approach-changes.md`.

Mechanics doubts are not listed here. They live in `content/review/<job>.md`.

| Id | Date | Assumption | Cautious default in use | Where |
| --- | --- | --- | --- | --- |
| A-01 | 2026-11-17 | A derailleur that looks bent may catch in the spokes. | Urgency `do_not_ride`; the diagnosis ends at a shop job. | `inspections.yaml` `derailleur-alignment` |
| A-02 | 2026-11-17 | The diagnosis order "cheapest first" ties between the derailleur look and the chain look (1 minute each). | The derailleur look runs first, because the third check is a test ride and a bent derailleur must not be ridden. | `diagnoses/gears-shift-badly.yaml` |
| A-03 | 2026-11-17 | Electronic shifting shares the first two inspections with mechanical shifting, but adjusting it is different. | The whole diagnosis and tutorial say "not covered" for electronic shifting, rather than running half a diagnosis. | `gears-shift-badly.yaml`, `adjust-rear-shifting/tutorial.yaml` |
| A-04 | 2026-11-17 | A user who cannot tell the gear type or the shifting type ("I'll check later") cannot be guided safely. | Not covered, with a short hint on what to look at, a shop and the assistant. | same files |
| A-05 | 2026-11-17 | The diagnosis's "no hit" (everything looks fine, still shifts badly) needs a mechanic. | `no_hit` goes to `derailleur-check-at-shop`, whose shop text is general enough for both uses. | `jobs.yaml` |
| A-06 | 2026-11-17 | Shop prices are not known. | `price_eur: "<range>"`; the player shows "no estimate yet" for any value in angle brackets. | `jobs.yaml` |
| A-07 | 2026-11-17 | 3D node, view and clip names did not exist yet. | Names in snake_case (clips in kebab-case), taken from the prototype's parts and animations, in `schema/3d-catalog.yaml`. The player must provide them or export its own manifest. | `schema/3d-catalog.yaml` |
| A-08 | 2026-11-17 | A heavy-bike warning needs no new schema field. | The warning is the second sentence of the step text, and the `warning` of the run choice option. | `steps/holding.yaml`, `choices.yaml` |
| A-09 | 2026-11-17 | The routine check may include a short test ride. | `shift-test-ride` is in the routine check; it is hands-off (AC-04). | `checks/routine.yaml` |
| A-10 | 2026-11-17 | ~~Readable button labels are stable enough to identify a button in a profile.~~ Superseded by button ids (AC-25). | — | — |
| A-11 | 2026-11-17 | Reviewers want to see changes in generated output. | `build/` is committed to git and is deterministic. | `.gitignore`, AC-16 |
| A-12 | 2026-11-17 | Hanging a bike from a hook or rope needs a tool entry so the tool picker can show it. | Tool `hook-or-rope`, required by the option `hang`. | `tools.yaml`, `choices.yaml` |
| A-13 | 2026-11-17 | Most bikes with an unknown derailleur type have a standard derailleur. | `drive.rear_derailleur_type` unknown runs the normal guide; only `low_normal` from the bike's data ends at "not supported". | `tutorial.yaml`, `gears-shift-badly.yaml` |
| A-14 | 2026-11-17 | "Same session" means one sitting: a diagnosis and the tutorial opened from it. | Findings from earlier days do not skip a check yet (approach.md lists this as open). | AC-20 |
