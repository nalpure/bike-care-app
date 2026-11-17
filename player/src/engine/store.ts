// Everything the app keeps in the browser: bikes with their facts and findings, the user's tools,
// feedback notes and small settings. Stored in localStorage, wrapped so the app still works
// (for this visit only) when storage is unavailable, full or blocked.

import type { Value } from '../../../tools/lib/conditions.js';

export interface Finding {
  inspection: string;
  /** position for positional inspections (front, rear) */
  pos?: string;
  state: string;
  /** job and urgency this state calls for, after diagnosis overrides; none = not a to-do */
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
  version: 1;
  bikes: Bike[];
  /** the bike in use; "unknown" is the built-in bike that is not in the garage yet */
  current: string;
  tools: string[];
  notes: Note[];
  noticeSeen: boolean;
  textOnly: boolean;
}

export const UNKNOWN_BIKE = 'unknown';

const KEY = 'bike-app/v1';

function blank(): AppData {
  return {
    version: 1,
    bikes: [{ id: UNKNOWN_BIKE, name: 'Unknown bike', facts: {}, findings: [] }],
    current: UNKNOWN_BIKE,
    tools: [],
    notes: [],
    noticeSeen: false,
    textOnly: false,
  };
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

  constructor(private kv: KV) {
    this.data = blank();
    try {
      const raw = kv.get(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d?.version === 1) this.data = { ...blank(), ...d };
      }
    } catch {
      this.data = blank();
    }
    if (!this.data.bikes.some((b) => b.id === UNKNOWN_BIKE)) this.data.bikes.unshift(blank().bikes[0]);
    if (!this.bike(this.data.current)) this.data.current = UNKNOWN_BIKE;
  }

  save(): void {
    this.kv.set(KEY, JSON.stringify(this.data));
  }

  bike(id: string): Bike | undefined {
    return this.data.bikes.find((b) => b.id === id);
  }

  get current(): Bike {
    return this.bike(this.data.current) ?? this.data.bikes[0];
  }

  /** Bikes in the garage (the unknown bike is not one of them). */
  garage(): Bike[] {
    return this.data.bikes.filter((b) => b.id !== UNKNOWN_BIKE);
  }

  addBike(name: string): Bike {
    const b: Bike = { id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.trim() || 'My bike', facts: {}, findings: [] };
    this.data.bikes.push(b);
    this.data.current = b.id;
    this.save();
    return b;
  }

  /** Turns the unknown bike into a garage bike, keeping what was learned. */
  nameUnknownBike(name: string): Bike {
    const u = this.bike(UNKNOWN_BIKE)!;
    const b: Bike = { id: `b${Date.now().toString(36)}`, name: name.trim() || 'My bike', facts: { ...u.facts }, findings: [...u.findings] };
    u.facts = {};
    u.findings = [];
    this.data.bikes.push(b);
    this.data.current = b.id;
    this.save();
    return b;
  }

  removeBike(id: string): void {
    if (id === UNKNOWN_BIKE) return;
    this.data.bikes = this.data.bikes.filter((b) => b.id !== id);
    if (this.data.current === id) this.data.current = UNKNOWN_BIKE;
    this.save();
  }

  use(id: string): void {
    if (this.bike(id)) this.data.current = id;
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

  clearJob(bike: Bike, job: string, date: string): void {
    for (const f of bike.findings) if (f.job === job && !f.cleared) f.cleared = date;
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
