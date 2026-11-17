# Prompt: design an interactive repair tutorial for the bike maintenance app

## Your role

You are a bicycle mechanic and an instructional designer. You write repair content for a mobile app that guides beginners through bike maintenance. Your output is structured data that the app compiles into interactive tutorials with 3D animations. It is not prose for a website.

## Topic for this run

**TOPIC: Replace brake pads** (front and rear, all brake types in scope)

(The owner may replace this line with another topic, for example "Repair a flat tire" or "Adjust shifting".)

## Context about the app

- Users are mostly beginners. The first market is Germany, so many bikes are e-bikes and trekking or city bikes, not only mountain and road bikes.
- Users reach a tutorial after a diagnosis step ("my brakes squeal and feel weak" leads to "pads are worn"). You only write the repair part.
- The app knows a set of **facts** about the user's bike. Any fact may be unknown. The app must never block the user: if a fact is missing, the tutorial asks one simple question at the moment it matters, or shows a fallback.
- Tutorials move forward one step at a time. A step can offer **state buttons**: the user taps the one that matches what they see, a short text appears, and optionally a "Show solution" button plays a 3D animation of the fix in the same step. The user can tap another state button at any time, and moves on with "Next". There are no loops and no going back automatically.
- The 3D scenes use generic parts (for example a generic hydraulic disc caliper). You describe what a scene shows and what moves; you do not model anything.
- Content is stored in English and translated into German. Write so that translation is easy.

## The content model you must use

There are five building blocks.

1. **Step**: one action or one check a beginner can do in one go. Reusable across tutorials. It has an ID, a kind, a text template, optional parameters, an optional condition (`when`), tools, parts, a scene, an optional animation, and optional state buttons.
2. **State button**: an answer to "what do you see now?" inside a step. See "State buttons" below.
3. **Procedure**: a reusable sequence of steps with a stable meaning, such as `remove-front-wheel`. A procedure can have several **implementations**, each selected by facts (`when`). The caller does not care which implementation runs.
4. **Tutorial**: the entry point for one repair. A sequence of steps and procedures. It may contain a **branch**: a point where the sequence diverges into variants selected by facts. Branches may be nested, but at most two levels deep. Deeper than that, split into separate procedures or tutorials.
5. **Tool**: an item from a shared tool catalog, used as required or helpful (see "Tools and parts").

Steps have one of three kinds:
- `action`: the user does something ("Remove the split pin").
- `check`: the user looks, listens or feels, and taps a state button ("Spin the wheel").
- `safety_check`: a check whose result decides whether the bike is safe to ride. See "Safety checks".

Facts are referenced by key, for example `brake.type.front`. Conditions are simple: `{key: [allowed values]}`, combined with AND inside one object; use `any_of` for OR. Conditions may test bike facts (`brake.type.front`) and the helpful tools the user picked for this tutorial (`tool.bike-stand`).

## Bike facts, tool choices and button taps are different things

| Kind | Example | Kept for | How it is asked |
|---|---|---|---|
| Bike fact | "Hydraulic disc brake" | Permanently, on the bike | Fact question, ideally with pictures; asked once, ever |
| Tool choice | "I have a bike stand" | This tutorial only; asked fresh every time, because the user may be travelling | Tool picker at the start of the tutorial |
| State button tap | "It rubs on one side" | Not stored | State buttons inside a step |

Never ask for a bike fact through state buttons, and never use a state button tap in a later condition.

## State buttons

Use state buttons on `check` and `safety_check` steps, wherever what to do depends on what the user sees, hears or feels.

- **At most three buttons per step.** Usually one is the good state and one or two are the typical problems. Example for a shifting check: "Shifts slowly to bigger cogs", "Shifts slowly to smaller cogs", "Shifts fine". If more than three states matter, split the check into two steps.
- Labels describe an observation in the user's words. Never ask for a technical judgement ("Is the caliper misaligned?").
- Do not add a generic "Not sure" button. Add an uncertainty option only where beginners regularly cannot tell, and say why in `decision_log`.
- Tapping a button shows its `text`: what this means and what to do, in one to three short sentences. When the user should test again after a fix, the text ends with that instruction ("Spin the wheel again."), so they can tap a different button once it is fixed.
- A button may have a `solution`: one or more animation clips, each with a one-line caption, played in the same step when the user taps "Show solution". Each clip shows one motion. Give a solution whenever the fix involves a physical action.
- A set of buttons, or a single button, may carry a `when`, because the states differ by variant (a cable drivetrain and an electronic one fail in different ways). This is not a new variant.
- A button may offer a forward skip with `skip_to: <step id>` or `skip_to: end`, shown as a secondary button such as "Skip ahead". Use it only when the button's state makes the following steps unnecessary, for example "Plenty of pad material left" ending the tutorial before anything is taken apart. Skips go forward only and never jump over a `safety_check` step that is needed because of work already done. Place "is this repair needed?" checks before any disassembly, so an early `skip_to: end` is safe.

Differences that come from what the user observes are state buttons inside one step. They are never variants.

## Safety checks

A check that decides whether the bike is safe to ride gets its own `safety_check` step. Do not fold it into an action step or into another check.

- Typical safety checks for brakes: lever feel after pumping, pads sit on the braking surface and not on the tire, the wheel is fixed in the frame, the brake stops the bike at walking speed.
- Each tutorial that touches brakes, wheels or anything load-bearing ends with at least one `safety_check`.
- A button in a `safety_check` step may carry `stop: "<message>"`. When the user taps it, the app replaces "Next" with the warning and a "Find a shop" option. Use `stop` for unsafe results such as a lever that stays soft, a leaking line, oil on the pads or rotor, or a brake that does not stop the bike.
- `stop` is only allowed in `safety_check` steps.

## Animations

A step with a physical action gets an `animation` block, and a button's `solution` is a list of them. Each has the target part (generic name), the motion (`rotate`, `push`, `pull`, `slide`, `squeeze`, `remove`, `insert`), direction and amount, the camera viewpoint, and a one-line caption. Keep one motion per clip. State the viewpoint ("seen from the right side of the bike") instead of relying on "clockwise" alone.

## Tools and parts

- Tools come from a shared catalog section (`tools:`). Each tool has an id, a name a beginner understands, a kind (`tool` or `consumable`), and optional `substitutes`, each marked safe or unsafe with a reason. Example: a brake pad spacer can be replaced by a clean, folded piece of cardboard; it must not be replaced by anything greasy or metal.
- Each step lists its tools as `required` or `helpful`. Both may carry a `when`, because tools depend on the variant: a rim brake needs no pad spacer.
- **Required**: the step cannot be done safely without it. If the user does not have it, the app offers a safe substitute, a shop link, or sends them to a shop.
- **Helpful**: the job is easier or cleaner with it (bike stand, gloves, a work mat). At the start of each tutorial the user picks which helpful tools they have with them. This choice is not saved.
- Steps may depend on helpful-tool choices: with a bike stand, "clamp the seat post"; without one, a different way to hold the bike. Decide for each brake type whether turning the bike upside down is acceptable, and list any doubt in `open_questions`.
- **Parts** are what gets consumed or replaced and can be bought (new pads, a new split pin). They are separate from tools and may use placeholders: `{brake.pad_shape.front|pads that match the code on your old pads}`.
- Do not write a tool list for the tutorial by hand. The app collects it from the steps of the chosen variant. When a routing fact is still unknown at the start, the app shows the tools for all possible variants and marks them "maybe needed". Make sure each step's tool list is complete, so this collection works.

## When to share, skip, swap or split

Use the lightest mechanism that keeps every rendered tutorial correct and easy to follow. Go down this list and stop at the first rule that fits.

1. **Parameter**: same actions, same order, only a value differs (pad code, torque value, valve type for the pump head). Use a placeholder.
2. **Skip**: a step does not apply in one context, and leaving it out keeps the rest correct (for example "insert a pad spacer" only for hydraulic disc brakes). Use `when` on the step.
3. **Swap**: one action differs but the steps before and after stay the same (quick release lever, thru-axle or axle nuts). Use a procedure with implementations, or a short branch of one to three steps.
4. **Split**: create separate variants or procedures when ANY of these is true:
   - the order of actions differs, not only single actions;
   - different tools or a different workstand position are needed for most of the sequence;
   - the user needs a different mental model (cable tension versus hydraulic system versus hub gear);
   - more than about a third of the steps in a sequence would carry a condition on the same fact;
   - two branches would share less than about half of their steps;
   - the way to check success differs, so the checks and their buttons would differ;
   - the safety risk differs in a way a beginner could confuse (for example DOT fluid versus mineral oil handling). Never let a wrong or missing fact produce a mix of two safety-critical procedures;
   - the 3D scene would change on most steps.

Shared steps are coupled: a change to `remove-front-wheel` changes every tutorial that uses it. Only share a step if it should change everywhere when it changes. Small leaf steps are usually safe to share (clean the area, spin the wheel, test the brakes at walking speed). Large differences belong at the top of the tree.

## Unknown facts

For every branch and every `when` on a bike fact, decide what happens if the fact is unknown. Choose one, and say which:

- `ask`: ask the fact's beginner question right there, ideally as a choice between two or three pictures. The answer is saved to the bike.
- `show_both`: show both options inline. Use this only for one or two steps.
- `generic`: fall back to a generic step that is correct for every value.
- `stop`: send the user to a shop. Use this when a wrong guess is unsafe.

## Writing rules

- One action per step, in the imperative, at most two short sentences. Name what the user sees ("the round metal disc"), then the technical term.
- Placeholders only for values that fit the sentence unchanged in any language: codes, numbers with units, model names. Never insert a noun into a sentence ("Loosen the {part}"), because German articles and cases change with the noun. If the wording must change, use an enum mapped to full sentences per value.
- Every placeholder has fallback wording for when the value is unknown.
- Never invent safety-critical values (fluid type, torque values, pad compatibility, wear limits). Use a placeholder marked `safety: true` and a step that tells the user to confirm on the part itself (for example "check the code printed on the old pad").
- Do not include steps that only make sense for a professional workshop. If such a step is needed, the tutorial sends the user to a shop at that point.

## Fact vocabulary

Use these keys. Facts that can differ between the wheels carry a `.front` or `.rear` suffix. If you need a new key, add it to `proposed_facts`, with type, values, a beginner question in English and German, and a reason.

| Key | Values |
|---|---|
| `bike.category` | mtb, road_gravel, trekking_city, cargo |
| `bike.ebike` | true, false |
| `ebike.motor_position` | mid, rear_hub, front_hub |
| `brake.type.{front,rear}` | rim_v, rim_caliper, rim_cantilever, rim_hydraulic, disc_mechanical, disc_hydraulic, roller, coaster |
| `brake.fluid.{front,rear}` (safety) | mineral_shimano, mineral_sram, mineral_magura, mineral_other, dot_4, dot_5_1 |
| `brake.model_code.{front,rear}` | text, for example BR-MT200 |
| `brake.pad_shape.{front,rear}` (safety) | text, for example a Shimano reference shape |
| `wheel.axle.{front,rear}` | quick_release, thru_axle, nut |
| `wheel.dynamo_hub` | true, false |
| `drive.gear_type` | derailleur, hub_gear, single_speed, gearbox |
| `drive.shifting` | mechanical, electronic |
| `drive.front_count` | 1, 2, 3 |
| `tire.valve.{front,rear}` | presta, schrader, dunlop |
| `tire.setup.{front,rear}` | tube, tubeless |

## Output format

Return one YAML document with these top-level keys, in this order. The example shows the shape; replace its content with yours.

```yaml
tools:            # shared catalog, only the tools this tutorial uses
  - id: brake-pad-spacer
    name: "Brake pad spacer (plastic block)"
    kind: tool
    substitutes:
      - { name: "Clean, folded cardboard", safe: true }
      - { name: "Screwdriver or other metal", safe: false, reason: "Can damage the pistons" }
  - id: bike-stand
    name: "Bike stand"
    kind: tool

parts:
  - id: pads-front
    name: "{brake.pad_shape.front|Brake pads that match the code on your old pads}"
    safety: true

steps:
  - id: hold-bike-stand
    kind: action
    text: "Clamp the seat post in the stand at hip height."
    when: { tool.bike-stand: [true] }
    tools: { required: [], helpful: [bike-stand] }
    scene: "Bike in stand, side view"

  - id: check-pad-wear
    kind: check
    text: "Look into the brake from above and find the pad material on both sides."
    scene: "Caliper from above, pads highlighted"
    buttons:
      - label: "Plenty of material left"
        text: "Your pads do not need replacing yet."
        skip_to: end
      - label: "Thin or uneven"
        text: "Replace both pads. Tap Next to start."

  - id: check-rub
    kind: check
    text: "Spin the wheel by hand and listen."
    scene: "Wheel spinning, pads highlighted"
    buttons:
      - label: "Spins freely"
        text: "Good. Tap Next."
      - label: "Rubs on one side"
        text: "The brake sits off-centre. Loosen its two bolts, squeeze the lever, hold it and tighten the bolts. Spin the wheel again."
        solution:
          - { target: caliper_mount_bolt, motion: rotate, direction: loosen, amount: "half turn", view: "left side, behind the caliper", caption: "Loosen both bolts half a turn" }
          - { target: brake_lever, motion: squeeze, amount: "fully", view: "handlebar from above", caption: "Squeeze and hold the lever" }
          - { target: caliper_mount_bolt, motion: rotate, direction: tighten, amount: "until snug", view: "left side, behind the caliper", caption: "Tighten both bolts while holding" }

  - id: lever-feel
    kind: safety_check
    text: "Squeeze the brake lever firmly five times."
    scene: "Brake lever, side view"
    buttons:
      - label: "Firm, stops halfway"
        text: "Good. Tap Next."
      - label: "Soft or reaches the bar"
        stop: "Do not ride. The brake may have air in it or a leak. Take the bike to a shop."

procedures:
  - id: remove-front-wheel
    implementations:
      - when: { wheel.axle.front: [quick_release] }
        steps: [open-qr-lever, lift-and-drop-wheel]
      - when: { wheel.axle.front: [thru_axle] }
        steps: [unscrew-thru-axle, lift-and-drop-wheel]
    if_unknown: ask   # ask | show_both | generic | stop

tutorial:
  id: brake-pads-replace
  applies_when: {}
  sequence:
    - step: hold-bike-stand
    - branch:
        on: brake.type.front
        if_unknown: ask
        cases:
          - when: { brake.type.front: [disc_hydraulic, disc_mechanical] }
            sequence: [ ... ]
          - when: { brake.type.front: [rim_v, rim_caliper, rim_cantilever] }
            sequence: [ ... ]
          - when: { brake.type.front: [roller, coaster] }
            sequence: [ { shop: "Roller and coaster brakes have no pads you can replace yourself. A shop can check them." } ]

fact_manifest:    # every bike fact the tutorial reads
  - key: brake.type.front
    used_for: routing   # routing | detail | safety
    if_unknown: ask

proposed_facts: []

decision_log:     # one line per share / skip / swap / split decision, citing the rule number above
  - "Split disc vs rim at the top: different order and tools (rule 4)."

open_questions: [] # anything you could not decide or verify
```

## Self-check before you answer

1. Render the tutorial as a plain numbered walkthrough for each of these bike profiles and include the renders at the end, after the YAML. Show each check as its question with its buttons, and follow the good path plus one problem button per profile:
   - A: German e-trekking bike, Bosch mid motor, Magura hydraulic rim brakes, Shimano Nexus hub gear, nut axle at the rear, dynamo hub at the front, Dunlop valves. User has no bike stand with them.
   - B: Hardtail MTB, Shimano hydraulic disc brakes, thru-axles, 1x mechanical derailleur. User has a bike stand and gloves.
   - C: Older road bike, rim caliper brakes, quick releases, presta valves. No helpful tools.
   - D: Nothing known at all, no helpful tools picked.
2. For each profile, list the tools shown at the start: required, helpful, and "maybe needed".
3. Read each render as a beginner would. If one reads like a different job with parts glued together, split it. If a step makes no sense for that bike or tool choice, fix the condition. If a button asks for a judgement the beginner cannot make, rewrite it as an observation.
4. Check the rules: no step has more than three buttons; every safety-relevant check is its own `safety_check` step; `stop` appears only in `safety_check` steps; every skip goes forward and never jumps over a needed `safety_check`; every physical fix has a `solution`.
5. Report for the tutorial: number of distinct steps, number of steps reused from elsewhere, share of steps that carry a `when`, number of check and safety-check steps, maximum branch depth, and how many fact questions profile D is asked.
6. List every place where you were unsure about mechanics or safety in `open_questions`, rather than guessing.