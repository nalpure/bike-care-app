// Starts the player: loads the content bundle, the stored bikes and the stage, then renders.

import { loadBundle } from './engine/content.js';
import { browserKV, Store } from './engine/store.js';
import { App } from './ui/app.js';
import { h } from './ui/dom.js';
import { PlaceholderStage } from './ui/stage.js';

async function boot(): Promise<void> {
  const root = document.getElementById('root')!;
  try {
    const content = await loadBundle();
    const store = new Store(browserKV());
    const app = new App(content, store, root, new PlaceholderStage());
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
