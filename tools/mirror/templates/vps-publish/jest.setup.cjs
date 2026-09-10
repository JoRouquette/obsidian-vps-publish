// Le code du plugin utilise `window.setTimeout` / `window.setInterval`, comme
// l'exigent les guidelines Obsidian (compatibilité des fenêtres popout).
//
// Les tests unitaires tournent en `testEnvironment: 'node'`, où `window`
// n'existe pas. On l'alias sur `globalThis` : les timers résolus sont ceux de
// Node, le comportement testé est identique, et le code de production n'est pas
// altéré pour les besoins du test.
//
// Les suites qui ont besoin d'un vrai DOM déclarent `@jest-environment jsdom`
// en tête de fichier ; ce shim est alors sans effet (`window` existe déjà).
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

// Obsidian expose `activeWindow` / `activeDocument`, qui pointent sur la fenêtre
// popout courante. Les guidelines imposent de les préférer à `window`/`document`.
// Hors d'Obsidian, on les fait retomber sur les globals standards.
if (typeof globalThis.activeWindow === 'undefined') {
  globalThis.activeWindow = globalThis.window;
}
if (typeof globalThis.activeDocument === 'undefined' && typeof globalThis.document !== 'undefined') {
  globalThis.activeDocument = globalThis.document;
}

// Obsidian expose aussi des fabriques d'éléments globales (`createDiv`,
// `createSpan`, `createEl`) que les guidelines imposent de préférer à
// `document.createElement`. Elles n'existent ni sous 'node' ni sous jsdom :
// on fournit des équivalents minimaux pour les tests.
if (typeof globalThis.document !== 'undefined' && typeof globalThis.createEl === 'undefined') {
  const createEl = (tag, options = {}) => {
    const el = globalThis.document.createElement(tag);
    if (options.cls)
      el.className = Array.isArray(options.cls) ? options.cls.join(' ') : options.cls;
    if (options.text) el.textContent = options.text;
    if (options.attr) {
      for (const [key, value] of Object.entries(options.attr)) el.setAttribute(key, String(value));
    }
    return el;
  };

  globalThis.createEl = createEl;
  globalThis.createDiv = (options) => createEl('div', options);
  globalThis.createSpan = (options) => createEl('span', options);
}
