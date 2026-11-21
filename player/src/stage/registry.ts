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
}

export const NODES: Record<string, NodeInfo> = {
  bike: { label: 'Bike', name: 'The whole bike', aliases: 'Drag to turn it, pinch to zoom.', about: 'Tap any part to see its name.' },
  frame: { label: 'Frame', name: 'Frame', aliases: 'Main frame and rear triangle', about: 'Everything else is fixed to it.' },
  fork: { label: 'Fork', name: 'Fork', aliases: 'Holds the front wheel', about: 'Steers the bike. On mountain bikes it also absorbs bumps.' },
  front_wheel: { label: 'Front wheel', name: 'Front wheel', aliases: 'Rim, tyre and spokes', about: 'Turns with the handlebar.' },
  rear_wheel: { label: 'Rear wheel', name: 'Rear wheel', aliases: 'Rim, tyre and spokes', about: 'Carries the sprockets on its hub and drives the bike.' },
  saddle: { label: 'Saddle', name: 'Saddle', aliases: 'Also called the seat', about: 'Where you sit.' },
  seat_post: { label: 'Seat post', name: 'Seat post', aliases: 'The tube that holds the saddle', about: 'Sets the saddle height.' },
  handlebar: { label: 'Handlebar', name: 'Handlebar and stem', aliases: 'Cockpit', about: 'Holds the shifters and brake levers.' },
  kickstand: { label: 'Kickstand', name: 'Kickstand', aliases: 'Also called the side stand', about: 'Holds the bike upright when parked.' },
  stand_clamp: { label: 'Clamp', name: 'Work stand clamp', aliases: 'Part of the work stand', about: 'Holds the bike by the seat post.' },
  motor: { label: 'Motor', name: 'Motor and battery', aliases: 'E-bike drive', about: 'Helps you pedal. Work on it belongs in a shop.' },
  chainring: { label: 'Chainring', name: 'Chainring', aliases: 'The front gear', about: 'Where your pedalling force enters the chain.' },
  crank: { label: 'Crank', name: 'Crank and pedal', aliases: 'Crank arm', about: 'Turns the chainring when you pedal.' },
  chain: { label: 'Chain', name: 'Chain', aliases: 'Part of the drivetrain', about: 'Runs around the chainring, a sprocket and the derailleur.' },
  cassette: { label: 'Sprockets', name: 'Sprockets', aliases: 'Also called the cassette, cogs or rear gears', about: 'The stack of rear gears the chain moves across.' },
  smallest_sprocket: { label: 'Smallest sprocket', name: 'Smallest sprocket', aliases: 'The hardest gear', about: 'The outermost sprocket, furthest from the spokes.' },
  largest_sprocket: { label: 'Largest sprocket', name: 'Largest sprocket', aliases: 'The easiest gear', about: 'The innermost sprocket, closest to the spokes.' },
  rear_derailleur: { label: 'Derailleur', name: 'Rear derailleur', aliases: 'Also called the rear mech', about: 'Moves the chain from sprocket to sprocket.' },
  derailleur_hanger: { label: 'Hanger', name: 'Derailleur hanger', aliases: 'Also called the dropout', about: 'The small plate that holds the derailleur on the frame.' },
  upper_pulley: { label: 'Upper wheel', name: 'Upper jockey wheel', aliases: 'Also called the guide pulley', about: 'The upper of the two small toothed wheels on the derailleur.' },
  h_screw: { label: 'H', name: 'Limit screw H', aliases: 'Marked H on the derailleur', about: 'Sets how far out the derailleur can go.' },
  l_screw: { label: 'L', name: 'Limit screw L', aliases: 'Marked L on the derailleur', about: 'Sets how far in, towards the spokes, the derailleur can go.' },
  b_screw: { label: 'B screw', name: 'B screw', aliases: 'Also called the B-tension screw', about: 'Sets the gap between the upper wheel and the sprockets.' },
  barrel_adjuster: { label: 'Barrel adjuster', name: 'Barrel adjuster', aliases: 'Also called the cable adjuster', about: 'Changes the cable tension in small steps.' },
  shift_cable: { label: 'Cable', name: 'Gear cable', aliases: 'Inner wire in its housing', about: 'Carries the pull from the shifter to the derailleur.' },
  shifter_rear: { label: 'Shifter', name: 'Right shifter', aliases: 'Also called the shift lever', about: 'Pulls or releases the gear cable.' },
};

/**
 * Which atomic parts a node stands for. A node not listed here is one part of the same name.
 * `bike` stands for every part of the bike.
 */
export const NODE_PARTS: Record<string, string[]> = {
  cassette: ['cassette', 'smallest_sprocket', 'largest_sprocket'],
  rear_derailleur: ['rear_derailleur', 'upper_pulley'],
};

/** Named camera positions. */
export const VIEWS = [
  'whole_bike',
  'drive_side',
  'derailleur_from_behind',
  'derailleur_side_close',
  'barrel_adjuster_close',
  'handlebar_from_above',
  'chain_close',
] as const;

/** Named animation clips (see anim.ts). */
export const CLIPS = [
  'shift-to-smallest',
  'shift-to-largest',
  'limit-screw-align',
  'b-gap-adjust',
  'cable-tension-shift',
] as const;

/** Generic motions on any node. */
export const MOTIONS = ['rotate', 'push', 'pull', 'slide', 'squeeze', 'remove', 'insert'] as const;

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

/** The content of build/3d-manifest.json. */
export function manifest(): { nodes: string[]; views: string[]; clips: string[]; motions: string[] } {
  return {
    nodes: Object.keys(NODES),
    views: [...VIEWS],
    clips: [...CLIPS],
    motions: [...MOTIONS],
  };
}
