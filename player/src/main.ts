// Starts the player: loads the content bundle, the stored bikes and the stage, then renders.

import { loadBundle } from './engine/content.js';
import { browserKV, Store } from './engine/store.js';
import { App } from './ui/app.js';
import { h } from './ui/dom.js';
import { ThreeStage } from './stage/three-stage.js';
import { PlaceholderStage, type Stage } from './ui/stage.js';

async function boot(): Promise<void> {
  const root = document.getElementById('root')!;
  try {
    const content = await loadBundle();
    const store = new Store(browserKV(), content.bundle.demo_bikes ?? []);
    let stage: Stage;
    try {
      stage = new ThreeStage();
    } catch (e) {
      console.warn('[stage] The 3D view could not start; using the text stage.', e);
      stage = new PlaceholderStage();
    }
    const app = new App(content, store, root, stage);
    (window as any).__app = app;
    app.render();
  } catch (e) {
    root.replaceChildren(h('section.screen', h('div.scroll',
      h('h1.h1', 'Could not start'),
      h('p.lead', String((e as Error)?.message ?? e)),
      h('button.btn.primary', { onclick: () => location.reload() }, 'Try again'),
    )));
  }
}

boot();
