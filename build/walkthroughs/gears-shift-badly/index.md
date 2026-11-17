# Diagnosis `gears-shift-badly`: all paths

> Test build. The repair steps are unverified drafts and were not checked by a mechanic.

| Path | Bike | Ends at job | Time |
| --- | --- | --- | --- |
| [derailleur.mechanical--derailleur-alignment-crooked](derailleur.mechanical--derailleur-alignment-crooked.md) | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | derailleur-check-at-shop (do_not_ride) | 1 min |
| [derailleur.mechanical--chain-condition-dry-or-rusty](derailleur.mechanical--chain-condition-dry-or-rusty.md) | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | chain-care (soon) | 2 min |
| [derailleur.mechanical--chain-condition-dirty](derailleur.mechanical--chain-condition-dirty.md) | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | chain-care (soon) | 2 min |
| [derailleur.mechanical--shift-test-ride-slow-to-bigger](derailleur.mechanical--shift-test-ride-slow-to-bigger.md) | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | adjust-rear-shifting (soon) | 5 min |
| [derailleur.mechanical--shift-test-ride-slow-to-smaller](derailleur.mechanical--shift-test-ride-slow-to-smaller.md) | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | adjust-rear-shifting (soon) | 5 min |
| [derailleur.mechanical--no-hit](derailleur.mechanical--no-hit.md) | `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | derailleur-check-at-shop | 5 min |

## Not covered

| Bike | Exit | Message |
| --- | --- | --- |
| `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = mechanical ("A thin cable in a housing")<br>`drive.rear_derailleur_type` = low_normal (never asked; from the bike's data) | not_covered | Rapid-rise rear derailleurs are not supported yet. A shop can check them. You can also ask the assistant. |
| `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = electronic ("A wire with a plug, or no wire at all") | not_covered | Electronic shifting is not covered yet. A shop can check it. You can also ask the assistant. |
| `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = unknown ("I'll check later")<br>`drive.rear_derailleur_type` = standard or unknown (never asked; from the bike's data) | not_covered | We need to know whether your gears use a cable. Look at the right shifter and come back. You can also find a shop or ask the assistant. |
| `drive.gear_type` = derailleur ("Several sprockets, and a part below them that guides the chain")<br>`drive.shifting` = unknown ("I'll check later")<br>`drive.rear_derailleur_type` = low_normal (never asked; from the bike's data) | not_covered | Rapid-rise rear derailleurs are not supported yet. A shop can check them. You can also ask the assistant. |
| `drive.gear_type` = hub_gear ("One sprocket, and a thick hub in the middle of the wheel") | not_covered | Hub gears are not covered yet. A shop can check them. You can also ask the assistant. |
| `drive.gear_type` = gearbox ("One sprocket, and a box at the pedals") | not_covered | Gearboxes at the pedals are not covered yet. A shop can check it. You can also ask the assistant. |
| `drive.gear_type` = single_speed ("One sprocket, and no way to change gear") | not_covered | Your bike has only one gear, so this check does not fit it. If the chain skips or clunks, a shop can help. You can also ask the assistant. |
| `drive.gear_type` = unknown ("I'll check later") | not_covered | We need to know what kind of gears your bike has. Look at the rear wheel and come back. You can also find a shop or ask the assistant. |
