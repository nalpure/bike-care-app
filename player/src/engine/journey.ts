// One journey through the app: a diagnosis, the routine check, a to-do item or a tutorial,
// from the first question to the shop summary or the finished repair.
//
// The journey never plans or reorders steps. The shared resolver (tools/lib/resolve.ts) turns the
// bundle into the list of steps for this bike; the journey only walks that list, evaluates the
// outcomes the content names, and remembers what the user tapped.
//
// It is plain TypeScript without DOM access, so the journey test can drive it like a user.

import { evaluate, substCondition, substParams, UNKNOWN, type Value } from '../../../tools/lib/conditions.js';
import {
  combined, enumerate, findJumpTarget, hiddenFollowUps, minutesOf, NeedKey, neverAsked, resolveDiagnosis, resolveTutorial, skippedBy, stateFromFacts,
  type DiagnosisRun, type PathItem, type Reader, type ToolList, type ToolSetUse, type TutorialRun, mergeTools,
} from '../../../tools/lib/resolve.js';
import type { Content } from './content.js';
import type { Bike, Finding, Store } from './store.js';

// ---------------------------------------------------------------- session

/** One sitting. Inspection answers are kept so no check is shown twice (hard rule 12). */
export class Session {
  /** inspection id (with position) -> state id */
  answers: Record<string, string> = {};
  /** facts answered with "I'll check later" in this sitting; asked again next time */
  unknown: string[] = [];
}

// ---------------------------------------------------------------- screens

export type ExitKind = 'unsafe' | 'not_covered' | 'not_needed' | 'shop_only';

export interface CardButton {
  id: string;
  label: string;
}

export interface Card {
  flow: string;
  flowKind: 'diagnosis' | 'routine' | 'tutorial';
  itemKind: 'step' | 'inspect';
  id: string;
  /** review unit id, e.g. card:step:check-high-limit */
  unit: string;
  kindLabel: string;
  /** a kind: safety_check card: the UI shows a red tag next to the title */
  safety?: boolean;
  title: string;
  text: string;
  details: string[];
  needs: string[];
  question?: string;
  buttons: CardButton[];
  chosen?: string;
  /** what the tapped button or state says */
  chosenText?: string;
  chosenTone?: 'good' | 'bad' | 'info';
  solution?: any[];
  /** Answers are the exception: Next without an answer means the goal is met, and Next is never locked */
  nextAnswers?: boolean;
  nextEnabled: boolean;
  nextLabel: string;
  canBack: boolean;
  /** 0..1, only moves forward */
  progress: number;
  /** "3 of 9" over the user's own path */
  position?: { n: number; of: number };
  warnings: string[];
  jumped: boolean;
  /** what the 3D stage shows; labels are the state after this card, labelsBefore the state before it */
  stage: { focus: string[]; show?: string[]; view?: string; animation?: any; labels: string[]; labelsBefore: string[] };
}

export interface ShopSummary {
  title: string;
  bike: string;
  facts: string[];
  tell?: string;
  findings: string[];
  extra: string[];
  stillSet: string[];
  price?: string;
}

export type Screen =
  | { kind: 'position'; param: string; values: string[]; canBack: boolean }
  | { kind: 'question'; key: string; fact: any; n: number; canBack: boolean }
  | { kind: 'tool-question'; tool: string; canBack: boolean }
  | { kind: 'choice'; choice: any; chosen?: string; canBack: boolean }
  | { kind: 'parts'; parts: any[]; canBack: boolean }
  | { kind: 'tools'; required: string[]; oneOf: ToolSetUse[]; helpful: string[]; ticked: string[]; canBack: boolean }
  | { kind: 'card'; card: Card }
  | { kind: 'exit'; exitKind: ExitKind; message: string; canJump: boolean; putBack: string[]; /** state labels still set; the stage shows the bike as it is held */ labels: string[]; canBack: boolean }
  | { kind: 'not-covered'; message: string; canBack: boolean }
  | { kind: 'job'; job: any; urgency?: string; diy?: { minutes: string | null; difficulty?: number }; tell: string; findings: string[]; price: string; canBack: boolean }
  | { kind: 'shop'; summary: ShopSummary; canBack: boolean }
  | { kind: 'done'; title: string; minutes: number; askFixed: boolean; canBack: boolean }
  | { kind: 'todo'; items: Finding[]; title: string; canBack: boolean }
  /** Offer to keep what this flow learned: on the garage bike in use, or as a new garage bike. */
  | { kind: 'keep'; learned: Array<[string, Value]>; bike: string | null; findings: number; canBack: boolean }
  | { kind: 'closed' };

export type Start =
  | { diagnosis: string; params?: Record<string, string> }
  | { tutorial: string; params?: Record<string, string> }
  | { check: string }
  | { job: string; urgency?: string; params?: Record<string, string> };

// ---------------------------------------------------------------- state (serialisable, for back)

interface TutState {
  id: string;
  params: Record<string, string>;
  choices: Record<string, string>;
  /** confirmed tool selection; null until the tool picker is done */
  tools: string[] | null;
  ticked: string[];
  toolAnswers: Record<string, boolean>;
  partsDone: boolean;
  started: boolean;
  /** visited item indexes into the combined list, in order */
  path: number[];
  /** tapped button or state id per item index */
  taps: Record<string, string>;
  jumped: boolean;
  /** an exit screen is showing for the item at this index */
  exitAt?: number;
  ended?: boolean;
}

type Stage =
  | { k: 'diag'; id: string; params: Record<string, string>; i: number; tap?: string; started: boolean }
  | { k: 'routine'; id: string; i: number; tap?: string; made: number }
  | { k: 'job'; job: string; urgency?: string; params: Record<string, string> }
  | { k: 'tut'; t: TutState }
  | { k: 'shop'; summary: ShopSummary }
  | { k: 'not-covered'; message: string; job?: string }
  | { k: 'done'; title: string; minutes: number; askFixed: boolean }
  | { k: 'todo'; title: string }
  | { k: 'exit'; kind: ExitKind; message: string; job?: string }
  | { k: 'closed' };

interface State {
  stage: Stage;
  /** the diagnosis this journey came from, to continue after "Did it fix it? No" */
  diag?: { id: string; params: Record<string, string>; next: number };
  /** labels of findings made in this journey, for the shop summary */
  found: string[];
  minutes: number;
}

interface Snapshot {
  st: string;
  facts: string;
  findings: string;
  session: string;
}

/** How a screen without a card is named in notes. */
const SCREEN_TITLE: Record<string, string> = {
  tools: 'Tools list', parts: 'Parts you need', exit: 'End of the guide', 'not-covered': 'Not covered yet', job: 'What now?',
  shop: 'For the shop', done: 'Done', todo: 'To-do result', keep: 'Keep what was learned', position: 'Which one?', 'tool-question': 'Do you have this tool?',
};

// ---------------------------------------------------------------- journey

/** Whether what the flow learns goes onto a garage bike. Asked once per flow (the keep screen). */
type Offer = 'ask' | 'saved' | 'skipped';

export class Journey {
  private st: State;
  /** the bike the flow works on: a copy, so answers reach the garage only when the user keeps them */
  private bike: Bike;
  /** the garage bike chosen at the start; null for an unknown bike until the user saves it */
  private home: Bike | null;
  private offer: Offer = 'ask';
  private history: Snapshot[] = [];
  private progressMax = 0;
  /** ids of the cards shown, in order, for feedback notes and the assistant */
  shownPath: string[] = [];

  /**
   * bike: the garage bike chosen for this flow, or null for an unknown bike.
   * preset: facts given before the flow (the complete-bike form); they count as learned.
   */
  constructor(
    private c: Content,
    private store: Store,
    bike: Bike | null,
    private session: Session,
    start: Start,
    preset: Record<string, Value> = {},
  ) {
    this.home = bike;
    this.bike = bike
      ? { ...bike, facts: { ...bike.facts, ...preset }, findings: clone(bike.findings), done: { ...bike.done } }
      : { id: 'unknown', name: 'Unknown bike', facts: { ...preset }, findings: [], added: '', done: {} };
    this.st = { stage: { k: 'closed' }, found: [], minutes: 0 };
    if ('diagnosis' in start) this.st.stage = { k: 'diag', id: start.diagnosis, params: start.params ?? {}, i: 0, started: false };
    else if ('tutorial' in start) this.st.stage = { k: 'tut', t: this.newTut(start.tutorial, start.params ?? {}) };
    else if ('check' in start) this.st.stage = { k: 'routine', id: start.check, i: 0, made: 0 };
    else this.st.stage = { k: 'job', job: start.job, urgency: start.urgency, params: start.params ?? {} };
  }

  get bikeName(): string {
    return this.bike.name;
  }

  /** What this flow knows about the bike (garage facts plus answers so far). */
  get bikeFacts(): Record<string, Value> {
    return this.bike.facts;
  }

  /** The garage bike this flow works on, if any (null for an unknown bike not saved yet). */
  get garageBike(): Bike | null {
    return this.home;
  }

  /** Facts this flow knows that the garage bike does not (all of them for an unknown bike). */
  learned(): Array<[string, Value]> {
    return Object.entries(this.bike.facts).filter(([k, v]) => String(v) !== UNKNOWN && (!this.home || String(this.home.facts[k]) !== String(v)));
  }

  /** Copies findings and finished jobs to the garage bike, and facts once the user kept them. */
  private persist(): void {
    if (this.home) {
      this.home.findings = clone(this.bike.findings);
      this.home.done = { ...this.bike.done };
      if (this.offer === 'saved') Object.assign(this.home.facts, this.bike.facts);
    }
    this.store.save();
  }

  /** Keep screen: save what was learned. An unknown bike becomes a garage bike and needs a name. */
  keepSave(name?: string): void {
    if (!this.home) {
      if (!name?.trim()) return;
      this.home = this.store.addBike(name, {}, []);
      this.bike.id = this.home.id;
      this.bike.name = this.home.name;
    }
    this.offer = 'saved';
    this.persist();
  }

  /** Keep screen: go on without saving. Answers still count for this flow. */
  keepSkip(): void {
    this.offer = 'skipped';
  }

  /** What the assistant and feedback notes receive. */
  context(): { flow?: string; item?: string; unit?: string; title?: string; facts: Record<string, Value>; state: string[]; path: string[] } {
    const s = this.st.stage;
    const out = { facts: { ...this.bike.facts }, state: [] as string[], path: [...this.shownPath] } as ReturnType<Journey['context']>;
    if (s.k === 'diag' || s.k === 'routine') out.flow = s.id;
    if (s.k === 'tut') out.flow = s.t.id;
    const scr = this.screen();
    if (scr.kind === 'card') {
      out.item = scr.card.id;
      out.unit = scr.card.unit;
      out.title = scr.card.title;
      out.state = scr.card.stage.labels;
    } else if (scr.kind === 'question') {
      out.item = scr.key;
      out.unit = `card:fact:${scr.key}`;
      out.title = this.c.t(scr.fact?.question) || scr.key;
    } else if (scr.kind === 'choice') {
      out.item = scr.choice.id;
      out.unit = `card:choice:${scr.choice.id}`;
      out.title = scr.choice.question;
    } else if (scr.kind !== 'closed') {
      out.title = SCREEN_TITLE[scr.kind] ?? scr.kind;
    }
    return out;
  }

  // ------------------------------------------------------------ history

  private snapshot(): void {
    this.history.push({
      st: JSON.stringify(this.st),
      facts: JSON.stringify(this.bike.facts),
      findings: JSON.stringify(this.bike.findings),
      session: JSON.stringify(this.session),
    });
  }

  /** Back by hand. Restores the journey, the facts learned and the findings made since. */
  back(): void {
    const s = this.history.pop();
    if (!s) return;
    this.st = JSON.parse(s.st);
    this.bike.facts = JSON.parse(s.facts);
    this.bike.findings = JSON.parse(s.findings);
    Object.assign(this.session, JSON.parse(s.session));
    this.persist();
  }

  get canBack(): boolean {
    return this.history.length > 0;
  }

  /**
   * Back as the user means it on a card (the Back button, a swipe down, the edge swipe): undoes the
   * card's answer and goes on to the previous screen. On the flow's first card it only undoes the answer.
   */
  backCard(): void {
    const id = () => {
      const s = this.screen();
      return s.kind === 'card' ? s.card.id : null;
    };
    const from = id();
    this.back();
    while (from !== null && this.canBack && id() === from) this.back();
  }

  // ------------------------------------------------------------ peeking

  /**
   * What `fn` leads to, without doing it: runs it, reads the screen and its title, then puts the
   * journey, the bike, the garage bike, the session and the user's tools back as they were.
   * Nothing is stored meanwhile. The card column (`ui/flow.ts`) draws the cards around the
   * current one from this, so they are the very cards Next and Back lead to.
   */
  peek(fn: (j: Journey) => void): { screen: Screen; title?: string } {
    const keep = {
      st: JSON.stringify(this.st),
      bike: JSON.stringify(this.bike),
      homeRef: this.home,
      home: this.home ? JSON.stringify(this.home) : '',
      offer: this.offer,
      history: this.history.slice(),
      progressMax: this.progressMax,
      shownPath: this.shownPath.slice(),
      session: JSON.stringify(this.session),
      tools: this.store.data.tools.slice(),
    };
    const store = this.store as any;
    const ownSave = Object.prototype.hasOwnProperty.call(store, 'save');
    const save = store.save;
    store.save = () => undefined;
    try {
      fn(this);
      return { screen: this.screen(), title: this.context().title };
    } finally {
      if (ownSave) store.save = save;
      else delete store.save;
      this.st = JSON.parse(keep.st);
      this.bike = JSON.parse(keep.bike);
      this.home = keep.homeRef;
      if (this.home) {
        const was = JSON.parse(keep.home);
        for (const k of Object.keys(this.home)) if (!(k in was)) delete (this.home as any)[k];
        Object.assign(this.home, was);
      }
      this.offer = keep.offer;
      this.history = keep.history;
      this.progressMax = keep.progressMax;
      this.shownPath = keep.shownPath;
      const sess = JSON.parse(keep.session);
      for (const k of Object.keys(this.session)) if (!(k in sess)) delete (this.session as any)[k];
      Object.assign(this.session, sess);
      this.store.data.tools = keep.tools;
    }
  }

  /** The screen Back leads to from this card, or null when there is none or it is this card again. */
  peekBack(): { screen: Screen; title?: string } | null {
    const s = this.screen();
    if (s.kind !== 'card' || !this.canBack) return null;
    const p = this.peek((j) => j.backCard());
    return p.screen.kind === 'card' && p.screen.card.id === s.card.id ? null : p;
  }

  /**
   * The screen after this card. `open`: Next leads there now. A card that still waits for an answer
   * gives the card the answers that go on lead to (`open` false), when they all lead to the same
   * one; when they lead to different cards (a diagnosis) it gives null.
   */
  peekNext(): { screen: Screen; title?: string; open: boolean } | null {
    const s = this.screen();
    if (s.kind !== 'card') return null;
    const card = s.card;
    if (card.nextEnabled) return { ...this.peek((j) => j.next()), open: true };
    const found = new Map<string, { screen: Screen; title?: string }>();
    for (const b of card.buttons) {
      const p = this.peek((j) => {
        j.tap(b.id);
        const t = j.screen();
        if (t.kind === 'card' && t.card.id === card.id && t.card.nextEnabled) j.next();
      });
      if (p.screen.kind === 'card' && p.screen.card.id !== card.id) found.set(p.screen.card.id, p);
    }
    return found.size === 1 ? { ...[...found.values()][0], open: false } : null;
  }

  // ------------------------------------------------------------ facts and the reader

  private known = (k: string): Value | undefined => {
    if (k in this.bike.facts) return this.bike.facts[k];
    if (this.session.unknown.includes(k)) return UNKNOWN;
    return undefined;
  };

  private reader(t?: TutState): Reader {
    const ask = (key: string): Value => {
      if (key.startsWith('choice.')) {
        const v = t?.choices[key.slice(7)];
        if (v === undefined) throw new NeedKey(key);
        return v;
      }
      if (key.startsWith('tool.')) return this.toolValue(key.slice(5), t, true);
      const v = this.known(key);
      if (v !== undefined) return v;
      if (neverAsked(this.c.ix, key)) return UNKNOWN;
      throw new NeedKey(key);
    };
    const look = (key: string): Value => {
      if (key.startsWith('choice.')) return t?.choices[key.slice(7)] ?? UNKNOWN;
      if (key.startsWith('tool.')) return this.toolValue(key.slice(5), t, false);
      return this.known(key) ?? UNKNOWN;
    };
    return { ask, branch: look, peek: look };
  }

  private toolValue(tool: string, t: TutState | undefined, asking: boolean): boolean {
    if (!t) return this.store.data.tools.includes(tool);
    if (this.impliedTools(t).includes(tool)) return true;
    if (t.tools) return t.tools.includes(tool);
    if (tool in t.toolAnswers) return t.toolAnswers[tool];
    if (asking) throw new NeedKey(`tool.${tool}`);
    return false;
  }

  private impliedTools(t: TutState): string[] {
    const out: string[] = [];
    for (const [id, opt] of Object.entries(t.choices)) {
      const o = this.c.ix.choices.get(id)?.options.find((x: any) => x.id === opt);
      for (const tool of o?.requires_tools ?? []) out.push(tool);
    }
    return out;
  }

  /** Runs a resolver; a missing key becomes the question to ask. */
  private tryResolve<T>(fn: () => T): { ok: T } | { need: string } {
    try {
      return { ok: fn() };
    } catch (e) {
      if (e instanceof NeedKey) return { need: e.key };
      throw e;
    }
  }

  private questionScreen(key: string): Screen {
    if (key.startsWith('tool.')) return { kind: 'tool-question', tool: key.slice(5), canBack: this.canBack };
    const asked = Object.keys(this.bike.facts).length;
    return { kind: 'question', key, fact: this.c.fact(key), n: asked + 1, canBack: this.canBack };
  }

  /** Answer to a fact question; "unknown" is "I'll check later" and is kept for this sitting only. */
  answerFact(key: string, v: Value): void {
    this.snapshot();
    if (String(v) === UNKNOWN) {
      if (!this.session.unknown.includes(key)) this.session.unknown.push(key);
    } else {
      this.bike.facts[key] = v;
    }
    this.persist();
  }

  answerTool(tool: string, has: boolean): void {
    const s = this.st.stage;
    if (s.k !== 'tut') return;
    this.snapshot();
    s.t.toolAnswers[tool] = has;
  }

  answerPosition(param: string, value: string): void {
    this.snapshot();
    const s = this.st.stage;
    if (s.k === 'tut') s.t.params[param] = value;
    if (s.k === 'diag' || s.k === 'job') s.params[param] = value;
  }

  // ------------------------------------------------------------ screen

  screen(): Screen {
    const s = this.flowScreen();
    if (this.offer !== 'ask' || s.kind === 'closed' || s.kind === 'question' || s.kind === 'tool-question' || s.kind === 'position') return s;
    // Once per flow, on the screen after the questions; for an unknown bike also at the end when
    // the flow made findings (to-do items need a garage bike).
    const learned = this.learned();
    const end = s.kind === 'done' || s.kind === 'todo' || s.kind === 'shop';
    const findings = this.home ? 0 : this.bike.findings.length;
    if (learned.length || (end && findings)) return { kind: 'keep', learned, bike: this.home?.name ?? null, findings, canBack: this.canBack };
    return s;
  }

  private flowScreen(): Screen {
    this.ensureDiagStarted();
    const s = this.st.stage;
    switch (s.k) {
      case 'closed':
        return { kind: 'closed' };
      case 'diag':
        return this.diagScreen(s);
      case 'routine':
        return this.routineScreen(s);
      case 'job':
        return this.jobScreen(s);
      case 'tut':
        return this.tutScreen(s.t);
      case 'shop':
        return { kind: 'shop', summary: s.summary, canBack: this.canBack };
      case 'not-covered':
        return { kind: 'not-covered', message: s.message, canBack: this.canBack };
      case 'done':
        return { kind: 'done', title: s.title, minutes: s.minutes, askFixed: s.askFixed, canBack: this.canBack };
      case 'todo':
        return { kind: 'todo', title: s.title, items: this.store.todos(this.bike), canBack: this.canBack };
      case 'exit':
        return { kind: 'exit', exitKind: s.kind, message: s.message, canJump: false, putBack: [], labels: [], canBack: this.canBack };
    }
  }

  close(): void {
    this.st.stage = { k: 'closed' };
  }

  /** Minutes of the cards shown so far. */
  get minutes(): number {
    return this.st.minutes;
  }

  /** Which flow the current screen belongs to. */
  get stageKind(): string {
    return this.st.stage.k;
  }

  /** The id of the flow being run (diagnosis, routine check or tutorial). */
  get flowId(): string | undefined {
    const s = this.st.stage;
    return s.k === 'diag' || s.k === 'routine' ? s.id : s.k === 'tut' ? s.t.id : undefined;
  }

  // ------------------------------------------------------------ cards

  private positionOf(params: Record<string, Record<string, any>> | undefined, have: Record<string, string>): Screen | null {
    for (const [name, p] of Object.entries(params ?? {})) {
      if (!(name in have)) return { kind: 'position', param: name, values: p.values, canBack: this.canBack };
    }
    return null;
  }

  private inspectionCard(flowKind: Card['flowKind'], flow: string, insp: any, id: string, params: Record<string, string>, tap: string | undefined, extra: Partial<Card>): Card {
    const st = insp.states.find((x: any) => x.id === tap);
    return {
      flow, flowKind, itemKind: 'inspect', id, unit: `card:inspection:${insp.id}`,
      kindLabel: 'Check',
      title: insp.title,
      text: this.c.fill(insp.text, this.known, params),
      details: this.c.details(insp, this.known, params),
      needs: (insp.tools?.required ?? []).map((x: any) => this.c.toolName(typeof x === 'string' ? x : x.id)),
      question: 'What do you see on your bike?',
      buttons: insp.states.map((x: any) => ({ id: x.id, label: x.label })),
      chosen: tap,
      chosenText: st?.meaning,
      chosenTone: st ? (st.leads_to ? 'bad' : 'good') : undefined,
      nextEnabled: !!tap,
      nextLabel: 'Next',
      canBack: this.canBack,
      progress: 0,
      warnings: [],
      jumped: false,
      stage: { focus: insp.focus ?? [], show: insp.show, view: insp.view, animation: insp.animation, labels: [], labelsBefore: [] },
      ...extra,
    };
  }

  /** Taps a button on the current card (a step's button id or an inspection's state id). */
  tap(id: string): void {
    const s = this.st.stage;
    this.snapshot();
    if (s.k === 'diag' || s.k === 'routine') s.tap = id;
    else if (s.k === 'tut') this.tutTap(s.t, id);
  }

  /** Clears the tap on the current card ("choose again"). */
  untap(): void {
    const s = this.st.stage;
    this.snapshot();
    if (s.k === 'diag' || s.k === 'routine') s.tap = undefined;
    else if (s.k === 'tut') {
      const idx = s.t.path[s.t.path.length - 1];
      const res = this.tutRun(s.t);
      if ('ok' in res) this.unlearn(combined(res.ok)[idx], s.t.taps[String(idx)]);
      delete s.t.taps[String(idx)];
      s.t.exitAt = undefined;
    }
  }

  next(): void {
    const s = this.st.stage;
    const scr = this.screen();
    if (scr.kind === 'card' && !scr.card.nextEnabled) return;
    this.snapshot();
    if (s.k === 'diag') this.diagNext(s);
    else if (s.k === 'routine') this.routineNext(s);
    else if (s.k === 'tut') {
      if (s.t.started) this.tutNext(s.t);
    }
  }

  private recordFinding(inspection: string, state: string, pos: string | undefined, hit: { job: string; urgency: string } | null, source: string): void {
    const insp = this.c.inspection(inspection);
    const st = insp?.states.find((x: any) => x.id === state);
    this.store.addFinding(this.bike, {
      inspection, pos, state, job: hit?.job, urgency: hit?.urgency, source, date: new Date().toISOString().slice(0, 10),
    });
    this.persist();
    if (hit && st) this.st.found.push(st.label);
  }

  // ------------------------------------------------------------ diagnosis

  private diagRun(s: Extract<Stage, { k: 'diag' }>): { ok: DiagnosisRun } | { need: string } {
    const d = this.c.ix.diagnoses.get(s.id);
    return this.tryResolve(() => resolveDiagnosis(this.c.ix, d, this.reader(), s.params));
  }

  private diagScreen(s: Extract<Stage, { k: 'diag' }>): Screen {
    const d = this.c.ix.diagnoses.get(s.id);
    if (!d) return { kind: 'not-covered', message: 'This symptom is not covered yet.', canBack: this.canBack };
    const pos = this.positionOf(d.params, s.params);
    if (pos) return pos;
    const res = this.diagRun(s);
    if ('need' in res) return this.questionScreen(res.need);
    const run = res.ok;
    if (run.exit) return { kind: 'not-covered', message: run.exit.message, canBack: this.canBack };
    const ch = run.checks[s.i];
    if (!ch) return { kind: 'closed' };
    const visible = run.checks.filter((x) => !x.skipped);
    const n = visible.indexOf(ch) + 1;
    return {
      kind: 'card',
      card: this.inspectionCard('diagnosis', s.id, ch.def, ch.id, s.params, s.tap, {
        chosenTone: s.tap ? (ch.hits[s.tap] ? 'bad' : 'good') : undefined,
        progress: Math.max(this.progressMax, (n - 1) / visible.length),
        position: { n, of: visible.length },
      }),
    };
  }

  /** Moves the diagnosis to the next check that is shown, answering repeated ones from the session. */
  private diagAdvance(s: Extract<Stage, { k: 'diag' }>, run: DiagnosisRun): void {
    while (s.i < run.checks.length) {
      const ch = run.checks[s.i];
      if (ch.skipped) {
        s.i++;
        continue;
      }
      const earlier = this.session.answers[ch.id];
      if (earlier === undefined) return;
      // Never the same check twice in a session: the earlier answer decides.
      if (this.diagDecide(s, run, earlier)) return;
    }
    if (s.i >= run.checks.length) {
      const d = this.c.ix.diagnoses.get(s.id);
      this.st.diag = undefined;
      this.st.stage = { k: 'job', job: d.no_hit.job, params: s.params };
    }
  }

  /** Applies a state at check s.i. Returns true when the diagnosis ended with a hit. */
  private diagDecide(s: Extract<Stage, { k: 'diag' }>, run: DiagnosisRun, state: string): boolean {
    const ch = run.checks[s.i];
    this.session.answers[ch.id] = state;
    const hit = ch.hits[state] ?? null;
    this.recordFinding(ch.id, state, s.params.pos, hit, s.id);
    s.i++;
    s.tap = undefined;
    if (hit) {
      this.st.diag = { id: s.id, params: s.params, next: s.i };
      this.st.stage = { k: 'job', job: hit.job, urgency: hit.urgency, params: s.params };
      return true;
    }
    return false;
  }

  private diagNext(s: Extract<Stage, { k: 'diag' }>): void {
    const res = this.diagRun(s);
    if (!('ok' in res) || res.ok.exit) return;
    if (!s.started) {
      s.started = true;
      this.diagAdvance(s, res.ok);
      return;
    }
    const ch = res.ok.checks[s.i];
    if (!ch || s.tap === undefined) return;
    this.shownPath.push(ch.id);
    this.st.minutes += ch.def.minutes ?? 0;
    if (this.diagDecide(s, res.ok, s.tap)) return;
    this.diagAdvance(s, res.ok);
  }

  /** The diagnosis starts on its first check once its questions are answered. */
  private ensureDiagStarted(): void {
    const s = this.st.stage;
    if (s.k !== 'diag' || s.started) return;
    const res = this.diagRun(s);
    if (!('ok' in res) || res.ok.exit) return;
    s.started = true;
    this.diagAdvance(s, res.ok);
  }

  // ------------------------------------------------------------ routine check

  private routineItems(id: string): Array<{ inspect: string; key: string; pos?: string; def: any }> {
    const ch = this.c.ix.checks.get(id);
    const out: Array<{ inspect: string; key: string; pos?: string; def: any }> = [];
    for (const item of ch?.inspections ?? []) {
      const def = this.c.inspection(item.inspect);
      if (!def) continue;
      for (const pos of item.pos ?? [undefined]) out.push({ inspect: item.inspect, key: pos ? `${item.inspect}.${pos}` : item.inspect, pos, def });
    }
    return out;
  }

  private routineScreen(s: Extract<Stage, { k: 'routine' }>): Screen {
    const items = this.routineItems(s.id);
    // Skip what does not apply to this bike; a missing fact becomes a question.
    while (s.i < items.length) {
      const it = items[s.i];
      const params: Record<string, string> = it.pos ? { pos: it.pos } : {};
      const res = this.tryResolve(() => !it.def.applies_when || evaluate(substCondition(it.def.applies_when, params), this.reader().ask));
      if ('need' in res) return this.questionScreen(res.need);
      if (res.ok) break;
      s.i++;
    }
    if (s.i >= items.length) {
      this.st.stage = { k: 'todo', title: this.c.ix.checks.get(s.id)?.title ?? 'Routine check' };
      return this.screen();
    }
    const it = items[s.i];
    const shown = items.length;
    return {
      kind: 'card',
      card: this.inspectionCard('routine', s.id, it.def, it.key, (it.pos ? { pos: it.pos } : {}) as Record<string, string>, s.tap, {
        progress: Math.max(this.progressMax, s.i / shown),
        position: { n: s.i + 1, of: shown },
      }),
    };
  }

  private routineNext(s: Extract<Stage, { k: 'routine' }>): void {
    const items = this.routineItems(s.id);
    const it = items[s.i];
    if (!it || s.tap === undefined) return;
    const st = it.def.states.find((x: any) => x.id === s.tap);
    this.shownPath.push(it.key);
    this.st.minutes += it.def.minutes ?? 0;
    this.recordFinding(it.inspect, s.tap, it.pos, st?.leads_to ?? null, s.id);
    if (!it.pos) this.session.answers[it.key] = s.tap;
    if (st?.leads_to) s.made++;
    s.i++;
    s.tap = undefined;
  }

  // ------------------------------------------------------------ job screen

  /** Time of the complete paths of a tutorial for this bike, over the choices still open. */
  tutorialTime(tutorialId: string, params: Record<string, string> = {}): string | null {
    const t = this.c.ix.tutorials.get(tutorialId);
    if (!t) return null;
    const fixed: Record<string, Value> = { ...this.bike.facts };
    for (const k of this.session.unknown) fixed[k] = UNKNOWN;
    const mins = enumerate(this.c.ix, (r) => resolveTutorial(this.c.ix, t, r, params), fixed)
      .filter((x) => !x.result.exit)
      .map((x) => minutesOf(combined(x.result)));
    if (!mins.length) return null;
    const lo = Math.min(...mins);
    const hi = Math.max(...mins);
    return lo === hi ? `${lo} min` : `${lo} to ${hi} min`;
  }

  private findingLabels(job?: string): string[] {
    const out = new Set(this.st.found);
    for (const f of this.store.todos(this.bike)) {
      if (job && f.job !== job) continue;
      const st = this.c.inspection(f.inspection)?.states.find((x: any) => x.id === f.state);
      if (st) out.add(st.label);
    }
    return [...out];
  }

  private jobScreen(s: Extract<Stage, { k: 'job' }>): Screen {
    const job = this.c.job(s.job);
    if (!job) return { kind: 'not-covered', message: 'This repair is not covered yet.', canBack: this.canBack };
    const t = this.c.tutorialForJob(s.job);
    return {
      kind: 'job',
      job,
      urgency: s.urgency,
      diy: t ? { minutes: this.tutorialTime(t.id, s.params), difficulty: t.difficulty } : undefined,
      tell: job.shop?.tell ?? '',
      findings: this.findingLabels(s.job),
      price: this.c.priceText(s.job),
      canBack: this.canBack,
    };
  }

  jobDiy(): void {
    const s = this.st.stage;
    if (s.k !== 'job') return;
    const t = this.c.tutorialForJob(s.job);
    if (!t) return;
    this.snapshot();
    this.st.stage = { k: 'tut', t: this.newTut(t.id, { ...s.params }) };
  }

  jobShop(): void {
    const s = this.st.stage;
    if (s.k !== 'job') return;
    this.snapshot();
    this.st.stage = { k: 'shop', summary: this.shopSummary(s.job, []) };
  }

  shopSummary(jobId: string | undefined, extra: string[], stillSet: string[] = []): ShopSummary {
    const job = jobId ? this.c.job(jobId) : undefined;
    const facts = Object.entries(this.bike.facts)
      .filter(([, v]) => String(v) !== UNKNOWN)
      .map(([k, v]) => `${this.c.fact(k)?.question ? this.c.t(this.c.fact(k).question) : k}: ${this.c.valueText(k, v)}`);
    return {
      title: job?.title ?? 'Shop summary',
      bike: this.bike.name,
      facts,
      tell: job?.shop?.tell,
      findings: this.findingLabels(jobId),
      extra,
      stillSet,
      price: jobId ? this.c.priceText(jobId) : undefined,
    };
  }

  // ------------------------------------------------------------ tutorial

  private newTut(id: string, params: Record<string, string>): TutState {
    return {
      id, params, choices: {}, tools: null, ticked: [...this.store.data.tools], toolAnswers: {},
      partsDone: false, started: false, path: [], taps: {}, jumped: false,
    };
  }

  private tutRun(t: TutState): { ok: TutorialRun } | { need: string } {
    const def = this.c.ix.tutorials.get(t.id);
    return this.tryResolve(() => resolveTutorial(this.c.ix, def, this.reader(t), t.params));
  }

  private labelsAt(t: TutState, all: PathItem[], upTo: number): Set<string> {
    const state = new Set<string>();
    for (const idx of t.path.slice(0, upTo + 1)) {
      const it = all[idx];
      if (it.kind !== 'step') continue;
      for (const l of it.def.clears ?? []) state.delete(substParams(l, t.params));
      for (const l of it.def.sets ?? []) state.add(substParams(l, t.params));
    }
    return state;
  }

  private skippedSet(t: TutState, all: PathItem[]): Set<number> {
    const out = new Set<number>();
    for (const idx of t.path) {
      const tap = t.taps[String(idx)];
      if (tap === undefined) continue;
      const b = all[idx].buttons.find((x) => x.id === tap);
      for (const i of skippedBy(all, idx, b)) out.add(i);
    }
    return out;
  }

  /** Outcome of a tap on an item: continue, block or exit. */
  private outcomeOf(it: PathItem, tap: string | undefined): { kind: 'continue' | 'block' | 'exit' | 'none'; exit?: any; text?: string; good?: boolean } {
    if (tap === undefined) return { kind: 'none' };
    if (it.kind === 'inspect') {
      const o = it.outcomes?.[tap];
      const st = it.def.states.find((x: any) => x.id === tap);
      if (o && typeof o === 'object' && o.block) return { kind: 'block', text: o.block };
      if (o && typeof o === 'object' && o.exit) return { kind: 'exit', exit: o.exit, text: st?.meaning };
      return { kind: 'continue', text: st?.meaning, good: true };
    }
    const b = it.buttons.find((x) => x.id === tap);
    if (!b) return { kind: 'none' };
    if (b.block) return { kind: 'block', text: b.block };
    if (b.exit) return { kind: 'exit', exit: b.exit, text: b.text };
    return { kind: 'continue', text: b.text, good: true };
  }

  /**
   * Answers are the exception (decisions.md, 2026-11-22): on a step with a question, and on an
   * inspection with a default in a tutorial, Next means the goal is met and is never locked.
   */
  private nextAnswers(it: PathItem): boolean {
    return it.kind === 'inspect' ? it.def.default !== undefined : !!it.def.question;
  }

  /** Must the user tap before Next? Inspections always; steps that can block or exit. Not where Next answers. */
  private needsTap(it: PathItem): boolean {
    if (this.nextAnswers(it)) return false;
    if (it.kind === 'inspect') return true;
    return it.buttons.some((b) => b.block || b.exit);
  }

  /**
   * The next item index after `from` on this path: not skipped by a button, within the sequence
   * after a jump (finish is skipped), and not an inspection already answered in this session
   * before the work started (hard rule 12). Returns the index and the auto-answered items passed on the way.
   */
  private nextIndex(t: TutState, all: PathItem[], run: TutorialRun, from: number): { idx?: number; auto: Array<{ idx: number; state: string }> } {
    const skipped = this.skippedSet(t, all);
    const limit = t.jumped ? run.sequence.length : all.length;
    let workStarted = t.path.some((i) => all[i].kind === 'step');
    const auto: Array<{ idx: number; state: string }> = [];
    const tapAt = (j: number) => auto.find((a) => a.idx === j)?.state ?? t.taps[String(j)];
    for (let i = from + 1; i < limit; i++) {
      if (skipped.has(i)) continue;
      const it = all[i];
      // A follow-up shows only after the answer it follows (taps so far, and answers passed on the way).
      if (it.after && hiddenFollowUps(all, tapAt).has(i)) continue;
      if (it.kind === 'inspect' && !workStarted) {
        // Facts already known on the bike answer it (a state's sets): not shown.
        const known = stateFromFacts(all, i, (k) => this.bike.facts[k]);
        if (known !== undefined && this.outcomeOf(it, known).kind === 'continue') {
          auto.push({ idx: i, state: known });
          continue;
        }
        const earlier = this.session.answers[it.id];
        if (earlier !== undefined) {
          const o = this.outcomeOf(it, earlier);
          if (o.kind === 'continue') {
            auto.push({ idx: i, state: earlier });
            continue;
          }
          // An earlier answer that blocks or exits is shown, already tapped.
          auto.push({ idx: i, state: earlier });
          return { idx: i, auto };
        }
      }
      if (it.kind === 'step') workStarted = true;
      return { idx: i, auto };
    }
    return { auto };
  }

  private tutScreen(t: TutState): Screen {
    const def = this.c.ix.tutorials.get(t.id);
    if (!def) return { kind: 'not-covered', message: 'This guide is not available.', canBack: this.canBack };
    if (!t.started) return this.preScreen(t, def);
    const res = this.tutRun(t);
    if (!('ok' in res)) return this.questionScreen(res.need);
    const run = res.ok;
    const all = combined(run);
    const p = t.path.length - 1;
    const idx = t.path[p];
    const it = all[idx];
    const labels = this.labelsAt(t, all, p);
    if (t.exitAt !== undefined && t.exitAt === idx) {
      const o = this.outcomeOf(it, t.taps[String(idx)]);
      const ex = o.exit;
      const target = ex.show_how_from ? findJumpTarget(run, idx, ex.show_how_from) : undefined;
      return {
        kind: 'exit',
        exitKind: ex.kind,
        message: ex.text,
        canJump: labels.size > 0 && target !== undefined,
        putBack: [...labels].map((l) => this.c.stateLabel(l)?.put_back).filter(Boolean),
        labels: [...labels],
        canBack: this.canBack,
      };
    }
    // The default state (taken by Next) has no button: the card shows it as not answered.
    const tap = it.kind === 'inspect' && t.taps[String(idx)] === it.def.default ? undefined : t.taps[String(idx)];
    const o = this.outcomeOf(it, tap);
    const nxt = this.nextIndex(t, all, run, idx);
    const remaining = this.countRemaining(t, all, run, idx);
    const n = t.path.length;
    const progress = Math.max(this.progressMax, (n - 1) / (n + remaining));
    const card: Card = {
      flow: t.id, flowKind: 'tutorial', itemKind: it.kind, id: it.id,
      unit: `card:${it.kind === 'inspect' ? 'inspection' : 'step'}:${it.def.id}`,
      kindLabel: it.kind === 'inspect' ? 'Check' : it.def.kind === 'safety_check' ? 'Safety check' : it.def.kind === 'check' ? 'Check' : 'Step',
      safety: it.kind !== 'inspect' && it.def.kind === 'safety_check',
      title: it.def.title,
      text: this.c.fill(it.generic ? it.def.generic_text : it.def.text, this.known, t.params),
      details: this.c.details(it.def, this.known, t.params),
      needs: [...it.tools.required.map((x) => this.c.toolName(x)), ...it.tools.one_of.map((u) => u.options.map((x) => this.c.toolName(x)).join(' or '))],
      question: it.def.question ?? (it.kind === 'inspect' || it.buttons.length ? 'What do you see on your bike?' : undefined),
      buttons: it.kind === 'inspect'
        ? it.def.states.filter((x: any) => x.id !== it.def.default).map((x: any) => ({ id: x.id, label: x.label }))
        : it.buttons.map((b) => ({ id: b.id, label: b.label })),
      chosen: tap,
      chosenText: o.text,
      chosenTone: o.kind === 'block' || o.kind === 'exit' ? 'bad' : o.kind === 'continue' ? (it.kind === 'inspect' ? 'good' : 'info') : undefined,
      solution: it.kind === 'step' ? it.buttons.find((b) => b.id === tap)?.solution : undefined,
      nextAnswers: this.nextAnswers(it),
      nextEnabled: this.nextAnswers(it) || o.kind === 'continue' || (o.kind === 'none' && !this.needsTap(it)),
      nextLabel: nxt.idx === undefined ? 'Finish' : 'Next',
      canBack: this.canBack,
      progress,
      position: { n, of: n + remaining },
      warnings: [...labels].map((l) => this.c.stateLabel(l)?.warning).filter(Boolean),
      jumped: t.jumped,
      stage: { focus: it.def.focus ?? [], show: it.def.show, view: it.def.view, animation: it.def.animation, labels: [...labels], labelsBefore: [...this.labelsAt(t, all, p - 1)] },
    };
    return { kind: 'card', card };
  }

  /** Cards still ahead after `idx` on the straight path (without taps that are not made yet). */
  private countRemaining(t: TutState, all: PathItem[], run: TutorialRun, idx: number): number {
    let n = 0;
    let at = idx;
    const probe: TutState = { ...t, path: [...t.path] };
    for (;;) {
      const nx = this.nextIndex(probe, all, run, at);
      if (nx.idx === undefined) return n;
      n++;
      probe.path.push(nx.idx);
      at = nx.idx;
    }
  }

  // ------------------------------------------------------------ tutorial pre-steps

  private preScreen(t: TutState, def: any): Screen {
    const pos = this.positionOf(def.params, t.params);
    if (pos) return pos;
    const res = this.tutRun(t);
    if ('need' in res) {
      const key = res.need;
      if (!key.startsWith('choice.')) {
        // A tool question waits until the run choices are made (a choice may bring the tool).
        if (!(key.startsWith('tool.') && (def.choices ?? []).some((c: string) => !(c in t.choices)))) return this.questionScreen(key);
      }
    } else if (res.ok.exit) {
      const ex = res.ok.exit;
      if (ex.kind === 'not_covered' || ex.kind === 'uncovered') return { kind: 'not-covered', message: ex.message, canBack: this.canBack };
      return { kind: 'exit', exitKind: ex.kind, message: ex.message, canJump: false, putBack: [], labels: [], canBack: this.canBack };
    }
    if (!t.partsDone && def.parts?.length) return { kind: 'parts', parts: def.parts.map((id: string) => this.c.part(id) ?? { id, name: id }), canBack: this.canBack };
    for (const ch of def.choices ?? []) {
      if (!(ch in t.choices)) return { kind: 'choice', choice: this.c.ix.choices.get(ch), canBack: this.canBack };
    }
    if ('need' in res) {
      return res.need.startsWith('choice.') ? { kind: 'not-covered', message: 'This guide is not available for this choice.', canBack: this.canBack } : this.questionScreen(res.need);
    }
    if (!t.tools) {
      const tools = this.toolSummary(combined(res.ok));
      const listed = [...tools.required, ...tools.one_of.flatMap((u) => u.options), ...tools.helpful];
      const ticked = [...new Set([...t.ticked, ...this.impliedTools(t)])].filter((x) => listed.includes(x));
      return { kind: 'tools', required: tools.required, oneOf: tools.one_of, helpful: tools.helpful, ticked, canBack: this.canBack };
    }
    return { kind: 'closed' };
  }

  private toolSummary(items: PathItem[]): ToolList {
    return mergeTools(items.map((it) => it.tools));
  }

  choose(choiceId: string, option: string): void {
    const s = this.st.stage;
    if (s.k !== 'tut') return;
    this.snapshot();
    s.t.choices[choiceId] = option;
  }

  partsOk(): void {
    const s = this.st.stage;
    if (s.k !== 'tut') return;
    this.snapshot();
    s.t.partsDone = true;
  }

  toggleTool(id: string): void {
    const s = this.st.stage;
    if (s.k !== 'tut') return;
    const t = s.t;
    t.ticked = t.ticked.includes(id) ? t.ticked.filter((x) => x !== id) : [...t.ticked, id];
  }

  /** Confirms the tool picker and opens the first card. */
  startTutorial(): void {
    const s = this.st.stage;
    if (s.k !== 'tut') return;
    const t = s.t;
    const scr = this.preScreen(t, this.c.ix.tutorials.get(t.id));
    if (scr.kind !== 'tools') return;
    this.snapshot();
    t.tools = [...new Set([...t.ticked, ...this.impliedTools(t)])];
    // Remember the user's tools for the next run.
    const listed = [...scr.required, ...scr.oneOf.flatMap((u) => u.options), ...scr.helpful];
    this.store.setTools([...new Set([...this.store.data.tools.filter((x) => !listed.includes(x)), ...t.ticked])]);
    const res = this.tutRun(t);
    if (!('ok' in res)) return;
    t.started = true;
    const all = combined(res.ok);
    const first = this.nextIndex(t, all, res.ok, -1);
    this.applyAuto(t, first.auto, all);
    if (first.idx === undefined) {
      this.finishTutorial(t, res.ok);
      return;
    }
    t.path = [first.idx];
    this.onArrive(t, all, first.idx);
  }

  private applyAuto(t: TutState, auto: Array<{ idx: number; state: string }>, all: PathItem[]): void {
    for (const a of auto) {
      t.taps[String(a.idx)] = a.state;
      this.learnFrom(all[a.idx], a.state);
    }
  }

  /** An inspection state with sets tells lasting facts: learned now, kept only through the keep screen. */
  private learnFrom(it: PathItem, state: string | undefined): void {
    if (it.kind !== 'inspect' || state === undefined) return;
    for (const [k, v] of Object.entries<any>(it.def.states.find((s: any) => s.id === state)?.sets ?? {})) this.bike.facts[k] = v;
  }

  private onArrive(t: TutState, all: PathItem[], idx: number): void {
    const it = all[idx];
    const tap = t.taps[String(idx)];
    // An inspection answered earlier in this session is not counted again; if it exits, the exit shows right away.
    if (tap !== undefined) {
      if (this.outcomeOf(it, tap).kind === 'exit') t.exitAt = idx;
      return;
    }
    this.shownPath.push(it.id);
    this.st.minutes += it.def.minutes ?? 0;
  }

  private tutTap(t: TutState, id: string): void {
    if (!t.started) return;
    const res = this.tutRun(t);
    if (!('ok' in res)) return;
    const all = combined(res.ok);
    const idx = t.path[t.path.length - 1];
    const it = all[idx];
    // A different answer replaces what the earlier one taught.
    this.unlearn(it, t.taps[String(idx)]);
    t.taps[String(idx)] = id;
    const o = this.outcomeOf(it, id);
    if (it.kind === 'inspect') {
      this.session.answers[it.id] = id;
      this.learnFrom(it, id);
    }
    t.exitAt = o.kind === 'exit' ? idx : undefined;
    // An inspection without a default (all its states are buttons): an answer that goes on moves on at once.
    if (it.kind === 'inspect' && it.def.default === undefined && o.kind === 'continue') this.tutNext(t);
  }

  private unlearn(it: PathItem, state: string | undefined): void {
    if (it.kind !== 'inspect' || state === undefined) return;
    for (const k of Object.keys(it.def.states.find((s: any) => s.id === state)?.sets ?? {})) {
      if (this.home && k in this.home.facts) this.bike.facts[k] = this.home.facts[k];
      else delete this.bike.facts[k];
    }
  }

  private tutNext(t: TutState): void {
    const res = this.tutRun(t);
    if (!('ok' in res)) return;
    const run = res.ok;
    const all = combined(run);
    const idx = t.path[t.path.length - 1];
    const it = all[idx];
    // Next on an inspection with a default: no answer, or a block now fixed, means the default state.
    if (it.kind === 'inspect' && it.def.default !== undefined) {
      const tap = t.taps[String(idx)];
      if (tap === undefined || this.outcomeOf(it, tap).kind === 'block') {
        this.unlearn(it, tap);
        t.taps[String(idx)] = it.def.default;
        this.session.answers[it.id] = it.def.default;
        this.learnFrom(it, it.def.default);
      }
    }
    const nx = this.nextIndex(t, all, run, idx);
    this.applyAuto(t, nx.auto, all);
    const n = t.path.length;
    this.progressMax = Math.max(this.progressMax, n / (n + this.countRemaining(t, all, run, idx)));
    if (nx.idx === undefined) {
      this.finishTutorial(t, run);
      return;
    }
    t.path.push(nx.idx);
    this.onArrive(t, all, nx.idx);
  }

  /** "Show me how to put it back": jump ahead in the same tutorial to the exit's show_how_from. */
  exitShowHow(): void {
    const s = this.st.stage;
    if (s.k !== 'tut' || s.t.exitAt === undefined) return;
    const t = s.t;
    const res = this.tutRun(t);
    if (!('ok' in res)) return;
    const all = combined(res.ok);
    const idx = t.exitAt!;
    const ex = this.outcomeOf(all[idx], t.taps[String(idx)]).exit;
    const j = ex?.show_how_from ? findJumpTarget(res.ok, idx, ex.show_how_from) : undefined;
    if (j === undefined) return;
    this.snapshot();
    const n = t.path.length;
    t.jumped = true;
    t.exitAt = undefined;
    t.path.push(j);
    this.progressMax = Math.max(this.progressMax, n / (n + 1 + this.countRemaining(t, all, res.ok, j)));
    this.onArrive(t, all, j);
  }

  /** "Find a shop" on an exit screen. */
  exitFindShop(): void {
    const s = this.st.stage;
    this.snapshot();
    if (s.k === 'tut') {
      const t = s.t;
      const def = this.c.ix.tutorials.get(t.id);
      const res = this.tutRun(t);
      const extra: string[] = [];
      let still: string[] = [];
      if ('ok' in res && t.exitAt !== undefined) {
        const all = combined(res.ok);
        const it = all[t.exitAt];
        const tap = t.taps[String(t.exitAt)];
        const label = it.kind === 'inspect' ? it.def.states.find((x: any) => x.id === tap)?.label : it.buttons.find((b) => b.id === tap)?.label;
        extra.push(`Stopped at: ${it.def.title}: "${label}"`);
        still = [...this.labelsAt(t, all, t.path.length - 1)].map((l) => this.c.stateLabel(l)?.put_back ?? l);
      }
      this.st.stage = { k: 'shop', summary: this.shopSummary(def?.job, extra, still) };
    } else if (s.k === 'exit' || s.k === 'not-covered') {
      this.st.stage = { k: 'shop', summary: this.shopSummary(s.job, []) };
    } else if (s.k === 'diag') {
      this.st.stage = { k: 'shop', summary: this.shopSummary(undefined, [`Symptom: ${this.c.ix.diagnoses.get(s.id)?.symptom ?? s.id}`]) };
    }
  }

  private finishTutorial(t: TutState, run: TutorialRun): void {
    const def = this.c.ix.tutorials.get(t.id);
    t.ended = true;
    if (t.jumped) {
      const all = combined(run);
      const stop = t.path.find((i) => {
        const o = this.outcomeOf(all[i], t.taps[String(i)]);
        return o.kind === 'exit';
      });
      const extra: string[] = [];
      if (stop !== undefined) {
        const it = all[stop];
        const tap = t.taps[String(stop)];
        const label = it.kind === 'inspect' ? it.def.states.find((x: any) => x.id === tap)?.label : it.buttons.find((b) => b.id === tap)?.label;
        extra.push(`Found during the guide: ${it.def.title}: "${label}"`);
      }
      extra.push('Already done: the guide up to that point. The bike is put back.');
      const still = [...this.labelsAt(t, all, t.path.length - 1)].map((l) => this.c.stateLabel(l)?.put_back ?? l);
      this.st.stage = { k: 'shop', summary: this.shopSummary(def?.job, extra, still) };
      return;
    }
    if (def?.job) {
      this.store.clearJob(this.bike, def.job, new Date().toISOString().slice(0, 10));
      this.persist();
    }
    const askFixed = !!this.st.diag && this.st.diag.next < (this.c.ix.diagnoses.get(this.st.diag.id)?.checks.length ?? 0);
    this.st.stage = { k: 'done', title: this.c.jobTitle(def?.job ?? t.id), minutes: this.st.minutes, askFixed };
  }

  /** "Did it fix it?" No: the diagnosis goes on with the checks after the hit. */
  notFixed(): void {
    const d = this.st.diag;
    if (!d) return;
    this.snapshot();
    this.st.stage = { k: 'diag', id: d.id, params: d.params, i: d.next, started: true };
    this.st.diag = undefined;
    const s = this.st.stage;
    const res = this.diagRun(s);
    if ('ok' in res && !res.ok.exit) this.diagAdvance(s, res.ok);
  }

  /** Opens the job screen for a to-do item from the list at the end of the routine check. */
  openTodo(f: Finding): void {
    this.snapshot();
    this.st.stage = { k: 'job', job: f.job!, urgency: f.urgency, params: f.pos ? { pos: f.pos } : {} };
  }

}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
