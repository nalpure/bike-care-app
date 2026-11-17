# Changes to the idea document

This file records every owner decision that changes, extends or clarifies [idea.md](idea.md). It uses the same sections in the same order. **Where this file and `idea.md` disagree, this file wins.**

Each entry has an id (`IC-nn`), a type (**changes**, **extends** or **clarifies**), what `idea.md` says, what holds now, and why. Implementation details live in [approach-changes.md](approach-changes.md); entries here are about intent and user experience only.

## At a glance

No changes.

## Product and users

No changes.

## Four ways in

No changes.

## The tutorial experience

### IC-01 The user decides how to hold the bike (extends)

- **Date:** 2026-11-17 · **Decided by:** owner
- **idea.md:** "The scene and the text are built from the bike's record and the user's tools (… with or without a stand)."
- **Now:** Before a tutorial that needs the rear wheel free, the user picks how to hold the bike: a work stand (recommended), hanging from a hook or rope, upside down, or on its wheels with short test rides. The app recommends and warns (heavy bikes can hurt when lifted or turned over) but never decides for the user. There are heavy normal bikes and light e-bikes, so the app does not judge by bike type. Without any way to lift the bike, the user adjusts while the bike stands and tests by riding, changing settings only when stopped.
- **See:** AC-01, AC-07, AC-10 in [approach-changes.md](approach-changes.md).

## Garage and bike data

### IC-02 Ask only what changes the steps; use the rest when known (clarifies)

- **Date:** 2026-11-17 · **Decided by:** owner
- **idea.md:** "In every flow the app asks only what is needed, when it is needed."
- **Now:** A question is asked only when its answer changes which steps the user sees. Everything else (number of gears, model names) is never asked. When it is already known, the step text becomes more specific, to show that the app knows the bike ("the manual for your Shimano 105 derailleur…") or to add information. The user is expected to answer the questions that are asked; "I'll check later" still never leads to a guess.
- **See:** AC-02, AC-08 in [approach-changes.md](approach-changes.md).

## Shops: local repair and online parts

No changes.

## Partnerships with bike makers and online bike shops

No changes.

## Safety and content production

No changes.

## Free and premium

No changes.

## Open points and document history

No changes.
