// The 3D registry: every name content may use in `focus`, `view`, `animation.target` and
// `animation.clip`, and what the stage does with session state labels.
//
// Pure data, no three.js, so tools/export-3d-manifest.ts can write build/3d-manifest.json from it
// and npm run check verifies content against the names the player really has.
// The bike builder (bike.ts), the views (views.ts) and the clips (anim.ts) must provide every
// name listed here; player/test/stage.test.ts checks that.
//
// Part names, other names and the one-line "what it does" are shown when the user taps a part.
// They describe the part only, never how to repair it (schema request SR-06).

export interface NodeInfo {
  /** short tag shown on the part during a step */
  label: string;
  /** name shown when the part is tapped */
  name: string;
  /** other common names */
  aliases: string;
  /** what the part does, one sentence */
  about: string;
  /**
   * The text fact(s) holding this part's model name ("Shimano XT RD-M8100"), shown in small
   * text under the name in the garage preview when known. Several facts are joined by spaces.
   */
  model_fact?: string | string[];
}

export const NODES: Record<string, NodeInfo> = {
  bike: { label: 'Bike', name: 'The whole bike', aliases: 'Drag to turn it, pinch to zoom.', about: 'Tap any part to see its name.' },
  frame: { label: 'Frame', name: 'Frame', aliases: 'Main frame and rear triangle', about: 'Everything else is fixed to it.', model_fact: ['bike.brand', 'bike.model', 'bike.line'] },
  fork: { label: 'Fork', name: 'Fork', aliases: 'Holds the front wheel', about: 'Steers the bike. On mountain bikes it also absorbs bumps.' },
  front_wheel: { label: 'Front wheel', name: 'Front wheel', aliases: 'Rim, tyre and spokes', about: 'Turns with the handlebar.' },
  rear_wheel: { label: 'Rear wheel', name: 'Rear wheel', aliases: 'Rim, tyre and spokes', about: 'Carries the sprockets on its hub and drives the bike.' },
  saddle: { label: 'Saddle', name: 'Saddle', aliases: 'Also called the seat', about: 'Where you sit.' },
  seat_post: { label: 'Seat post', name: 'Seat post', aliases: 'The tube that holds the saddle', about: 'Sets the saddle height.' },
  handlebar: { label: 'Handlebar', name: 'Handlebar and stem', aliases: 'Cockpit', about: 'Holds the shifters and brake levers.' },
  brake_lever: { label: 'Brake lever', name: 'Brake levers', aliases: 'One on each side of the handlebar', about: 'Pull them to brake.' },
  kickstand: { label: 'Kickstand', name: 'Kickstand', aliases: 'Also called the side stand', about: 'Holds the bike upright when parked.' },
  stand_clamp: { label: 'Clamp', name: 'Work stand clamp', aliases: 'Part of the work stand', about: 'Holds the bike by the seat post.' },
  motor: { label: 'Motor', name: 'Motor and battery', aliases: 'E-bike drive', about: 'Helps you pedal. Work on it belongs in a shop.' },
  chainring: { label: 'Chainring', name: 'Chainring', aliases: 'The front gear', about: 'Where your pedalling force enters the chain.', model_fact: 'drive.crankset_model' },
  crank: { label: 'Crank', name: 'Crank and pedal', aliases: 'Crank arm', about: 'Turns the chainring when you pedal.', model_fact: 'drive.crankset_model' },
  chain: { label: 'Chain', name: 'Chain', aliases: 'Part of the drivetrain', about: 'Runs around the chainring, a sprocket and the derailleur.', model_fact: 'drive.chain_model' },
  cassette: { label: 'Sprockets', name: 'Sprockets', aliases: 'Also called the cassette, cogs or rear gears', about: 'The stack of rear gears the chain moves across.', model_fact: 'drive.cassette_model' },
  smallest_sprocket: { label: 'Smallest sprocket', name: 'Smallest sprocket', aliases: 'The hardest gear', about: 'The outermost sprocket, furthest from the spokes.' },
  largest_sprocket: { label: 'Largest sprocket', name: 'Largest sprocket', aliases: 'The easiest gear', about: 'The innermost sprocket, closest to the spokes.' },
  rear_derailleur: { label: 'Derailleur', name: 'Rear derailleur', aliases: 'Also called the rear mech', about: 'Moves the chain from sprocket to sprocket.', model_fact: 'drive.rear_derailleur_model' },
  derailleur_hanger: { label: 'Hanger', name: 'Derailleur hanger', aliases: 'Also called the dropout', about: 'The small plate that holds the derailleur on the frame.' },
  upper_pulley: { label: 'Upper wheel', name: 'Upper jockey wheel', aliases: 'Also called the guide pulley', about: 'The upper of the two small toothed wheels on the derailleur.' },
  h_screw: { label: 'H', name: 'Limit screw H', aliases: 'Marked H on the derailleur', about: 'Sets how far out the derailleur can go.' },
  l_screw: { label: 'L', name: 'Limit screw L', aliases: 'Marked L on the derailleur', about: 'Sets how far in, towards the spokes, the derailleur can go.' },
  cable_bolt: { label: 'Cable bolt', name: 'Cable clamp bolt', aliases: 'Also called the cable anchor bolt', about: 'Clamps the gear cable to the derailleur.' },
  b_screw: { label: 'B screw', name: 'B screw', aliases: 'Also called the B-tension screw', about: 'Sets the gap between the upper wheel and the sprockets.' },
  barrel_adjuster: { label: 'Barrel adjuster', name: 'Barrel adjuster', aliases: 'Also called the cable adjuster', about: 'Changes the cable tension in small steps.' },
  rear_barrel: { label: 'Barrel adjuster', name: 'Barrel adjuster at the derailleur', aliases: 'Also called the cable adjuster', about: 'Changes the cable tension in small steps.' },
  front_barrel: { label: 'Barrel adjuster', name: 'Barrel adjuster at the front', aliases: 'On the shifter, or in the cable near the handlebar', about: 'Changes the cable tension in small steps.' },
  shift_cable: { label: 'Cable', name: 'Gear cable', aliases: 'Inner wire in its housing', about: 'Carries the pull from the shifter to the derailleur.' },
  drivetrain: { label: 'Drivetrain', name: 'Drivetrain', aliases: 'Chainring, chain, sprockets and derailleur', about: 'Everything that turns pedalling into driving the rear wheel.' },
  rear_end: { label: 'Rear end', name: 'Rear end of the frame', aliases: 'Stay ends, dropouts and rear hub', about: 'Where the rear wheel and the derailleur hanger are held.' },
  shifter_rear: { label: 'Shifter', name: 'Right shifter', aliases: 'Also called the shift lever', about: 'Pulls or releases the gear cable.', model_fact: 'drive.shifter_model' },
};

/**
 * Which atomic parts a node stands for. A node not listed here is one part of the same name.
 * `bike` stands for every part of the bike.
 *
 * `frame_dropout` (the last 13 cm of both stays and the dropout plates) and `rear_hub` (axle, hub
 * shell, flanges, freehub body) are parts of their own so that `rear_end` can show them without the
 * rest of the frame and the wheel. They are not nodes: `frame` and `rear_wheel` still stand for
 * the whole frame and the whole wheel.
 */
export const NODE_PARTS: Record<string, string[]> = {
  frame: ['frame', 'frame_dropout'],
  rear_wheel: ['rear_wheel', 'rear_hub'],
  cassette: ['cassette', 'smallest_sprocket', 'largest_sprocket'],
  rear_derailleur: ['rear_derailleur', 'upper_pulley'],
  drivetrain: [
    'chainring', 'crank', 'chain', 'cassette', 'smallest_sprocket', 'largest_sprocket',
    'rear_derailleur', 'upper_pulley', 'derailleur_hanger', 'h_screw', 'l_screw', 'b_screw', 'cable_bolt', 'rear_barrel',
  ],
  rear_end: ['frame_dropout', 'rear_hub'],
  // the barrel the fact drive.barrel_adjuster picks (barrel.ts); both while it is unknown
  barrel_adjuster: ['rear_barrel', 'front_barrel'],
};

/** Nodes that only group parts for `show` and `focus`: no part is "its own" one, so a tap never means them. */
export const GROUP_NODES: readonly string[] = ['drivetrain', 'rear_end'];

/** The parts that are cut out of another part, and the part they are cut from. */
export const SPLIT_PARTS: Record<string, string> = { frame_dropout: 'frame', rear_hub: 'rear_wheel' };

/** Named camera positions. */
export const VIEWS = [
  'whole_bike',
  'drive_side',
  'derailleur_from_behind',
  'hanger_from_behind',
  'derailleur_side_close',
  'barrel_adjuster_close',
  'handlebar_from_above',
  'chain_close',
] as const;

/** Named animation clips (see anim.ts). */
export const CLIPS = [
  'shift-to-smallest',
  'shift-to-largest',
  'shift-through-gears',
  'shift-test-ride',
  'limit-screw-align',
  'limit-push-past',
  'b-gap-adjust',
  'cable-tension-shift',
  'hanger-bend',
  'barrel-tour',
] as const;

/** Generic motions on any node. */
export const MOTIONS = ['rotate', 'push', 'pull', 'slide', 'squeeze', 'remove', 'insert'] as const;

/**
 * Small parts drawn whenever one of their holders is drawn, though content does not name them (visibility.ts,
 * addHeld; the barrel adjusters have their own list, barrel.ts). Marking the holder does not mark them.
 */
export const HELD_PARTS: Record<string, string[]> = {
  cable_bolt: ['rear_derailleur'],
};

/** How the bike is held: ground (on its wheels), stand, hung, flipped (upside down). */
export type Pose = 'ground' | 'stand' | 'hung' | 'flipped';

/**
 * What a session state label changes in the scene. The content has no label -> scene mapping
 * yet (schema request SR-05); until it does, the player keeps it here. An unknown label changes
 * nothing and logs a warning.
 */
export const LABEL_SCENES: Record<string, { pose?: Pose; hides?: string[] }> = {
  bike_in_stand: { pose: 'stand' },
  bike_hung: { pose: 'hung' },
  bike_upside_down: { pose: 'flipped' },
};

export function partsOf(node: string): string[] {
  return NODE_PARTS[node] ?? [node];
}

/** The node a tapped part is shown as in the garage preview: a sprocket as the sprockets, the upper wheel as the derailleur. */
export function previewNode(part: string): string {
  for (const [node, parts] of Object.entries(NODE_PARTS)) if (node !== part && !GROUP_NODES.includes(node) && parts.includes(part)) return node;
  return part;
}

/** The part's model name from the bike's facts (see NodeInfo.model_fact), or '' when unknown. */
export function modelOf(node: string, facts: Record<string, unknown>): string {
  const f = NODES[node]?.model_fact;
  if (!f) return '';
  return (Array.isArray(f) ? f : [f])
    .map((k) => facts[k])
    .filter((v): v is string | number => (typeof v === 'string' && v.trim() !== '' && v !== 'unknown') || typeof v === 'number')
    .map((v) => String(v).trim())
    .join(' ');
}

/** The content of build/3d-manifest.json. */
export function manifest(): { nodes: string[]; views: string[]; clips: string[]; motions: string[] } {
  return {
    nodes: Object.keys(NODES),
    views: [...VIEWS],
    clips: [...CLIPS],
    motions: [...MOTIONS],
  };
}
