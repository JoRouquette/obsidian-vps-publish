/**
 * Mock for Obsidian API (Jest)
 *
 * This mock provides minimal implementations of Obsidian classes
 * needed for testing without importing the actual obsidian package.
 */

export class Component {
  load() {}
  onload() {}
  unload() {}
  onunload() {}
  register(_cb: () => void) {}
  registerEvent() {}
  registerDomEvent() {}
  registerInterval() {}
  addChild() {}
  removeChild() {}
}

export class MarkdownRenderer {
  static async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: Component | null
  ): Promise<void> {
    // Mock implementation: just set innerHTML
    el.innerHTML = markdown;
  }

  static renderMarkdown(
    markdown: string,
    el: HTMLElement,
    sourcePath: string,
    component: Component
  ): Promise<void> {
    return this.render(null, markdown, el, sourcePath, component);
  }
}

export interface App {
  workspace: unknown;
  vault: unknown;
  metadataCache: unknown;
}

/**
 * `Platform.isDesktop` garde le chargement différé des modules Node dans
 * `DataviewExecutor`. On le fixe à `true` : les suites tournent sur le poste de
 * développement et doivent exercer le même chemin qu'en production desktop —
 * le plugin déclare `isDesktopOnly`.
 */
export const Platform = {
  isDesktop: true,
  isDesktopApp: true,
  isMobile: false,
  isMobileApp: false,
};
