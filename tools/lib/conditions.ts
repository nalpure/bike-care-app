// Condition evaluation. Dependency-free on purpose: the player imports this same file,
// so the build and the app evaluate conditions with the same code.
//
// A condition is { key: [allowed values], ..., any_of: [condition, ...] }.
// All keys must match (AND), in the written order; evaluation stops at the first key that fails,
// so a later key is never read (and never asked) when an earlier one already decides.
// Keys: fact keys (drive.gear_type), tool.<tool-id> (true/false), choice.<choice-id> (option id).
// The value 'unknown' stands for a fact the user could not answer.

export type Value = string | number | boolean;
export type Condition = { [key: string]: Value[] | Condition[] };
export type Lookup = (key: string) => Value;

export const UNKNOWN = 'unknown';

export function evaluate(cond: Condition | undefined, lookup: Lookup): boolean {
  if (!cond) return true;
  for (const [key, allowed] of Object.entries(cond)) {
    if (key === 'any_of') {
      if (!(allowed as Condition[]).some((c) => evaluate(c, lookup))) return false;
      continue;
    }
    const value = String(lookup(key));
    if (!(allowed as Value[]).some((a) => String(a) === value)) return false;
  }
  return true;
}

/** Every key a condition can read, in written order (including inside any_of). */
export function conditionKeys(cond: Condition | undefined): string[] {
  if (!cond) return [];
  const out: string[] = [];
  for (const [key, v] of Object.entries(cond)) {
    if (key === 'any_of') for (const c of v as Condition[]) out.push(...conditionKeys(c));
    else out.push(key);
  }
  return [...new Set(out)];
}

/** Every key: value pair a condition names (for reference checks). */
export function conditionPairs(cond: Condition | undefined): Array<[string, Value]> {
  if (!cond) return [];
  const out: Array<[string, Value]> = [];
  for (const [key, v] of Object.entries(cond)) {
    if (key === 'any_of') for (const c of v as Condition[]) out.push(...conditionPairs(c));
    else for (const val of v as Value[]) out.push([key, val]);
  }
  return out;
}

/** Replaces <name> with the run's parameter values, e.g. brake.type.<pos> -> brake.type.front. */
export function substParams(s: string, params: Record<string, string>): string {
  return s.replace(/<([a-z]+)>/g, (m, name: string) => params[name] ?? m);
}

export function substCondition(cond: Condition | undefined, params: Record<string, string>): Condition | undefined {
  if (!cond || !Object.keys(params).length) return cond;
  const out: Condition = {};
  for (const [key, v] of Object.entries(cond)) {
    if (key === 'any_of') out.any_of = (v as Condition[]).map((c) => substCondition(c, params)!);
    else out[substParams(key, params)] = v;
  }
  return out;
}

/** Placeholders in text: {fact.key|fallback wording} or {fact.key}. */
export const PLACEHOLDER = /\{([a-z][a-z0-9_]*(?:\.[a-z0-9_<>]+)+)(?:\|([^}]*))?\}/g;

/** Fills placeholders from known facts; unknown facts get the fallback wording. */
export function fillText(text: string, known: (key: string) => Value | undefined): string {
  return text.replace(PLACEHOLDER, (_m, key: string, fallback: string | undefined) => {
    const v = known(key);
    if (v === undefined || v === UNKNOWN) return fallback ?? `{${key}}`;
    return String(v);
  });
}
