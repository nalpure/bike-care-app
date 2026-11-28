// The barrel adjusters: where they are drawn and which one the fact drive.barrel_adjuster picks.
// Pure (no three.js), so player/test/stage.test.ts can check it. The rules are also in the comment
// above bikeSpec (spec.ts).
//
// Every bike with a rear derailleur has two barrels, always drawn (owner decision 2026-11-25):
// - rear_barrel: at the rear derailleur, where the cable goes in. It belongs to the drivetrain group.
// - front_barrel: on flat and riser bars on the right shifter, where the cable leaves it; on drop bars
//   (their brake-shift levers have none) in the cable housing just behind the bar.
// The node barrel_adjuster, which content uses, stands for the picked one: it is marked, turned and
// framed. The fact picks it:
//   derailleur -> rear_barrel; shifter -> front_barrel; inline -> front_barrel (on flat and riser bars
//   the adjuster on the cable is shown at the shifter, owner rule).
//   Unknown -> both are marked; the one turned and framed is the old guess from the bar: drop bar ->
//   rear_barrel, flat and riser -> front_barrel.
// "shifter" on a drop bar (which has no barrel there) picks front_barrel, the one nearest the shifter.

import type { BikeSpec } from './spec.js';

export type BarrelPart = 'rear_barrel' | 'front_barrel';
export const BARREL_PARTS: readonly BarrelPart[] = ['rear_barrel', 'front_barrel'];
export const BARREL_FACT = 'drive.barrel_adjuster';

/** Where the front barrel sits on a bar type. */
export function frontPlace(bar: BikeSpec['bar']): 'shifter' | 'inline' {
  return bar === 'drop' ? 'inline' : 'shifter';
}

export interface BarrelPick {
  /** the barrel that is turned and framed (barrel_adjuster_close, cable-tension-shift) */
  main: BarrelPart;
  /** the barrels marked when content focuses barrel_adjuster */
  marked: BarrelPart[];
}

/** Which barrel the fact picks on this bar type (rules above). */
export function barrelPick(bar: BikeSpec['bar'], fact: unknown): BarrelPick {
  const guess: BarrelPart = bar === 'drop' ? 'rear_barrel' : 'front_barrel';
  if (fact === 'derailleur') return { main: 'rear_barrel', marked: ['rear_barrel'] };
  if (fact === 'shifter' || fact === 'inline') return { main: 'front_barrel', marked: ['front_barrel'] };
  return { main: guess, marked: [...BARREL_PARTS] };
}

/** The parts a node stands for on this card: barrel_adjuster is the picked barrel(s), every other node its usual parts. */
export function pickedParts(node: string, pick: BarrelPick, partsOf: (node: string) => string[]): string[] {
  return node === 'barrel_adjuster' ? [...pick.marked] : partsOf(node);
}

/**
 * The part a turn or an arrow on `node` means: barrel_adjuster is the picked barrel, anything else itself.
 * The other way round, `turnKey` gives the key a clip's `screws` uses for a turnable part.
 */
export function turnPart(node: string, pick: BarrelPick): string {
  return node === 'barrel_adjuster' ? pick.main : node;
}
export function turnKey(part: string, pick: BarrelPick): string {
  return part === pick.main ? 'barrel_adjuster' : part;
}

/** A barrel is drawn whenever the part that holds it is drawn (and when it is shown or marked itself). */
export const BARREL_HOLDERS: Record<BarrelPart, string[]> = {
  rear_barrel: ['rear_derailleur'],
  front_barrel: ['shifter_rear', 'shift_cable'],
};
