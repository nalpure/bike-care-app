// Everything the app keeps in the browser: bikes with their facts and findings, the user's tools,
// feedback notes and small settings. Stored in localStorage, wrapped so the app still works
// (for this visit only) when storage is unavailable, full or blocked.

import type { Value } from '../../../tools/lib/conditions.js';

export interface Finding {
  inspection: string;
  /** position for positional inspections (front, rear) */
  pos?: string;
  state: string;
  /** job and urgency this state calls for; none = not a to-do */
  job?: string;
  urgency?: string;
  /** where it was found: diagnosis id, routine check id, or tutorial id */
  source: string;
  date: string;
  /** set when the job was done or a later check reported this inspection as fine */
  cleared?: string;
}

export interface Bike {
  id: string;
  name: string;
  facts: Record<string, Value>;
  findings: Finding[];
  /** day the bike came into the garage (YYYY-MM-DD) */
  added: string;
  /** job id -> day it was last done (a finished tutorial) */
  done: Record<string, string>;
  /** rough distance ridden per week, for the service estimate */
  kmPerWeek?: number;
}

export interface Note {
  id: string;
  date: string;
  text: string;
  flow?: string;
  item?: string;
  unit?: string;
  path: string[];
  facts: Record<string, Value>;
  bike: string;
  content_hash: string;
}

export interface AppData {
  version: 2;
  /** the garage. No bike is "in use": each flow starts by choosing one. */
  bikes: Bike[];
  tools: string[];
  notes: Note[];
  noticeSeen: boolean;
  textOnly: boolean;
}

/** A test bike from the bundle (demo_bikes). */
export interface DemoBike {
  id: string;
  name: string;
  facts: Record<string, Value>;
}

const KEY = 'bike-app/v2';

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function demoGarage(demos: DemoBike[]): Bike[] {
  return demos.map((d) => ({ id: d.id, name: d.name, facts: { ...d.facts }, findings: [], added: today(), done: {} }));
}

function blank(demos: DemoBike[]): AppData {
  return { version: 2, bikes: demoGarage(demos), tools: [], notes: [], noticeSeen: false, textOnly: false };
}

/** A key-value store that never throws. Falls back to memory. */
export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function browserKV(): KV {
  const memory = new Map<string, string>();
  let ls: Storage | null = null;
  try {
    ls = typeof localStorage !== 'undefined' ? localStorage : null;
    ls?.getItem(KEY);
  } catch {
    ls = null;
  }
  return {
    get(key) {
      try {
        if (ls) return ls.getItem(key);
      } catch {
        /* fall through to memory */
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        ls?.setItem(key, value);
      } catch {
        /* memory only */
      }
    },
  };
}

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
}

export class Store {
  data: AppData;

  /** demos: the bundle's test bikes; they fill the garage on first start and after a reset. */
  constructor(private kv: KV, private demos: DemoBike[] = []) {
    this.data = blank(demos);
    try {
      const raw = kv.get(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // Version 1 (one bike in use, a built-in unknown bike) is not migrated: there were no testers yet.
        if (d?.version === 2 && Array.isArray(d.bikes)) this.data = { ...blank(demos), ...d };
      }
    } catch {
      this.data = blank(demos);
    }
    for (const b of this.data.bikes) {
      b.findings ??= [];
      b.done ??= {};
      b.added ??= today();
    }
  }

  save(): void {
    this.kv.set(KEY, JSON.stringify(this.data));
  }

  bike(id: string): Bike | undefined {
    return this.data.bikes.find((b) => b.id === id);
  }

  /** Bikes in the garage. */
  garage(): Bike[] {
    return this.data.bikes;
  }

  addBike(name: string, facts: Record<string, Value> = {}, findings: Finding[] = []): Bike {
    const b: Bike = { id: newId(), name: name.trim() || 'My bike', facts: { ...facts }, findings: [...findings], added: today(), done: {} };
    this.data.bikes.push(b);
    this.save();
    return b;
  }

  removeBike(id: string): void {
    this.data.bikes = this.data.bikes.filter((b) => b.id !== id);
    this.save();
  }

  /** Back to the test garage: the demo bikes as they come in the bundle. Notes and settings stay. */
  reset(): void {
    this.data.bikes = demoGarage(this.demos);
    this.data.tools = [];
    this.save();
  }

  setFact(bike: Bike, key: string, v: Value | undefined): void {
    if (v === undefined) delete bike.facts[key];
    else bike.facts[key] = v;
    this.save();
  }

  /** Stores a finding. A later finding for the same inspection replaces the open one. */
  addFinding(bike: Bike, f: Finding): void {
    for (const old of bike.findings) {
      if (!old.cleared && old.inspection === f.inspection && old.pos === f.pos) old.cleared = f.date;
    }
    bike.findings.push(f);
    this.save();
  }

  /** Open to-do items: findings with a job that are not cleared. */
  todos(bike: Bike): Finding[] {
    return bike.findings.filter((f) => f.job && !f.cleared);
  }

  /** The job was done: its to-do items are cleared and the day is kept for the service estimate. */
  clearJob(bike: Bike, job: string, date: string): void {
    for (const f of bike.findings) if (f.job === job && !f.cleared) f.cleared = date;
    bike.done = { ...(bike.done ?? {}), [job]: date };
    this.save();
  }

  setTools(ids: string[]): void {
    this.data.tools = [...new Set(ids)];
    this.save();
  }

  addNote(n: Note): void {
    this.data.notes.push(n);
    this.save();
  }

  clearNotes(): void {
    this.data.notes = [];
    this.save();
  }
}
