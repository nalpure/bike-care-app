// Small pure helpers about bikes in the garage: the complete-bike lookup (a stub in the test
// build) and the range check for number facts. No DOM, no repair content.

import type { Value } from '../../../tools/lib/conditions.js';
import type { DemoBike } from './store.js';

export interface BikeForm {
  brand?: string;
  model?: string;
  line?: string;
  year?: number;
}

/** The form as facts (bike.brand, bike.model, bike.line, bike.year), leaving out empty fields. */
export function formFacts(f: BikeForm): Record<string, Value> {
  const out: Record<string, Value> = {};
  if (f.brand?.trim()) out['bike.brand'] = f.brand.trim();
  if (f.model?.trim()) out['bike.model'] = f.model.trim();
  if (f.line?.trim()) out['bike.line'] = f.line.trim();
  if (f.year !== undefined && Number.isFinite(f.year)) out['bike.year'] = f.year;
  return out;
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Stub of the complete-bike lookup (owner decision 2026-11-20): matches the form against the
 * bundle's test bikes. Brand and model must match (case and spaces ignored); series and year
 * must match too when both the form and the bike have them. The real app searches a database,
 * then the web.
 */
export function lookupBike(demos: DemoBike[], f: BikeForm): DemoBike | undefined {
  if (!f.brand?.trim() || !f.model?.trim()) return undefined;
  return demos.find((d) => {
    const x = d.facts;
    if (norm(x['bike.brand']) !== norm(f.brand) || norm(x['bike.model']) !== norm(f.model)) return false;
    if (f.line?.trim() && x['bike.line'] !== undefined && norm(x['bike.line']) !== norm(f.line)) return false;
    if (f.year !== undefined && x['bike.year'] !== undefined && Number(x['bike.year']) !== f.year) return false;
    return true;
  });
}

/** A name from brand, series and model, e.g. "Corvana Strada SL 3"; empty when none is known. */
export function bikeTitle(facts: Record<string, Value>): string {
  return ['bike.brand', 'bike.line', 'bike.model'].map((k) => facts[k]).filter((v) => v !== undefined && String(v).trim()).join(' ');
}

/** Why a number does not fit the fact's min, max or fixed values; null when it fits. */
export function numberProblem(fact: any, v: number): string | null {
  if (!Number.isFinite(v)) return 'Enter a number.';
  const unit = fact?.unit === 'deg' ? '°' : fact?.unit ? ` ${fact.unit}` : '';
  if (Array.isArray(fact?.values) && fact.type === 'number' && !fact.values.includes(v)) return `Choose one of ${fact.values.join(', ')}.`;
  const { min, max } = fact ?? {};
  if (min !== undefined && max !== undefined && (v < min || v > max)) return `Must be between ${min} and ${max}${unit}.`;
  if (min !== undefined && v < min) return `Must be at least ${min}${unit}.`;
  if (max !== undefined && v > max) return `Must be at most ${max}${unit}.`;
  return null;
}

/**
 * Lenient checks that geometry values fit together (the fact ranges are checked first, by
 * numberProblem). Each applies only when both values are known; they refuse the impossible, not
 * the unusual. These three are all there is:
 *  1. the wheelbase is at least 400 mm longer than the chainstay,
 *  2. the effective top tube is at least 50 mm longer than the reach,
 *  3. the stack is at least 150 mm taller than the head tube.
 */
export const GEOMETRY_FITS: Array<{ a: string; b: string; min: number; why: (la: string, lb: string) => string }> = [
  { a: 'geometry.wheelbase_mm', b: 'geometry.chainstay_mm', min: 400, why: (a, b) => `${a} must be clearly longer than ${b} (at least 400 mm more).` },
  { a: 'geometry.top_tube_mm', b: 'geometry.reach_mm', min: 50, why: (a, b) => `${a} must be clearly longer than ${b} (at least 50 mm more).` },
  { a: 'geometry.stack_mm', b: 'geometry.head_tube_mm', min: 150, why: (a, b) => `${a} must be clearly taller than ${b} (at least 150 mm more).` },
];

/** Why `v` for `key` does not fit the other known geometry values; null when it fits. */
export function fitProblem(facts: Record<string, Value>, key: string, v: number, label: (k: string) => string): string | null {
  for (const r of GEOMETRY_FITS) {
    if (r.a !== key && r.b !== key) continue;
    const a = r.a === key ? v : Number(facts[r.a]);
    const b = r.b === key ? v : Number(facts[r.b]);
    if (facts[r.a] === undefined && r.a !== key) continue;
    if (facts[r.b] === undefined && r.b !== key) continue;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a - b < r.min) return r.why(label(r.a), label(r.b));
  }
  return null;
}
