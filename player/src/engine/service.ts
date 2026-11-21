// The service traffic light of a bike: for each job with a service interval, how far along it is,
// plus open to-do items from findings. Pure functions; no DOM, no repair content (the intervals
// and the jobs come from the bundle).

import type { Bike, Finding } from './store.js';

export type Light = 'green' | 'yellow' | 'red' | 'unknown';

/** Share of the interval from which a job turns yellow (owner brief: 75 %). */
export const YELLOW_FROM = 0.75;

export interface ServiceItem {
  job: string;
  light: Light;
  /** km ridden since the job was last done (or since the bike was added); undefined when the weekly distance is not known */
  km?: number;
  interval?: number;
  /** open to-do items for this job, worst first */
  todos: Finding[];
  /** why the light is not green, in a few neutral words */
  why: string;
}

const RANK: Record<Light, number> = { unknown: 0, green: 1, yellow: 2, red: 3 };

export function worst(a: Light, b: Light): Light {
  return RANK[b] > RANK[a] ? b : a;
}

function daysBetween(from: string, to: string): number {
  const d = (Date.parse(to) - Date.parse(from)) / 86400000;
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}

/** Rough km since the job was done: weeks since that day times the km per week the user gave. */
export function kmSince(bike: Bike, job: string, today: string): number | undefined {
  if (bike.kmPerWeek === undefined || !Number.isFinite(bike.kmPerWeek)) return undefined;
  const from = bike.done?.[job] ?? bike.added;
  return Math.round((daysBetween(from, today) / 7) * bike.kmPerWeek);
}

export function intervalLight(km: number, interval: number): Light {
  const r = km / interval;
  return r >= 1 ? 'red' : r >= YELLOW_FROM ? 'yellow' : 'green';
}

function urgencyLight(u?: string): Light {
  return u === 'do_not_ride' ? 'red' : u === 'soon' ? 'yellow' : 'green';
}

/**
 * One item per job that has a service interval or an open to-do item. A to-do item with urgency
 * `soon` makes the job at least yellow, `do_not_ride` red. Items are sorted worst first.
 */
export function serviceItems(bike: Bike, jobs: any[], today: string): ServiceItem[] {
  const todos = bike.findings.filter((f) => f.job && !f.cleared);
  const ids = new Set<string>([...jobs.filter((j) => j.service?.interval_km).map((j) => j.id), ...todos.map((f) => f.job!)]);
  const items: ServiceItem[] = [];
  for (const id of ids) {
    const def = jobs.find((j) => j.id === id);
    const interval: number | undefined = def?.service?.interval_km;
    const mine = todos.filter((f) => f.job === id);
    const km = interval ? kmSince(bike, id, today) : undefined;
    let light: Light = interval && km === undefined ? 'unknown' : 'green';
    const why: string[] = [];
    if (interval && km !== undefined) {
      const l = intervalLight(km, interval);
      light = worst(light, l);
      if (l !== 'green') why.push(`about ${km} km since last time (every ${interval} km)`);
    }
    for (const f of mine) {
      const l = urgencyLight(f.urgency);
      light = worst(light, l);
      if (f.urgency === 'do_not_ride') why.push('do not ride until this is fixed');
      else if (f.urgency === 'soon') why.push('found while checking: do it soon');
      else why.push('found while checking');
    }
    items.push({ job: id, light, km, interval, todos: mine, why: [...new Set(why)].join('; ') });
  }
  return items.sort((a, b) => RANK[b.light] - RANK[a.light]);
}

/** Items that make the bike show a red banner. */
export function redItems(bike: Bike, jobs: any[], today: string): ServiceItem[] {
  return serviceItems(bike, jobs, today).filter((i) => i.light === 'red');
}
