# Bike maintenance app: idea and expectations

Nov 16, 2026 · @Benedikt

## At a glance

This is the owner's reference for what the app should be and feel like. It records intent and expectations only. How to build it (content model, database, pipeline) is deliberately left out, because that is still being debated across v0.2, v0.3 and v0.4.

- **Fairly certain:** the user experience described here.
- **Not decided:** architecture, data source, platform, launch content, pricing.
- **Rule for future agents:** treat this document as the goal. Implementation proposals may challenge how, not what.

The app takes a beginner from "something is off with my bike" to a repair they can do themselves on their own bike, or to a clear, well-prepared visit to a shop.

## Product and users

A mobile app with a virtual garage, guided diagnosis, interactive 3D tutorials, a routine check and an assistant.

- **Users:** mostly beginners who may know nothing about bikes or the names of their parts. The app must work for them without jargon.
- **Market:** Germany first (tentative). That means many e-bikes, trekking and city bikes, with hub gears, hydraulic rim brakes, roller and coaster brakes, dynamo hubs and Dunlop valves, besides mountain and road bikes.
- **Repair areas:** shifting, brakes, drivetrain wear, tyres and flats, basic care such as chain lubrication.
- **Out of scope for the user:** motor, battery and firmware work, brake bleeding, anything workshop-only. These end at a shop.
- **Languages:** German and English tutorials; multilingual UI.

## Four ways in

Every way in must give the best possible experience, and each passes on what it already knows so nothing is asked twice.

| Way in | What the user does | What must happen |
| --- | --- | --- |
| A. Symptom | Taps what is wrong in plain words ("brakes squeak", "no brake power") | Guided diagnosis that needs no bike knowledge. It ends in a choice: do the matching tutorial, or go to a shop with a summary of what to tell them and what it will roughly cost. |
| B. Known job | Taps a tutorial directly ("Fix a flat", "Change brake pads", "Lube the chain") | Only the questions this job needs, then the tutorial. |
| C. Assistant | Asks the floating assistant in free text | The assistant answers, or leads into a diagnosis or tutorial and pre-fills what it learned. |
| D. Routine check | Walks through a fixed check of the bike | Findings land on a to-do list linked to that bike in the garage. Each item opens its tutorial. |

**Questions.** In every flow the app asks only what is needed, when it is needed, with pictures where possible. A missing answer never blocks the user.

**Shop exit.** "Go to a shop" is a normal, respectable outcome at any point, not a failure.

## The tutorial experience

The HTML prototype ("Bikefix Garage Guide", rear derailleur indexing) is the reference for how a tutorial should feel. Its step texts are weak; its interaction is right.

**What the prototype gets right and must be kept**

- One step per screen; swiping or tapping through steps is quick and fun.
- A 3D view stays pinned while the text changes. The camera flies to the part the step is about.
- The relevant parts are highlighted, the rest fades. Small labels name the parts.
- Parts can be tapped to learn their name, other common names and what they do. A full-screen explore mode lets the user rotate and zoom.
- Animations are short and clear, loop, and can be replayed.
- The scene and the text are built from the bike's record and the user's tools (city, road or mountain bike; with or without a stand), not pre-made per bike.
- A text-only mode exists.

**How a step works**

- A check asks "What do you see on your bike?" with at most three answers in the user's words.
- Tapping an answer shows a short explanation. "Show me the fix" plays the fix as an animation in the same step.
- The user can choose again at any time and moves on with Next. No loops, no automatic jumps back.
- Safety checks are their own steps. An unsafe result either blocks until fixed or stops with a shop referral.

**Assistant.** A floating button is available everywhere, including inside a tutorial, and answers questions based on the step the user is on. Probably a premium feature.

**Idea, not a requirement.** Interactive scenes with a slider that changes something in the scene. No use case found yet.

## Garage and bike data

The garage holds the user's bikes, but the app never demands a complete bike.

- **An unknown bike works.** A tutorial can run with nothing known and ask as it goes.
- **The bike learns.** Answers given in any flow are kept on the bike and never asked again.
- **Vague is fine.** A user may name a part as loosely as they like ("Shimano"). That is useful input, never an error.
- **Adding a bike should be nearly effortless.** Ideally the user names it and the parts come with it.
- **Each bike carries:** its known facts and parts, findings from checks, a to-do list of open repairs, and later a service history.
- **Never guess safety values** (brake fluid, torque, pad compatibility, wear limits). Use verified data or tell the user to read the value off the part.

**Constraint on bike data (16 Nov 2026).** 99 Spokes quoted on-demand access from 100 USD per month and bulk access at "a lot more". That is too much at the start. A cheaper way to identify bikes is needed. One idea: the user enters brand, model, series and year as free text and an AI agent looks the bike up online. Because each lookup costs money, a free-tier user gets it once.

## Shops: local repair and online parts

These are two different things and should stay separate.

**Local repair shops**

- Every shop exit gives the user a short summary to show or tell the mechanic: the bike, what was found, what was already tried.
- It also says what the repair will roughly cost.
- Later: a database of local shops with their services and prices.

**Online parts shop**

- The app knows which part fits (for example the matching brake pads) and searches partner online shops for it.
- The moment before a tutorial ("Do you have the part?") and the to-do list are the natural places to offer it.
- Online shops are a different set of partners from local repair shops.

Both are secondary to getting diagnosis and tutorials right, but the tutorials should already collect what they need.

## Partnerships with bike makers and online bike shops

Bikes shipped partly disassembled come with a printed manual and a QR code to the app. The aim is a better customer experience and less warranty work for the company.

1. The customer scans the QR code and gets the app with a free period (one year is the working idea).
2. The exact bike is added to their garage automatically, with all its parts. No questions needed.
3. A welcome guide walks them through assembling and setting up the bike.
4. A "Claim warranty" button sends the user through diagnosis first. Only if they cannot fix the problem is the claim forwarded to the company, with the findings attached.
5. A chat with the company is available from the bike.

**What each side gets**

| Side | Benefit |
| --- | --- |
| Customer | Guided assembly, a bike the app already knows, quick help before a claim |
| Company | Fewer avoidable warranty claims and support contacts; claims arrive pre-diagnosed |
| The app | Exact bike data at no cost, users without acquisition spend, a paying business customer |

## Safety and content production

**Safety principles**

- Never block the user because data is missing; ask one simple question or use wording that is right for every bike.
- Never invent safety values.
- Safety checks are separate steps and always run at the end of work on brakes, wheels or anything load-bearing.
- A bike must never be left in pieces: every way out of a tutorial ends with the bike reassembled, or with a clear "do not ride" and a shop referral.

**How content should be made**

- Tutorials, inspections and diagnosis are data, not code, written and audited by AI agents.
- Human review should be as small as possible. Agents should do the research on niche components that no single mechanic knows.
- Known tension: every proposal so far says brake content needs a mechanic's sign-off, and a legal check on liability is still open. "Minimal" review is the wish; "none" is unlikely for brakes.

## Free and premium

Nothing here is decided; these are the hints given so far.

| Feature | Tier idea |
| --- | --- |
| Diagnosis, tutorials, garage with an unknown or self-described bike | Free |
| AI lookup of a bike from free text | Once on the free tier, because each lookup costs money |
| Floating assistant | Probably premium |
| Bikes added by a partner's QR code | Premium included for a period, paid for by the partner |
| Parts links and shop referrals | Free; possible revenue through partners |

## Open points and document history

**Open**

- Implementation approach for tutorials and diagnosis (v0.2, v0.3 or v0.4, or a mix).
- How bikes are identified without a licensed catalog.
- Where shop price estimates come from.
- Which jobs ship first, and whether a partner brand is the first customer.
- App platform, the mechanic reviewer, the legal check for guided brake work, privacy.
- How long findings and to-do items are kept, and how the assistant's guesses get confirmed.

**Documents so far**

| Document | What it is |
| --- | --- |
| v0.1 (PDF) | First idea, written around the bike database and data sourcing |
| Feasibility review | Fact vocabulary, part tree, symptom flow, German market gap |
| v0.2 | Symptom first, interactive tutorials, inspections, generated pre-steps; the agent prompts and the brake pad YAML follow it |
| v0.3 | Proposal: session ledger, component knowledge tree, runtime compiler, large agent pipeline |
| v0.4 | An agent's review of v0.3, titled "final plan": authored scripts checked by a simulator, flat service table, component-scale 3D. Not decided by the owner. |
| HTML prototype | Reference for the tutorial feel |
| This document | The owner's intent, independent of any of the above |
