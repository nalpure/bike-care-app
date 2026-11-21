// The content bundle as the player sees it: the shared index plus small lookups for display.
// Every text shown to the user comes from here. The player holds no repair text of its own.

import { fillText, UNKNOWN, type Value } from '../../../tools/lib/conditions.js';
import { factOf, indexBundle, posify, type BundleData, type Index } from '../../../tools/lib/resolve.js';

export interface Bundle extends BundleData {
  format: number;
  content_hash: string;
  notice: string;
  unverified: boolean;
}

export class Content {
  readonly ix: Index;

  constructor(readonly bundle: Bundle) {
    this.ix = indexBundle(bundle);
  }

  get notice(): string {
    return this.bundle.notice;
  }

  fact(key: string): any | undefined {
    return factOf(this.ix, key);
  }

  /** The English text of a translated text field ({en, de}) or a plain string. */
  t(v: any): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return v.en ?? '';
  }

  /** How a fact value reads to the user: its answer text, or the value itself. */
  valueText(key: string, v: Value): string {
    if (String(v) === UNKNOWN) return 'Not known';
    const f = this.fact(key);
    const a = f?.answers?.[String(v)];
    return a ? this.t(a) : String(v);
  }

  /** Values a fact can take, for the question screen and the bike sheet. */
  factValues(key: string): Value[] {
    const f = this.fact(key);
    if (!f) return [];
    if (f.type === 'enum') return f.values;
    if (f.type === 'boolean') return [true, false];
    if (f.type === 'number' && Array.isArray(f.values)) return f.values;
    return [];
  }

  tool(id: string): any | undefined {
    return this.ix.tools.get(id);
  }

  toolName(id: string): string {
    return this.ix.tools.get(id)?.name ?? id;
  }

  part(id: string): any | undefined {
    return this.ix.parts.get(id);
  }

  job(id: string): any | undefined {
    return this.ix.jobs.get(id);
  }

  jobTitle(id: string): string {
    return this.ix.jobs.get(id)?.title ?? id;
  }

  /** "no estimate yet" for a placeholder price such as "<range>". */
  priceText(jobId: string): string {
    const job = this.job(jobId);
    const p = job?.shop?.price_eur;
    if (!p || /^<.*>$/.test(String(p))) return 'no estimate yet';
    return `${p} EUR${job.shop.price_source && !/^<.*>$/.test(job.shop.price_source) ? ` (${job.shop.price_source})` : ''}`;
  }

  /** The state label definition for a session label such as wheel_out.front. */
  stateLabel(label: string): any | undefined {
    return this.ix.states.get(label) ?? this.ix.states.get(label.replace(/\.(front|rear)$/, '.<pos>'));
  }

  inspection(id: string): any | undefined {
    return this.ix.inspections.get(id) ?? this.ix.inspections.get(posify(id));
  }

  tutorialForJob(jobId: string): any | undefined {
    const tid = this.job(jobId)?.tutorial;
    return tid ? this.ix.tutorials.get(tid) : undefined;
  }

  /** Jobs that have a tutorial, for the home screen's list. */
  tutorialJobs(): any[] {
    return [...this.ix.jobs.values()].filter((j) => j.tutorial && this.ix.tutorials.has(j.tutorial));
  }

  diagnoses(): any[] {
    return [...this.ix.diagnoses.values()];
  }

  routineCheck(): any | undefined {
    return this.ix.checks.values().next().value;
  }

  /** Fills {fact.key|fallback} placeholders from the bike's known facts. */
  fill(text: string | undefined, known: (key: string) => Value | undefined, params: Record<string, string> = {}): string {
    if (!text) return '';
    const withParams = text.replace(/<([a-z]+)>/g, (m, name: string) => params[name] ?? m);
    // Same filling as the reviewed walkthroughs (tools/lib/render.ts): the stored value as it is.
    return fillText(withParams, (k) => {
      const v = known(k);
      return v === undefined || String(v) === UNKNOWN ? undefined : v;
    });
  }

  /** details lines whose facts are all known. */
  details(def: any, known: (key: string) => Value | undefined, params: Record<string, string> = {}): string[] {
    const out: string[] = [];
    for (const d of def?.details ?? []) {
      const needs: string[] = d.needs ?? [];
      if (needs.every((k) => {
        const v = known(k);
        return v !== undefined && String(v) !== UNKNOWN;
      })) out.push(this.fill(d.text, known, params));
    }
    return out;
  }
}

export async function loadBundle(url = './bundle.json'): Promise<Content> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the content bundle (${res.status}).`);
  return new Content(await res.json());
}
