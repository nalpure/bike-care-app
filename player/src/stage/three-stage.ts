// The 3D stage: a three.js port of the prototype's pinned view (legacy/Bikefix-garage-guide v2.html).
// It implements the Stage interface of ui/stage.ts. Its element is created once and moved into
// each card, so the canvas, camera and animation carry on while the text changes.
//
// What it shows comes only from the StageView: focus nodes, a named view, an animation, the
// session state labels and the bike's facts. A name it does not know shows the whole bike
// without highlight and logs a warning; it never throws into the card.

import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { h, icon } from '../ui/dom.js';
import type { Stage, StageView } from '../ui/stage.js';
import { ease, makeAnim, partStatus, placeMoved, wheelStep, type Anim, type AnimCtx, type Frame, type ScrewNode } from './anim.js';
import { Contours } from './contour.js';
import { BikeModel, bikeSpec, GAP_OK, GROUND, HP, LIFT, RP, seg, type BikeSpec, type Part } from './bike.js';
import { addHeld, shownParts, visTargets } from './visibility.js';
import { BARREL_FACT, BARREL_HOLDERS, barrelPick, pickedParts, turnKey, turnPart, type BarrelPick } from './barrel.js';
import { CLIPS, HELD_PARTS, LABEL_SCENES, modelOf, MOTIONS, NODES, partsOf, previewNode, showPartsOf, VIEWS, type Pose } from './registry.js';
import { mixPose, poseVals, type PoseVals } from './pose.js';
import { PARK_HIDES } from './park.js';
import { buildWall, wallFor } from './wall.js';
import { fitPose, FIT_VIEWS, previewPose, viewPose, type ViewPose } from './views.js';

const nowS = () => performance.now() / 1000;
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICON_REPLAY = 'M3 12a9 9 0 1 0 3-6.7|M3 4v5h5';
const ICON_EXPAND = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
const ICON_CLOSE = 'M6 6l12 12|M18 6L6 18';
/** vertical field of view for a wide stage; narrower stages widen it so the bike fits */
const BASE_TAN = Math.tan((17.5 * Math.PI) / 180);

interface Playing { anim?: Anim; caption: string; view?: string }

/** How far parts sit from each edge of the 3D view (framing). */
type Box = { left: number; right: number; top: number; bottom: number; behind: number };

/** What the user tapped in the garage preview. */
export interface PreviewPick {
  /** registry node, e.g. rear_derailleur */
  node: string;
  /** generic name, e.g. "Rear derailleur" */
  name: string;
  /** the part's model from the bike's facts ("Shimano XT RD-M8100"), or '' */
  model: string;
}

export interface PreviewOptions {
  /** the bike's name, written on the down tube */
  name?: string;
  /** called when the user taps a part (null: tapped beside the bike) */
  onPick?: (pick: PreviewPick | null) => void;
}

/** Styles for the preview mode, kept here so the stage folder carries its own look. */
const PREVIEW_CSS = `
.stage3d.preview { flex: none; width: 100%; height: 100%; min-height: 0; }
.stage3d.preview .fabs, .stage3d.preview .cap, .stage3d.preview .tags3d { display: none; }
.stage3d .pfabs, .stage3d.no3d.preview .pfabs { display: none; }
.stage3d .pfabs { position: absolute; right: 10px; bottom: 10px; }
.stage3d.preview .pfabs { display: flex; }
.stage3d.preview.full { position: fixed; inset: 0; z-index: 75; width: auto; height: auto; border-radius: 0; border: 0; }
.stage3d.preview.full .pfabs { bottom: auto; top: calc(12px + env(safe-area-inset-top, 0px)); right: max(12px, env(safe-area-inset-right, 0px)); }
.stage3d.preview.full .stnote { bottom: calc(14px + env(safe-area-inset-bottom, 0px)); }
.stage-full .assist { visibility: hidden; }
.stage3d .ptag { position: absolute; left: 0; top: 0; display: none; flex-direction: column; gap: 2px; max-width: min(70%, 260px); padding: 6px 9px; border-radius: 9px; background: var(--panel); color: var(--ink); border: 1px solid var(--line); font: 600 14px/1.2 var(--f-body); pointer-events: none; will-change: transform; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
.stage3d .ptag.on { display: flex; }
.stage3d .ptag small { font: 500 10.5px/1.25 var(--f-mono); letter-spacing: .02em; color: var(--ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stage3d .ptag::after { content: ""; position: absolute; left: 50%; bottom: -5px; width: 8px; height: 8px; margin-left: -4px; transform: rotate(45deg); background: var(--panel); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
`;

export class ThreeStage implements Stage {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private tagsEl: HTMLElement;
  private capEl: HTMLElement;
  private noteEl: HTMLElement;
  private noglEl: HTMLElement;
  private pname: HTMLElement;
  private palias: HTMLElement;
  private pdesc: HTMLElement;
  private xall: HTMLElement;
  private xfocus: HTMLElement;
  private ptag: HTMLElement;
  /** the preview's full-screen button (expand, or close while full) */
  private pfull: HTMLButtonElement;

  private gl: T.WebGLRenderer | null = null;
  private scene = new T.Scene();
  /** lights only; snapshot() renders a bike in it */
  private snapScene = new T.Scene();
  private camera = new T.PerspectiveCamera(35, 1, 0.05, 60);
  private holder = new T.Group();
  private root = new T.Group();
  private grid = new T.GridHelper(9, 36, 0x888888, 0x888888);
  private standMat = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.2 });
  /** the wall a parked bike leans on (wall.ts): built for the model the first time it parks; null when none fits */
  private wall: T.Mesh | null | undefined;
  private wallMat = new T.MeshStandardMaterial({ color: 0x888888, roughness: 0.95, metalness: 0, transparent: true });
  private controls: OrbitControls | null = null;
  private model: BikeModel | null = null;
  private specKey = '';

  private COL = { part: new T.Color(), accent: new T.Color(), good: new T.Color(), bad: new T.Color(), contour: new T.Color() };
  private tmpCol = new T.Color();
  private hotTmp = new T.Color();
  private frameCol = new T.Color();

  // ghost marker (where the pulley should be) and the turn arrow
  private ghostMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthTest: false });
  private ghost = new T.Group();
  private ghostRing = new T.Mesh(new T.TorusGeometry(RP + 0.012, 0.005, 8, 36), this.ghostMat);
  private plumb = new T.Mesh(new T.BoxGeometry(0.004, 1, 0.004), this.ghostMat);
  private gapBar = new T.Mesh(new T.BoxGeometry(0.012, 1, 0.012), this.ghostMat);
  private arrowMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false });
  private arrow = new T.Group();
  private arrowKey = '';

  // what the current card asks for
  private view: StageView = { focus: [], labels: [], facts: {} };
  private cardKey = '';
  private cardView: ViewPose | undefined;
  private hotParts = new Set<string>();
  private ctxAll = true;
  private hidden = new Set<string>();
  /** the parts drawn plain on a card with `show`; null on a card without (then nothing is hidden by the card) */
  private shown: Set<string> | null = null;
  /** the frame is not drawn: stand, stand clamp and hook go with it (see applyFocus) */
  private frameGone = false;
  /** opacity of the stand, its rope and the hook: eases to 0 while frameGone */
  private standVis = 1;
  private stepAnim: Playing | null = null;
  private sol: { list: Playing[]; i: number; t0: number } | null = null;
  private t0 = nowS();
  private restZ: number | undefined;
  private warned = new Set<string>();

  // motion state
  private derTarget = 0;
  private gapNow = GAP_OK;
  private crankAngle = 0;
  private wheelAngle = { rear_wheel: 0, front_wheel: 0 };
  private poseTo: Pose = 'ground';
  private posePrev: Pose = 'ground';
  private poseBefore: Pose = 'ground';
  private poseAfter: Pose = 'ground';
  private poseFrom: PoseVals = poseVals('ground', bikeSpec({}));
  private poseNow: PoseVals = poseVals('ground', bikeSpec({}));
  private poseK = 1;
  /** the last frame's pose came from the clip (Frame.pose): when it stops, the bike eases back */
  private clipPosed = false;
  private moved = new Set<string>();
  /** rest outlines a clip asks for (Frame.contour), one per model */
  private contours: Contours | null = null;
  /** a clip time held for pictures (holdClip), else null */
  private heldT: number | null = null;
  /** the barrel adjuster the card's facts pick (barrel.ts) */
  private barrels: BarrelPick = barrelPick('flat', undefined);
  /** the card's own marked and drawn parts; a clip's Frame.scene adds to them while it plays */
  private cardHot = new Set<string>();
  private cardShown: Set<string> | null = null;
  private sceneKey = '';
  /** the camera follows a clip's Frame.cam */
  private clipCam = false;

  // camera
  private look = new T.Vector3(0, 0.9, 0.1);
  private tw: { p0: T.Vector3; t0: T.Vector3; vp: ViewPose; k: number; dur: number } | null = null;
  private camVp: ViewPose | null = null;

  // tags, explore
  /** the tags of the card's nodes: where each sits, and the parts it names (a tag hides while none of them is drawn) */
  private tagList: Array<{ el: HTMLElement; obj: T.Object3D; parts: Part[]; w?: number; h?: number }> = [];
  private tagTimer = 0;
  private noteTimer = 0;
  private exploring = false;
  private showAll = true;
  private selected: string | null = null;
  private lastCap: string | null = null;
  // garage preview
  private previewing = false;
  private previewOpts: PreviewOptions = {};
  private pickAnchor = new T.Object3D();
  private pickOn = false;
  private pickParts = new Set<string>();
  private idleTimer = 0;
  private last = nowS();
  private first = true;

  constructor() {
    this.canvas = h('canvas.gl', { 'aria-hidden': 'true' }) as HTMLCanvasElement;
    this.noglEl = h('div.nogl', { hidden: true });
    this.tagsEl = h('div.tags3d', { 'aria-hidden': 'true' });
    this.capEl = h('div.cap', { 'aria-live': 'polite', 'data-test': 'stage-caption' });
    this.noteEl = h('div.stnote');
    this.pname = h('strong', 'Tap a part');
    this.palias = h('span', 'Drag to turn, pinch to zoom.');
    this.pdesc = h('span');
    this.xfocus = h('button', { 'aria-pressed': 'false', onclick: () => this.setShowAll(false) }, 'Step focus');
    this.xall = h('button', { 'aria-pressed': 'true', onclick: () => this.setShowAll(true) }, 'Show all');
    this.ptag = h('div.ptag', { 'aria-live': 'polite', 'data-test': 'preview-tag' });
    this.pfull = h('button.fab', { 'data-test': 'preview-full', onclick: () => this.setFull(!this.el.classList.contains('full')) }) as HTMLButtonElement;
    this.el = h('section.stage.stage3d', { 'aria-label': '3D view of the bike', 'data-test': 'stage' },
      this.canvas, this.noglEl, this.tagsEl, this.ptag, this.capEl, this.noteEl,
      h('div.pfabs', this.pfull),
      h('div.fabs',
        h('button.fab', { 'aria-label': 'Replay animation', 'data-test': 'replay', onclick: () => this.replay() }, icon(ICON_REPLAY)),
        h('button.fab', { 'aria-label': 'Explore in 3D', 'data-test': 'explore', onclick: () => this.enterExplore() }, icon(ICON_EXPAND)),
      ),
      h('div.xui.xtop',
        h('button.fab', { 'aria-label': 'Close 3D explorer', 'data-test': 'explore-close', onclick: () => this.exitExplore() }, icon(ICON_CLOSE)),
        h('div.seg', { role: 'group', 'aria-label': 'Which parts to show' }, this.xfocus, this.xall),
      ),
      h('div.xui.xbottom', h('div.pcard', { 'aria-live': 'polite' }, this.pname, this.palias, this.pdesc)),
    );
    this.setFull(false);

    try {
      this.gl = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    } catch (e) {
      this.gl = null;
      console.warn('[stage] WebGL is not available; showing the written steps only.', e);
    }
    if (this.gl) this.setUp(this.gl);
    else this.el.classList.add('no3d');
  }

  // ------------------------------------------------------------------ set-up

  private setUp(gl: T.WebGLRenderer): void {
    // The prototype ran on three r128 without colour management and with legacy light units.
    // Keep that look: colours pass through unchanged, and light intensities are scaled by pi.
    T.ColorManagement.enabled = false;
    gl.outputColorSpace = T.LinearSRGBColorSpace;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const s = this.scene;
    for (const sc of [s, this.snapScene]) {
      // Less even light than the prototype's, so faces turned different ways differ in shade:
      // a key light from above and the front-left, a weaker fill from behind on the right.
      sc.add(new T.AmbientLight(0xffffff, 0.24 * Math.PI));
      sc.add(new T.HemisphereLight(0xffffff, 0x3e4a55, 0.62 * Math.PI));
      const sun = new T.DirectionalLight(0xffffff, 1.05 * Math.PI);
      sun.position.set(-2, 4, 5);
      sc.add(sun);
      const fill = new T.DirectionalLight(0xdfe8f0, 0.32 * Math.PI);
      fill.position.set(3, 1.5, -4);
      sc.add(fill);
    }
    s.add(this.holder);
    this.holder.add(this.root);
    const gm = this.grid.material as T.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = 0.22;
    this.grid.position.y = GROUND;
    s.add(this.grid);

    this.ghostRing.renderOrder = this.plumb.renderOrder = this.gapBar.renderOrder = 9;
    this.ghost.add(this.ghostRing, this.plumb, this.gapBar);
    this.ghost.visible = false;
    this.root.add(this.ghost);
    this.arrow.visible = false;
    this.root.add(this.arrow);

    this.camera.position.set(-1.6, 1.3, 5.2);
    const controls = new OrbitControls(this.camera, this.canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.35;
    controls.maxDistance = 9;
    controls.enabled = false;
    controls.autoRotateSpeed = 0.7;
    // in the preview, the bike stops turning while the user drags it and starts again later
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      clearTimeout(this.idleTimer);
    });
    controls.addEventListener('end', () => {
      clearTimeout(this.idleTimer);
      if (this.previewing && !reduceMotion()) this.idleTimer = window.setTimeout(() => (controls.autoRotate = this.previewing), 6000);
    });
    this.controls = controls;
    if (!document.getElementById('stage-preview-css')) document.head.append(h('style', { id: 'stage-preview-css' }, PREVIEW_CSS));

    this.readColors();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.readColors());
    new MutationObserver(() => this.readColors()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.fonts?.ready.then(() => this.model?.redrawDecal());
    new ResizeObserver(() => this.resize()).observe(this.el);
    document.addEventListener('keydown', (e) => {
      if (this.previewing && this.el.classList.contains('full')) {
        e.stopPropagation();
        if (e.key === 'Escape') this.setFull(false);
        return;
      }
      if (!this.exploring) return;
      e.stopPropagation();
      if (e.key === 'Escape') this.exitExplore();
    }, true);
    this.attachPicking();
    this.rebuild(bikeSpec({}));
    requestAnimationFrame(this.tick);
  }

  private readColors(): void {
    const cs = getComputedStyle(document.documentElement);
    const g = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
    this.COL.part.set(g('--part', '#5C6D7B'));
    this.COL.accent.set(g('--accent', '#F2B600'));
    this.COL.good.set(g('--good', '#1E9E5A'));
    this.COL.bad.set(g('--bad', '#D6453D'));
    this.COL.contour.set(g('--contour', '#1F5FBF'));
    (this.grid.material as T.LineBasicMaterial).color.copy(this.COL.part);
    this.standMat.color.copy(this.COL.part).multiplyScalar(0.7);
    // the lights are strong (the prototype's look): a darker shade of the stage's second colour reads as a plain wall
    this.wallMat.color.set(g('--stage2', '#C9D4DB')).multiplyScalar(0.72);
  }

  private rebuild(spec: BikeSpec): void {
    if (this.model) {
      this.root.remove(this.model.bike);
      this.scene.remove(this.model.standG, this.model.hookG);
      this.model.dispose();
    }
    if (this.wall) {
      this.scene.remove(this.wall);
      this.wall.geometry.dispose();
    }
    this.wall = undefined;
    const m = new BikeModel(spec, this.standMat);
    this.model = m;
    this.specKey = JSON.stringify(spec);
    this.root.add(m.bike);
    this.scene.add(m.standG, m.hookG);
    this.derTarget = m.derZ;
    this.moved.clear();
    this.contours = new Contours(m);
    this.clearPick();
  }

  private resize = (): void => {
    if (!this.gl) return;
    const w = this.el.clientWidth;
    const hgt = this.el.clientHeight;
    if (!w || !hgt) return;
    this.gl.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.fov = (2 * Math.atan(BASE_TAN * Math.max(1, 1.3 / this.camera.aspect)) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ Stage interface

  show(v: StageView): void {
    if (this.previewing) this.endPreview();
    if (!this.gl) {
      this.showText(v);
      return;
    }
    const spec = bikeSpec(v.facts);
    if (JSON.stringify(spec) !== this.specKey) {
      this.rebuild(spec);
      this.cardKey = '';
    }
    const pick = barrelPick(spec.bar, v.facts[BARREL_FACT]);
    const key = JSON.stringify([v.id, v.focus, v.show, v.view, v.animation, v.labels, v.labelsBefore, pick]);
    const prevChosen = this.view.chosen;
    this.view = v;
    if (key === this.cardKey) {
      // the same card again (a tap, choose again): only a changed answer stops a solution
      if (v.chosen !== prevChosen && this.sol) this.stopSolution();
      return;
    }
    this.cardKey = key;
    this.sol = null;
    this.barrels = pick;
    const m = this.model!;
    const parts = (n: string) => pickedParts(n, pick, partsOf);

    // Unknown names: whole bike, no highlight, a warning. Never block the card.
    const problems: string[] = [];
    for (const f of [...v.focus, ...(v.show ?? [])]) if (!NODES[f]) problems.push(`node "${f}"`);
    if (v.view && !(VIEWS as readonly string[]).includes(v.view)) problems.push(`view "${v.view}"`);
    const a = v.animation;
    if (a?.clip && !(CLIPS as readonly string[]).includes(a.clip)) problems.push(`clip "${a.clip}"`);
    if (a && !a.clip && (!NODES[a.target] || !(MOTIONS as readonly string[]).includes(a.motion))) problems.push(`animation ${a.motion ?? '?'} on "${a.target ?? '?'}"`);
    if (a?.view && !(VIEWS as readonly string[]).includes(a.view)) problems.push(`view "${a.view}"`);
    const fallback = problems.length > 0;
    if (fallback) this.warnOnce(`${v.id}|${problems.join()}`, `[stage] ${v.id ?? 'card'}: unknown ${problems.join(', ')}. Showing the whole bike without highlight.`);

    // How the bike is held, and what is off the bike. A step that sets or clears a label shows
    // the bike held during the step (in the stand while the clamp opens), and a part is hidden
    // only when it is off both before and after the step, so taking it off or putting it on shows.
    const after = this.sceneOf(v.labels);
    const before = this.sceneOf(v.labelsBefore ?? v.labels);
    this.poseAfter = after.pose;
    this.poseBefore = before.pose;
    const pose: Pose = after.pose !== 'ground' ? after.pose : before.pose;
    this.hidden = new Set([...after.hides].filter((p) => before.hides.has(p)));
    if (pose !== this.poseTo) {
      this.poseFrom = { ...this.poseNow };
      this.posePrev = this.poseTo;
      this.poseTo = pose;
      this.poseK = this.first || reduceMotion() ? 1 : 0;
    }

    // Focus: highlighted parts, and the parts that stay visible around them
    const focus = fallback ? [] : v.focus.filter((f) => f !== 'bike');
    this.hotParts = new Set();
    for (const f of focus) {
      const ps = parts(f).filter((p) => m.has(p));
      if (!ps.length) console.debug(`[stage] ${f} is not on this bike`);
      for (const p of ps) this.hotParts.add(p);
    }
    // Show: only the focus parts and these are drawn; every other part fades out and is then not drawn.
    // A card without show keeps the old rule (the rest of the bike stays, faded).
    this.shown = null;
    if (v.show && !fallback) {
      this.shown = addHeld(addHeld(shownParts(this.hotParts, v.show, (n) => pickedParts(n, pick, showPartsOf), (p) => m.has(p)), BARREL_HOLDERS, (p) => m.has(p)), HELD_PARTS, (p) => m.has(p));
    }
    this.cardHot = new Set(this.hotParts);
    this.cardShown = this.shown && new Set(this.shown);
    this.sceneKey = '';
    const viewName = fallback ? 'whole_bike' : v.view ?? 'whole_bike';
    this.ctxAll = viewName === 'whole_bike' || this.hotParts.size === 0;
    this.applyFocus();
    if (this.first || reduceMotion()) this.standVis = this.frameGone ? 0 : 1;

    // Where the derailleur rests on this card
    if (focus.includes('smallest_sprocket')) this.restZ = m.zOf(0);
    else if (focus.includes('largest_sprocket')) this.restZ = m.zOf(m.spec.n - 1);
    else this.restZ = undefined;

    this.stepAnim = !fallback && a ? { anim: makeAnim(a, this.animCtx()), caption: a.caption ?? '', view: a.view } : null;
    this.t0 = nowS();
    this.cardView = this.poseFor(viewName);
    if (!this.exploring) this.goCam(this.stepAnim?.view ? this.vpose(this.stepAnim.view) : this.cardView, this.first);
    this.buildTags(focus);
    this.setNote();
    this.first = false;
  }

  playSolution(anims: any[]): void {
    if (!this.gl || !this.model) return;
    const list: Playing[] = [];
    for (const a of anims ?? []) {
      const bad = (a.clip && !(CLIPS as readonly string[]).includes(a.clip)) || (!a.clip && (!NODES[a.target] || !(MOTIONS as readonly string[]).includes(a.motion))) || (a.view && !(VIEWS as readonly string[]).includes(a.view));
      if (bad) this.warnOnce(`sol|${JSON.stringify(a)}`, `[stage] solution ${JSON.stringify(a)} names something the stage does not have; showing its caption only.`);
      list.push({ anim: bad ? undefined : makeAnim(a, this.animCtx()), caption: a.caption ?? '', view: bad ? undefined : a.view });
    }
    if (!list.length) return;
    this.sol = { list, i: 0, t0: nowS() };
    if (this.exploring) this.exitExplore();
    const vn = list[0].view;
    if (vn) this.goCam(this.vpose(vn), false);
  }

  replay(): void {
    this.stopSolution();
    this.t0 = nowS();
    this.revealTags();
  }

  private stopSolution(): void {
    const hadView = this.sol?.list.some((p) => p.view);
    this.sol = null;
    if (hadView && !this.exploring && this.model) this.goCam(this.stepAnim?.view ? this.vpose(this.stepAnim.view) : this.cardView, false);
  }

  /** Without WebGL: the names of the parts in focus and the caption, as text. */
  private showText(v: StageView): void {
    this.noglEl.hidden = false;
    const names = v.focus.filter((f) => NODES[f] && f !== 'bike').map((f) => NODES[f].label);
    this.noglEl.replaceChildren(h('div',
      h('span', 'The 3D view is not available on this device. The written steps still work.'),
      names.length ? h('div.tags', names.map((n) => h('span.tag', n))) : null,
      v.animation?.caption ? h('small', v.animation.caption) : null,
    ));
  }

  private sceneOf(labels: string[]): { pose: Pose; hides: Set<string> } {
    let pose: Pose = 'ground';
    const hides = new Set<string>();
    for (const l of labels) {
      const sc = LABEL_SCENES[l];
      if (!sc) {
        this.warnOnce(`label|${l}`, `[stage] state label "${l}" has no scene; the bike is drawn as usual.`);
        continue;
      }
      if (sc.pose) pose = sc.pose;
      for (const n of sc.hides ?? []) for (const p of partsOf(n)) hides.add(p);
    }
    return { pose, hides };
  }

  private warnOnce(key: string, msg: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(msg);
  }

  private animCtx(): AnimCtx {
    const m = this.model!;
    return {
      spec: m.spec,
      focus: this.view.focus,
      poseBefore: this.poseBefore,
      pose: this.poseAfter,
      zOf: (i) => m.zOf(i),
      centerOf: (p) => {
        const part = m.parts.get(p);
        return part ? [part.center.x, part.center.y, part.center.z] : undefined;
      },
      barrel: this.barrels,
      route: m.cableRoute,
    };
  }

  // ------------------------------------------------------------------ focus, tags, note

  private applyFocus(): void {
    const m = this.model;
    if (!m) return;
    const hotCtx = new Set<string>();
    for (const id of this.hotParts) for (const c of m.parts.get(id)!.ctx) hotCtx.add(c);
    if (this.previewing) {
      for (const p of m.parts.values()) {
        p.visT = this.hidden.has(p.id) ? 0 : 1;
        p.hotT = this.pickParts.has(p.id) ? 1 : 0;
      }
      this.frameGone = false;
      return;
    }
    const { targets, frameGone } = visTargets({
      ids: [...m.parts.keys()],
      hot: this.hotParts,
      shown: this.shown,
      hidden: this.hidden,
      context: (id) => this.ctxAll || m.parts.get(id)!.ctx.includes('frame') || m.parts.get(id)!.ctx.some((c) => hotCtx.has(c)),
      exploring: this.exploring,
      showAll: this.showAll,
      selected: this.selected,
    });
    for (const [id, t] of targets) {
      const p = m.parts.get(id)!;
      p.visT = t.vis;
      p.hotT = t.hot;
    }
    this.frameGone = frameGone;
  }

  private buildTags(nodes: string[]): void {
    const m = this.model!;
    this.tagsEl.replaceChildren();
    this.tagList = [];
    // barrel_adjuster gets a tag on each barrel it marks (both while the fact is unknown)
    const tags = nodes.flatMap((n) => (n === 'barrel_adjuster' ? this.barrels.marked.map((p) => ({ n, at: p as string })) : [{ n, at: n }]));
    for (const { n, at } of tags.slice(0, 4)) {
      const obj = m.anchors.get(at) ?? m.anchors.get(partsOf(at)[0]);
      if (!obj || !partsOf(at).some((p) => m.has(p))) continue;
      const el = h('div.tag', NODES[n].label);
      this.tagsEl.append(el);
      this.tagList.push({ el, obj, parts: partsOf(at).flatMap((p) => m.parts.get(p) ?? []) });
    }
    clearTimeout(this.tagTimer);
    this.tagTimer = window.setTimeout(() => this.revealTags(), 700);
  }

  private revealTags(): void {
    for (const t of this.tagList) t.el.classList.add('on');
    clearTimeout(this.tagTimer);
    this.tagTimer = window.setTimeout(() => this.tagList.forEach((t) => t.el.classList.remove('on')), 4500);
  }

  private setNote(text?: string): void {
    this.noteEl.classList.toggle('pick', !!text);
    this.noteEl.textContent = text ?? this.view.bike ?? '';
  }

  // ------------------------------------------------------------------ camera

  private goCam(vp: ViewPose | undefined, instant: boolean): void {
    if (!vp) return;
    this.camVp = vp;
    if (instant || reduceMotion()) {
      this.tw = { p0: this.camera.position.clone(), t0: this.look.clone(), vp, k: 1, dur: 1 };
      return;
    }
    this.tw = { p0: this.camera.position.clone(), t0: this.look.clone(), vp, k: 0, dur: 1.5 };
  }

  /** A named view on this bike, with the barrel the card's facts pick. */
  private vpose(name: string): ViewPose | undefined {
    return viewPose(name, this.model!.spec, this.barrels.main);
  }

  /**
   * A clip's Frame.scene: its show and focus nodes are drawn and marked as well as the card's own; without one, the
   * card's own scene. Applied only when it changes.
   */
  private applyScene(sc: Frame['scene']): void {
    const key = sc && !this.exploring && !this.previewing ? JSON.stringify(sc) : '';
    if (key === this.sceneKey) return;
    this.sceneKey = key;
    const m = this.model!;
    const parts = (n: string) => pickedParts(n, this.barrels, partsOf).filter((p) => m.has(p));
    this.hotParts = new Set(this.cardHot);
    this.shown = this.cardShown && new Set(this.cardShown);
    if (key && sc) {
      for (const n of sc.focus ?? []) for (const p of parts(n)) this.hotParts.add(p);
      if (this.shown) {
        for (const p of this.hotParts) this.shown.add(p);
        for (const n of sc.show ?? []) for (const p of parts(n)) this.shown.add(p);
        this.shown = addHeld(addHeld(this.shown, BARREL_HOLDERS, (p) => m.has(p)), HELD_PARTS, (p) => m.has(p));
      }
    }
    this.applyFocus();
  }

  /** The named view for this card; on a card with `show`, a wide view also frames what is drawn (FIT_VIEWS). */
  private poseFor(name: string): ViewPose | undefined {
    const vp = this.vpose(name);
    if (!vp || !this.shown || vp.space !== 'bike' || !FIT_VIEWS.includes(name)) return vp;
    return { ...vp, fit: this.shownPoints() };
  }

  /**
   * Corners of the box of every mesh of a drawn part, in bike space. A mesh in the crank set is
   * also taken turned about the bottom bracket, so the pedals' circle fits whatever the crank angle.
   */
  private shownPoints(shown: Set<string> = this.shown!): Array<[number, number, number]> {
    const m = this.model!;
    m.bike.updateMatrixWorld(true);
    const inv = m.bike.matrixWorld.clone().invert();
    const pts: Array<[number, number, number]> = [];
    const mat = new T.Matrix4();
    const v = new T.Vector3();
    const turn = new T.Matrix4();
    const bb = m.crankset.position;
    m.bike.traverse((o: any) => {
      if (!o.isMesh || !shown.has(o.userData.partId)) return;
      const g = o.geometry as T.BufferGeometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox!;
      let inCranks = false;
      for (let a: T.Object3D | null = o; a; a = a.parent) if (a === m.crankset) inCranks = true;
      const turns = inCranks ? 8 : 1;
      const n = o.isInstancedMesh ? o.count : 1;
      for (let i = 0; i < n; i++) {
        if (o.isInstancedMesh) o.getMatrixAt(i, mat);
        else mat.identity();
        mat.premultiply(o.matrixWorld).premultiply(inv);
        for (let k = 0; k < turns; k++) {
          if (inCranks) turn.makeTranslation(bb.x, bb.y, 0).multiply(new T.Matrix4().makeRotationZ((k / turns) * 2 * Math.PI)).multiply(new T.Matrix4().makeTranslation(-bb.x, -bb.y, 0));
          for (let c = 0; c < 8; c++) {
            v.set(c & 1 ? b.max.x : b.min.x, c & 2 ? b.max.y : b.min.y, c & 4 ? b.max.z : b.min.z).applyMatrix4(mat);
            if (inCranks) v.applyMatrix4(turn);
            pts.push([v.x, v.y, v.z]);
          }
        }
      }
    });
    return pts;
  }

  /**
   * For checks without pictures (`npm run shots` prints it): the parts drawn now, and how far the
   * card's subject (the focus parts, and the show parts on a card with `show`) sits from each edge
   * of the 3D view, as a fraction of its width or height (negative: cut off). Corners behind the
   * camera are counted in `behind`, not in the box; no subject gives an empty `subject` and zeros.
   * Uses the camera as it is now, so call it once the camera has settled. `marked` is the same box for the
   * marked parts alone (a close-up frames them, not everything drawn), with their ids and one box per part (`each`);
   * null when none is drawn. A box does not see what covers a part: with `{ seen: true }` each marked part also gets
   * `seen`, the share of it in sight (see seenShare; a few small extra pictures, so only once the camera has settled).
   * `playing`: a clip moves parts now, so the numbers change with it (holdClip holds it).
   */
  framing(opts: { seen?: boolean } = {}): { parts: string[]; subject: string[]; playing: boolean; left: number; right: number; top: number; bottom: number; behind: number; marked: { ids: string[]; left: number; right: number; top: number; bottom: number; behind: number; each: Record<string, Box & { seen?: number | null }> } | null } | null {
    const m = this.model;
    if (!m) return null;
    const parts = [...m.parts.values()].filter((p) => p.visT > 0.5).map((p) => p.id);
    const subject = this.shown ? parts : parts.filter((id) => this.hotParts.has(id));
    const hot = parts.filter((id) => this.hotParts.has(id));
    const seen = opts.seen && hot.length && this.gl ? this.seenShare(hot) : null;
    const marked = hot.length ? { ids: hot, ...this.boxOf(hot), each: Object.fromEntries(hot.map((id) => [id, { ...this.boxOf([id]), ...(seen ? { seen: seen[id] } : {}) }])) } : null;
    return { parts, subject, playing: this.playing(), ...this.boxOf(subject), marked };
  }

  /**
   * How much of each part is in sight, for framing's `seen`: a small picture where every drawn mesh has the colour
   * of its part, against one picture per part with only that part drawn. 1: nothing covers it; 0.3: something in
   * front covers 70 % of it. Everything drawn covers (the stand too); faded parts, see-through helpers and lines do
   * not. null: the part has no pixel in view (outside it, or smaller than a pixel); the box numbers tell which.
   */
  private seenShare(ids: string[]): Record<string, number | null> {
    const gl = this.gl!;
    const m = this.model!;
    const k = Math.min(1, 480 / Math.max(this.el.clientWidth, this.el.clientHeight, 1));
    const W = Math.max(1, Math.round(this.el.clientWidth * k));
    const H = Math.max(1, Math.round(this.el.clientHeight * k));
    // a mesh belongs to the part whose material it has (BikeModel.add gives each mesh its own, and may hang the
    // mesh under another part's frame), else to its nearest part group
    const matPart = new Map<T.Material, string>();
    const groupPart = new Map<T.Object3D, string>();
    for (const p of m.parts.values()) {
      groupPart.set(p.group, p.id);
      for (const mt of p.mats) matPart.set(mt, p.id);
    }
    const partOf = (o: T.Mesh) => {
      const mt = Array.isArray(o.material) ? o.material[0] : o.material;
      if (matPart.has(mt)) return matPart.get(mt)!;
      for (let x: T.Object3D | null = o; x; x = x.parent) if (groupPart.has(x)) return groupPart.get(x)!;
      return null;
    };
    // colour codes: 0 nothing, 1 anything else drawn, 2.. the parts asked about
    const code = new Map(ids.map((id, i) => [id, i + 2]));
    const mats = new Map<string, T.MeshBasicMaterial>();
    const matFor = (c: number, side: T.Side) => {
      const key = `${c}|${side}`;
      let mt = mats.get(key);
      if (!mt) mats.set(key, (mt = new T.MeshBasicMaterial({ color: new T.Color((c & 255) / 255, (c >> 8) / 255, 0), side, toneMapped: false, fog: false })));
      return mt;
    };
    const meshes: Array<{ o: T.Mesh; mat: T.Material | T.Material[]; c: number | null }> = [];
    const hide: T.Object3D[] = [];
    this.scene.traverseVisible((o) => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) {
        if ((o as T.Line).isLine || (o as T.Points).isPoints || (o as T.Sprite).isSprite) hide.push(o);
        return;
      }
      const mat0 = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const inSight = mat0 && mat0.visible && mat0.colorWrite && (!mat0.transparent || mat0.opacity >= 0.5);
      const id = partOf(mesh);
      meshes.push({ o: mesh, mat: mesh.material, c: inSight ? (id && code.get(id)) || 1 : null });
    });
    const target = new T.WebGLRenderTarget(W, H);
    const bg = this.scene.background;
    const clearCol = gl.getClearColor(new T.Color());
    const clearA = gl.getClearAlpha();
    const px = new Uint8Array(W * H * 4);
    // not drawn in a picture: a material that writes nothing (hiding the mesh would hide meshes inside it too)
    const none = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const count = (only: number | null): number[] => {
      for (const it of meshes) {
        const drawn = it.c !== null && (only === null || it.c === only);
        it.o.material = drawn ? matFor(it.c!, (Array.isArray(it.mat) ? it.mat[0] : it.mat).side) : none;
      }
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(this.scene, this.camera);
      gl.readRenderTargetPixels(target, 0, 0, W, H, px);
      const n = new Array(ids.length + 2).fill(0);
      for (let i = 0; i < px.length; i += 4) {
        const c = px[i] + px[i + 1] * 256;
        if (c < n.length) n[c]++;
      }
      return n;
    };
    try {
      for (const o of hide) o.visible = false;
      this.scene.background = null;
      gl.setClearColor(0x000000, 1);
      const all = count(null);
      return Object.fromEntries(ids.map((id, i) => {
        const alone = count(i + 2)[i + 2];
        return [id, alone ? Math.min(1, all[i + 2] / alone) : null];
      }));
    } finally {
      for (const it of meshes) it.o.material = it.mat;
      for (const o of hide) o.visible = true;
      this.scene.background = bg;
      gl.setRenderTarget(null);
      gl.setClearColor(clearCol, clearA);
      target.dispose();
      none.dispose();
      for (const mt of mats.values()) mt.dispose();
    }
  }

  /** How far the parts sit from each edge of the 3D view now (see framing). */
  private boxOf(ids: string[]): Box {
    const m = this.model!;
    const pts = this.shownPoints(new Set(ids));
    if (!pts.length) return { left: 0, right: 0, top: 0, bottom: 0, behind: 0 };
    m.bike.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = 0;
    const v = new T.Vector3();
    const toCam = new T.Vector3();
    for (const p of pts) {
      v.set(...p).applyMatrix4(m.bike.matrixWorld);
      if (toCam.copy(v).applyMatrix4(this.camera.matrixWorldInverse).z > -this.camera.near) {
        behind++;
        continue;
      }
      v.project(this.camera);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    return { left: (x0 + 1) / 2, right: (1 - x1) / 2, top: (1 - y1) / 2, bottom: (y0 + 1) / 2, behind };
  }

  private camDest(vp0: ViewPose): { p: T.Vector3; t: T.Vector3 } {
    const vp = vp0.fit ? fitPose(vp0, vp0.fit, Math.tan((this.camera.fov * Math.PI) / 360), this.camera.aspect) : vp0;
    const p = new T.Vector3(...vp.p);
    const t = new T.Vector3(...vp.t);
    if (vp.space === 'bike') {
      this.root.localToWorld(p);
      this.root.localToWorld(t);
    }
    return { p, t };
  }

  // ------------------------------------------------------------------ garage preview

  /**
   * Garage preview: the bike drawn from `facts`, whole, turning slowly. Drag to turn it, pinch
   * to zoom; tap a part for a tag with its name and, when the bike's facts know it, its model in
   * small text. The stage element moves into `host`, which gives it its size. Showing a card
   * (`show`) or `endPreview()` leaves the preview. Calling it again with other facts redraws.
   */
  preview(facts: Record<string, unknown>, host: HTMLElement, opts: PreviewOptions = {}): void {
    if (this.el.parentElement !== host) host.append(this.el);
    this.el.classList.add('preview');
    this.previewOpts = opts;
    if (!this.gl || !this.controls) {
      this.noglEl.hidden = false;
      this.noglEl.replaceChildren(h('div', h('span', 'The 3D view is not available on this device.')));
      return;
    }
    if (this.exploring) this.exitExplore();
    this.previewing = true;
    const spec = bikeSpec(facts);
    if (JSON.stringify(spec) !== this.specKey) this.rebuild(spec);
    const m = this.model!;
    this.view = { focus: [], labels: [], facts, bike: opts.name };
    this.cardKey = '';
    this.sol = null;
    this.stepAnim = null;
    this.restZ = undefined;
    this.hotParts = new Set();
    this.hidden = new Set();
    this.ctxAll = true;
    this.shown = null;
    this.standVis = 1;
    this.poseTo = this.posePrev = this.poseBefore = this.poseAfter = 'ground';
    this.poseFrom = poseVals('ground', m.spec);
    this.poseK = 1;
    this.tagsEl.replaceChildren();
    this.tagList = [];
    this.clearPick();
    const vp = previewPose(m.spec);
    this.camera.position.set(...vp.p);
    this.look.set(...vp.t);
    this.tw = null;
    this.camVp = null;
    const c = this.controls;
    c.target.copy(this.look);
    c.maxPolarAngle = HP * 1.02;
    c.minDistance = 1.2;
    c.enabled = true;
    c.autoRotate = !reduceMotion();
    c.update();
    this.noteEl.classList.remove('pick');
    this.noteEl.textContent = 'Tap a part';
    this.applyFocus();
    this.resize();
  }

  /** Leaves the garage preview; the next `show` flies the camera to its card. */
  /**
   * A still picture of the bike drawn from `facts` (the preview's camera, transparent
   * background), as a PNG data URL, or null without WebGL. For lists that show several bikes;
   * it does not disturb the live stage. Width and height in CSS pixels.
   */
  snapshot(facts: Record<string, unknown>, width = 320, height = 200, name?: string): string | null {
    const gl = this.gl;
    if (!gl || typeof document === 'undefined') return null;
    const k = 2;
    const W = Math.round(width * k);
    const H = Math.round(height * k);
    const m = new BikeModel(bikeSpec(facts), this.standMat);
    const target = new T.WebGLRenderTarget(W, H);
    try {
      const frameCol = m.spec.colour ? new T.Color(m.spec.colour) : null;
      for (const p of m.parts.values()) {
        for (const mat of p.mats) {
          mat.opacity = 1;
          mat.depthWrite = true;
          if (mat.userData.dark) mat.color.copy(this.COL.part).multiplyScalar(0.22);
          else if (frameCol && mat.userData.tint === 'frame') mat.color.copy(frameCol);
          else mat.color.copy(this.COL.part).multiplyScalar(mat.userData.k);
        }
      }
      m.drawDecal(name ?? '', frameCol ?? this.COL.part, 1);
      this.snapScene.add(m.bike);
      const vp = previewPose(m.spec);
      const cam = new T.PerspectiveCamera(35, W / H, 0.05, 60);
      cam.fov = (2 * Math.atan(BASE_TAN * Math.max(1, 1.3 / cam.aspect)) * 180) / Math.PI;
      cam.updateProjectionMatrix();
      cam.position.set(...vp.p);
      cam.lookAt(...vp.t);
      const clear = gl.getClearAlpha();
      gl.setRenderTarget(target);
      gl.setClearAlpha(0);
      gl.clear();
      gl.render(this.snapScene, cam);
      const px = new Uint8Array(W * H * 4);
      gl.readRenderTargetPixels(target, 0, 0, W, H, px);
      gl.setRenderTarget(null);
      gl.setClearAlpha(clear);
      // WebGL rows run bottom to top; draw at double size, then scale down for smooth edges
      const big = document.createElement('canvas');
      big.width = W;
      big.height = H;
      const img = new ImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      big.getContext('2d')?.putImageData(img, 0, 0);
      const out = document.createElement('canvas');
      out.width = Math.round(width);
      out.height = Math.round(height);
      const c = out.getContext('2d');
      if (!c) return null;
      c.imageSmoothingQuality = 'high';
      c.drawImage(big, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    } catch (e) {
      console.warn('[stage] snapshot failed', e);
      return null;
    } finally {
      this.snapScene.remove(m.bike);
      m.dispose();
      target.dispose();
    }
  }

  endPreview(): void {
    if (!this.previewing) return;
    this.previewing = false;
    clearTimeout(this.idleTimer);
    this.setFull(false);
    this.el.classList.remove('preview');
    this.clearPick();
    if (this.controls) {
      this.controls.enabled = false;
      this.controls.autoRotate = false;
      this.controls.maxPolarAngle = Math.PI;
      this.controls.minDistance = 0.35;
    }
    this.cardKey = '';
    this.noteEl.textContent = '';
    this.applyFocus();
    this.resize();
  }

  /**
   * The garage preview over the whole screen (like explore on a card), or back in its box. The
   * bike keeps turning and taps still show tags. Escape, the close button or leaving the preview
   * ends it. The assistant button is hidden meanwhile (`.stage-full` on the page).
   */
  private setFull(on: boolean): void {
    this.el.classList.toggle('full', on);
    document.documentElement.classList.toggle('stage-full', on);
    this.pfull.replaceChildren(icon(on ? ICON_CLOSE : ICON_EXPAND));
    this.pfull.setAttribute('aria-label', on ? 'Close full screen' : 'Full screen');
    this.resize();
  }

  private pick(hit: { id: string; obj: T.Object3D; at: T.Vector3 } | null): void {
    const node = hit ? previewNode(hit.id) : null;
    if (!hit || !node || !NODES[node]) {
      this.clearPick();
      this.previewOpts.onPick?.(null);
      return;
    }
    const info = NODES[node];
    const model = modelOf(node, this.view.facts);
    hit.obj.add(this.pickAnchor);
    this.pickAnchor.position.copy(hit.obj.worldToLocal(hit.at.clone()));
    this.pickOn = true;
    this.pickParts = new Set(partsOf(node));
    this.ptag.replaceChildren(h('span', info.name), ...(model ? [h('small', model)] : []));
    this.ptag.classList.add('on');
    this.applyFocus();
    this.previewOpts.onPick?.({ node, name: info.name, model });
  }

  private clearPick(): void {
    this.pickOn = false;
    this.pickParts = new Set();
    this.pickAnchor.removeFromParent();
    this.ptag.classList.remove('on');
    if (this.previewing) this.applyFocus();
  }

  private placePickTag(): void {
    if (!this.pickOn) return;
    const w = this.el.clientWidth;
    const hgt = this.el.clientHeight;
    const pv = this.pickAnchor.getWorldPosition(new T.Vector3()).project(this.camera);
    const tw = this.ptag.offsetWidth;
    const th = this.ptag.offsetHeight;
    const x = Math.max(6, Math.min(w - tw - 6, (pv.x * 0.5 + 0.5) * w - tw / 2));
    const y = Math.max(6, (-pv.y * 0.5 + 0.5) * hgt - th - 10);
    this.ptag.style.visibility = pv.z > 1 ? 'hidden' : 'visible';
    this.ptag.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }

  // ------------------------------------------------------------------ explore and picking

  private enterExplore(): void {
    if (!this.gl || !this.controls) return;
    this.exploring = true;
    this.selected = null;
    this.tw = null;
    this.el.classList.add('explore');
    this.controls.target.copy(this.look);
    this.controls.enabled = true;
    this.controls.update();
    this.showInfo(null);
    this.applyFocus();
    this.resize();
  }

  private exitExplore(): void {
    if (!this.exploring) return;
    this.exploring = false;
    this.selected = null;
    this.el.classList.remove('explore');
    if (this.controls) this.controls.enabled = false;
    this.applyFocus();
    this.resize();
    if (this.model) this.goCam(this.camVp ?? this.cardView, false);
  }

  private setShowAll(all: boolean): void {
    this.showAll = all;
    this.xall.setAttribute('aria-pressed', String(all));
    this.xfocus.setAttribute('aria-pressed', String(!all));
    this.applyFocus();
  }

  private showInfo(id: string | null): void {
    const n = id ? NODES[id] ?? NODES[previewNode(id)] : null;
    this.pname.textContent = n ? n.name : 'Tap a part';
    this.palias.textContent = n ? n.aliases : 'Drag to turn, pinch to zoom.';
    this.pdesc.textContent = n ? n.about : '';
  }

  private attachPicking(): void {
    const ray = new T.Raycaster();
    const ndc = new T.Vector2();
    let down: { x: number; y: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || !this.model) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 8) return;
      const r = this.canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const m = this.model;
      const hit = ray.intersectObjects([m.bike, m.standG], true).find((x) => {
        const p = m.parts.get(x.object.userData.partId);
        return p && p.vis > 0.3 && x.object.visible;
      });
      const id: string | null = hit ? hit.object.userData.partId : null;
      if (this.previewing) {
        this.pick(id && hit ? { id, obj: hit.object, at: hit.point } : null);
        return;
      }
      if (this.exploring) {
        this.selected = id;
        this.showInfo(id);
        this.applyFocus();
      } else {
        this.revealTags();
        const info = id ? NODES[id] ?? NODES[previewNode(id)] : undefined;
        if (info) {
          this.setNote(info.name);
          clearTimeout(this.noteTimer);
          this.noteTimer = window.setTimeout(() => this.setNote(), 3000);
        }
      }
    });
  }

  // ------------------------------------------------------------------ arrow and ghost

  private placeArrow(a: Frame['arrow']): void {
    // the arrow on barrel_adjuster sits on the barrel the facts pick
    const part = a ? turnPart(a.node, this.barrels) : '';
    const key = a ? `${part}|${a.dir}` : '';
    const m = this.model!;
    if (key === this.arrowKey) {
      if (a && this.arrow.visible) this.poseArrow(a);
      return;
    }
    this.arrowKey = key;
    if (!a || !m.has(part)) {
      this.arrow.visible = false;
      return;
    }
    const turn = m.turns.get(part);
    if (!turn) {
      this.arrow.visible = false;
      return;
    }
    const r = a.node === 'barrel_adjuster' ? 0.04 : 0.03;
    this.arrow.children.slice().forEach((c) => {
      this.arrow.remove(c);
      (c as T.Mesh).geometry.dispose();
    });
    const arc = new T.Mesh(new T.TorusGeometry(r, r * 0.16, 8, 32, Math.PI * 1.5), this.arrowMat);
    const cone = new T.Mesh(new T.ConeGeometry(r * 0.4, r * 0.8, 12), this.arrowMat);
    cone.position.set(0, -r, 0);
    cone.rotation.z = -HP;
    arc.renderOrder = cone.renderOrder = 10;
    this.arrow.add(arc, cone);
    this.arrow.visible = true;
    this.poseArrow(a);
  }

  /**
   * Puts the turn arrow on its screw, which may move with the derailleur's body. The ring sits
   * just off the head and turns counterclockwise about its normal; the normal points into the
   * thread when screwing in, so seen from the head it turns clockwise.
   */
  private poseArrow(a: NonNullable<Frame['arrow']>): void {
    const turn = this.model?.turns.get(turnPart(a.node, this.barrels));
    const orient = turn?.spin.parent;
    if (!turn || !orient) return;
    this.root.updateMatrixWorld(true);
    const head = orient.localToWorld(new T.Vector3(0, -(turn.len / 2 + 0.014), 0));
    const tip = orient.localToWorld(new T.Vector3(0, 1, 0));
    const base = orient.localToWorld(new T.Vector3(0, 0, 0));
    this.root.worldToLocal(head);
    this.root.worldToLocal(tip);
    this.root.worldToLocal(base);
    const ax = tip.sub(base).normalize();
    this.arrow.position.copy(head);
    this.arrow.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), a.dir > 0 ? ax : ax.negate());
  }

  private placeGhost(g: Frame['ghost']): void {
    const m = this.model!;
    this.ghost.visible = !!g && !this.exploring && !!m.cage;
    if (!this.ghost.visible || !g) return;
    this.ghostMat.color.copy(this.COL.accent);
    if (g.kind === 'align') {
      const L = m.layout(g.z, GAP_OK);
      this.ghostRing.visible = this.plumb.visible = true;
      this.gapBar.visible = false;
      this.ghostRing.position.set(L.gx, L.gy, g.z);
      // a line in the sprocket's plane from the axle to where the pulley belongs
      seg(this.plumb, new T.Vector3(m.spec.rx, m.spec.huby, g.z), new T.Vector3(L.gx, L.gy, g.z));
    } else {
      // the gap itself, between the largest sprocket and the upper pulley, beside them
      const B = m.spec;
      const n = B.n;
      const L = m.layout(B.zs[n - 1], this.gapNow);
      const d = Math.hypot(L.gx - B.rx, L.gy - B.huby) || 1;
      const ux = (L.gx - B.rx) / d;
      const uy = (L.gy - B.huby) / d;
      const r0 = B.rs[n - 1] + 0.0025;
      const r1 = Math.max(r0 + 0.002, d - RP - 0.003);
      const z = B.zs[n - 1] + 0.02;
      this.ghostRing.visible = this.plumb.visible = false;
      this.gapBar.visible = true;
      seg(this.gapBar, new T.Vector3(B.rx + ux * r0, B.huby + uy * r0, z), new T.Vector3(B.rx + ux * r1, B.huby + uy * r1, z));
    }
  }

  // ------------------------------------------------------------------ per frame

  private current(now: number): { play: Playing | null; t: number } {
    if (this.sol) {
      const s = this.sol;
      let p = s.list[s.i];
      const dur = p.anim?.duration ?? 3;
      if (now - s.t0 > dur) {
        s.i = (s.i + 1) % s.list.length;
        s.t0 = now;
        p = s.list[s.i];
        if (s.list.length > 1 && p.view && this.model) this.goCam(this.vpose(p.view), false);
      }
      if (this.heldT !== null) return { play: p, t: Math.min(Math.max(0, this.heldT), dur) };
      return { play: p, t: now - s.t0 };
    }
    const p = this.stepAnim;
    if (!p?.anim) return { play: p, t: 0 };
    const d = p.anim.duration;
    const t = this.heldT ?? now - this.t0;
    return { play: p, t: p.anim.once ? Math.min(Math.max(0, t), d) : ((t % d) + d) % d };
  }

  /**
   * For pictures and numbers (`npm run shots`): holds the step's clip, or a playing solution's first clip, at
   * t seconds, or lets it run again (null). While held, the derailleur jumps to its place and the crank, wheels,
   * sprockets and pulleys stand still at their start angle (also on a card without a clip), so the same card and
   * t give the same picture on every run.
   * Not used by the app.
   */
  holdClip(t: number | null): void {
    const s = this.sol;
    if (s && t !== null && s.i !== 0) {
      s.i = 0;
      const vn = s.list[0].view;
      if (vn && this.model) this.goCam(this.vpose(vn), false);
    }
    if (s && t === null && this.heldT !== null) s.t0 = nowS();
    this.heldT = t;
  }

  /** Whether a clip plays now (a step's clip or a solution): its parts move, so `framing` changes with it. */
  playing(): boolean {
    return !!(this.sol?.list.length ? this.sol.list.some((p) => p.anim) : this.stepAnim?.anim);
  }

  private applyPose(fr: Frame, dt: number): void {
    const m = this.model!;
    let vals: PoseVals;
    let shown: Pose;
    if (fr.pose) {
      vals = mixPose(poseVals(fr.pose.from, m.spec), poseVals(fr.pose.to, m.spec), fr.pose.k);
      shown = fr.pose.k < 0.5 ? fr.pose.from : fr.pose.to;
    } else {
      if (this.clipPosed) {
        // the clip that held the bike has stopped: ease back to the card's pose from where the bike is
        this.poseFrom = { ...this.poseNow };
        this.poseK = reduceMotion() ? 1 : 0;
      }
      this.poseK = Math.min(1, this.poseK + dt / 1.4);
      vals = mixPose(this.poseFrom, poseVals(this.poseTo, m.spec), ease(this.poseK));
      shown = this.poseK < 0.5 ? this.posePrev : this.poseTo;
    }
    this.clipPosed = !!fr.pose;
    this.poseNow = vals;
    this.placeWall(vals.wall);
    m.setSteer(vals.steer);
    for (const id of PARK_HIDES) {
      const p = m.parts.get(id);
      if (p) p.fade = 1 - vals.wall;
    }
    this.holder.position.set(vals.hx, vals.hy, 0);
    this.holder.rotation.set(0, 0, vals.hrz);
    this.root.position.set(vals.rx, vals.ry, vals.rz);
    this.root.rotation.set(vals.rrx, 0, 0);
    this.scene.updateMatrixWorld(true);
    this.standVis += ((this.frameGone ? 0 : 1) - this.standVis) * (1 - Math.exp(-dt * 6));
    const standOn = this.standVis > 0.01;
    this.standMat.opacity = this.standVis;
    this.standMat.transparent = this.standVis < 0.999;
    this.standMat.depthWrite = this.standVis > 0.98;
    m.standG.visible = shown === 'stand' && standOn;
    m.hookG.visible = shown === 'hung' && standOn;
    if (m.hookG.visible) {
      const at = this.root.localToWorld(m.hookPoint);
      const hook = m.hookG.getObjectByName('hook')!;
      hook.position.set(at.x, at.y + 0.05, at.z);
      seg(m.rope, new T.Vector3(at.x, at.y + 0.1, at.z), new T.Vector3(at.x, at.y + 3, at.z));
    }
  }

  /** The parked bike's wall, drawn as much as the pose says (0..1); built for this model the first time it is needed. */
  private placeWall(k: number): void {
    if (k > 0.001 && this.wall === undefined) {
      const line = wallFor(this.model!);
      this.wall = line ? buildWall(this.model!, line, this.wallMat) : null;
      if (this.wall) this.scene.add(this.wall);
    }
    if (!this.wall) return;
    this.wall.visible = k > 0.01;
    this.wallMat.opacity = k;
    this.wallMat.depthWrite = k > 0.98;
  }

  private applyNodeMotion(fr: Frame): void {
    const m = this.model!;
    const nm = fr.node;
    const now = new Set(nm?.parts ?? []);
    for (const id of this.moved) {
      if (now.has(id)) continue;
      const p = m.parts.get(id);
      if (p) {
        p.group.position.copy(p.basePos);
        p.group.rotation.set(0, 0, 0);
        p.group.scale.set(1, 1, 1);
        p.fade = 1;
      }
    }
    this.moved = now;
    if (!nm) return;
    for (const id of nm.parts) {
      const p = m.parts.get(id);
      if (!p) continue;
      // rotate and scale about the centre of the part (or the motion's pivot), then move
      placeMoved(nm, p.basePos, p.center, p.group.position, p.group.quaternion);
      p.group.scale.setScalar(nm.scale);
      p.fade = nm.fade;
    }
  }

  private colorParts(fr: Frame, dt: number): void {
    const m = this.model!;
    const f = 1 - Math.exp(-dt * 6);
    const COL = this.COL;
    const frameCol = m.spec.colour ? this.frameCol.set(m.spec.colour) : null;
    for (const p of m.parts.values()) {
      let hotT = p.hotT;
      let hotCol = COL.accent;
      const status = this.exploring ? undefined : partStatus(fr, p.id);
      if (status) {
        hotT = 1;
        hotCol = status === 'good' ? COL.good : COL.bad;
      }
      p.vis += (p.visT - p.vis) * f;
      p.hot += (hotT - p.hot) * f;
      const op = p.vis * p.fade;
      p.group.visible = op > 0.01;
      for (const mat of p.mats) {
        mat.opacity = op;
        mat.depthWrite = op > 0.98;
        if (mat.userData.dark) {
          mat.color.copy(COL.part).multiplyScalar(0.22);
          continue;
        }
        if (frameCol && mat.userData.tint === 'frame') this.tmpCol.copy(frameCol);
        else this.tmpCol.copy(COL.part).multiplyScalar(mat.userData.k);
        // highlighted: the highlight colour, but each piece keeps its own lighter or darker shade
        const hk = 0.62 + 0.38 * Math.min(1, mat.userData.k / 1.2);
        mat.color.copy(this.tmpCol).lerp(this.hotTmp.copy(hotCol).multiplyScalar(hk), p.hot);
        mat.emissive.copy(hotCol).multiplyScalar(p.hot * 0.06);
      }
      for (const lm of p.lines) {
        lm.opacity = op * 0.85;
        lm.visible = op > 0.05;
        lm.color.copy(COL.part).multiplyScalar(0.32).lerp(this.hotTmp.copy(hotCol).multiplyScalar(0.38), p.hot);
      }
    }
    const frame = m.parts.get('frame');
    m.drawDecal(this.view.bike ?? '', frameCol ?? COL.part, frame ? frame.vis : 1);
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const now = nowS();
    const dt = Math.min(0.05, now - this.last);
    this.last = now;
    if (!this.gl || !this.model) return;
    if (!this.el.isConnected) {
      if (this.exploring) this.exitExplore();
      return;
    }
    if (!this.el.clientWidth || !this.el.clientHeight) return;
    const m = this.model;
    const { play, t } = this.current(now);
    let fr: Frame = {};
    try {
      fr = play?.anim?.frame(t) ?? {};
    } catch (e) {
      this.warnOnce(`anim|${this.cardKey}`, `[stage] animation failed: ${String(e)}`);
    }

    // pose, then everything that moves on the bike
    this.applyPose(fr, dt);
    // A held clip (holdClip) is the same picture on every run: the derailleur sits where the frame
    // puts it, and the crank, the wheels, the sprockets and the pulleys stand at their start angle
    // instead of keeping what the cards before turned them to.
    const held = this.heldT !== null;
    const follow = held ? 1 : 1 - Math.exp(-dt * 7);
    if (fr.derZ !== undefined) this.derTarget = fr.derZ;
    else if (this.restZ !== undefined) this.derTarget = this.restZ;
    const derZ = m.derZ + (this.derTarget - m.derZ) * follow;
    this.gapNow += ((fr.gap ?? GAP_OK) - this.gapNow) * follow;
    const crank = fr.crankSpeed ?? 0;
    if (held) {
      this.crankAngle = 0;
      this.wheelAngle.rear_wheel = this.wheelAngle.front_wheel = 0;
      m.restSpin();
    } else {
      this.crankAngle += crank * dt;
      // a freewheel: the rear wheel only turns with the pedals going forward
      this.wheelAngle.rear_wheel += wheelStep(Math.max(0, crank) * m.spec.rc / m.rAtZ(derZ) + (fr.wheelSpeed?.rear_wheel ?? 0), dt);
      this.wheelAngle.front_wheel += wheelStep(fr.wheelSpeed?.front_wheel ?? 0, dt);
    }
    m.chainShift = -this.crankAngle * m.spec.rc;
    m.setDer(derZ, this.gapNow);
    m.setCrank(-this.crankAngle);
    m.rearHub.rotation.z = -this.wheelAngle.rear_wheel;
    m.frontHub.rotation.z = -this.wheelAngle.front_wheel;
    for (const [id, t] of m.turns) t.spin.rotation.y = fr.screws?.[turnKey(id, this.barrels) as ScrewNode] ?? 0;
    this.applyScene(fr.scene);
    const lever = m.parts.get('stand_clamp')?.group.userData.lever as T.Object3D | undefined;
    if (lever) lever.rotation.z = fr.lever ?? 0;
    this.applyNodeMotion(fr);
    this.contours?.update(this.exploring ? undefined : fr.contour, dt, this.COL.contour);

    this.placeGhost(this.exploring ? undefined : fr.ghost);
    this.placeArrow(this.exploring ? undefined : fr.arrow);
    if (this.arrow.visible) {
      this.arrowMat.color.copy(this.COL.accent);
      this.arrowMat.opacity = 0.7 + 0.3 * Math.sin(now * 4);
    }

    const cap = !this.exploring && play ? play.caption : '';
    if (cap !== this.lastCap) {
      this.capEl.textContent = cap;
      this.capEl.classList.toggle('on', !!cap);
      // a caption longer than a line wraps (the barrel tour explains where to look)
      this.capEl.classList.toggle('long', cap.length > 48);
      this.lastCap = cap;
    }

    // camera
    const cam = this.camera;
    if ((this.exploring || this.previewing) && this.controls) {
      this.controls.update();
      this.look.copy(this.controls.target);
    } else if (fr.cam) {
      // a clip moves the camera (bike space): followed smoothly, so its start and the jump of a replay ease in
      const p = this.root.localToWorld(new T.Vector3(...fr.cam.p));
      const tt = this.root.localToWorld(new T.Vector3(...fr.cam.t));
      const k = reduceMotion() || this.heldT !== null ? 1 : 1 - Math.exp(-dt * 5);
      cam.position.lerp(p, k);
      this.look.lerp(tt, k);
      cam.lookAt(this.look);
      this.clipCam = true;
    } else if (this.tw) {
      if (this.clipCam) {
        // the clip that moved the camera has ended: back to the card's view from where the camera is
        this.clipCam = false;
        this.tw = { p0: cam.position.clone(), t0: this.look.clone(), vp: this.tw.vp, k: 0, dur: 1.2 };
      }
      const d = this.camDest(this.tw.vp);
      if (this.tw.k < 1) {
        this.tw.k = Math.min(1, this.tw.k + dt / this.tw.dur);
        const e = ease(this.tw.k);
        cam.position.lerpVectors(this.tw.p0, d.p, e);
        cam.position.y += Math.sin(Math.PI * e) * 0.35;
        this.look.lerpVectors(this.tw.t0, d.t, e);
      } else {
        cam.position.copy(d.p);
        this.look.copy(d.t);
      }
      cam.lookAt(this.look);
    } else cam.lookAt(this.look);

    this.colorParts(fr, dt);

    if (this.previewing) this.placePickTag();
    else if (!this.exploring) {
      const w = this.el.clientWidth;
      const hgt = this.el.clientHeight;
      const pv = new T.Vector3();
      // Each tag sits above its anchor. Close views bring anchors together, so a tag that would
      // cover one already placed (lowest first) moves up above it.
      const placed: Array<{ l: number; r: number; t: number; b: number }> = [];
      const items = this.tagList.map((tg) => {
        tg.obj.getWorldPosition(pv);
        pv.project(cam);
        if (!tg.w) {
          tg.w = tg.el.offsetWidth;
          tg.h = tg.el.offsetHeight;
        }
        return { tg, x: (pv.x * 0.5 + 0.5) * w, y: (-pv.y * 0.5 + 0.5) * hgt, z: pv.z };
      }).sort((a, b) => b.y - a.y);
      for (const { tg, x, y, z } of items) {
        const gone = !tg.parts.some((p) => p.vis * p.fade > 0.05);
        const off = gone || z > 1 || x < 12 || x > w - 12 || y < 24 || y > hgt - 12;
        tg.el.style.visibility = off ? 'hidden' : 'visible';
        if (off) continue;
        const tw = tg.w ?? 0;
        const th = tg.h ?? 0;
        const box = { l: x - tw / 2, r: x + tw / 2, t: y - th * 1.5, b: y - th * 0.5 };
        for (let moved = true, n = 0; moved && n < 8; n++) {
          moved = false;
          for (const o of placed) {
            if (box.l < o.r + 2 && box.r > o.l - 2 && box.t < o.b + 2 && box.b > o.t - 2) {
              box.b = o.t - 2;
              box.t = box.b - th;
              moved = true;
            }
          }
        }
        placed.push(box);
        tg.el.style.transform = `translate(${box.l.toFixed(1)}px,${box.t.toFixed(1)}px)`;
      }
    }
    this.gl.render(this.scene, cam);
  };
}
