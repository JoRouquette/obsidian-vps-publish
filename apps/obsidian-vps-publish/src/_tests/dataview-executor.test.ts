/**
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type Component, Component as ObsidianComponent, MarkdownRenderer } from 'obsidian';

import {
  activeShimLeaseCount,
  type DataviewApi,
  DataviewExecutor,
  type DataviewExecutorOptions,
} from '../lib/dataview/dataview-executor';
import { activeRenderTrackerCount } from '../lib/dataview/dataview-render-tracker';

describe('DataviewExecutor', () => {
  const originalGlobalRequire = global.require;
  const originalWindowRequire = (window as Window & { require?: NodeRequire }).require;

  afterEach(() => {
    global.require = originalGlobalRequire;
    (window as Window & { require?: NodeRequire }).require = originalWindowRequire;
  });

  it('supports legacy vault-root require paths during DataviewJS execution', async () => {
    const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-vps-publish-dv-'));
    const helperDir = path.join(tempVault, '_assets', '_views', 'helpers');
    fs.mkdirSync(helperDir, { recursive: true });
    fs.writeFileSync(
      path.join(helperDir, 'normType.js'),
      'exports.normType = (value) => String(value ?? "").trim().toLowerCase();',
      'utf8'
    );

    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        const moduleExports = (window as Window & { require: NodeRequire }).require(
          '//_assets/_views/helpers/normType.js'
        ) as { normType: (value: string) => string };
        container.textContent = moduleExports.normType('NPC');
      }),
    };

    global.require = require;
    (window as Window & { require?: NodeRequire }).require = require;

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: {
        getActiveFile: () => null,
      },
      vault: {
        adapter: {
          getBasePath: () => tempVault,
        },
      },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'await dv.view("_assets/_views/geo/influences")',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'Some Note.md'
    );

    expect(result.success).toBe(true);
    expect('container' in result && result.container?.textContent).toBe('npc');
    expect(global.require).toBe(require);
    expect((window as Window & { require?: NodeRequire }).require).toBe(require);
  });

  it('resolves vault-root require from vault root even when note is in a subfolder', async () => {
    // Regression guard: path must resolve to vault_root/_assets/..., NOT note_folder/_assets/...
    // Before the fix, passing './_assets/...' to createRequire would resolve relative to
    // some internal anchor that could end up being the note's directory.
    const tempVault = fs.mkdtempSync(path.join(os.tmpdir(), 'obsidian-vps-publish-dv-'));
    const helperDir = path.join(tempVault, '_assets', '_views', 'helpers');
    fs.mkdirSync(helperDir, { recursive: true });
    fs.writeFileSync(
      path.join(helperDir, 'marker.js'),
      'exports.value = "resolved-from-vault-root";',
      'utf8'
    );

    // Note is in a subfolder: 'Ektaron/Ektaron.md' — simulates the geo-tree scenario
    // where the view lives at vault root but the note is in a sub-directory.
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        const m = (window as Window & { require: NodeRequire }).require(
          '//_assets/_views/helpers/marker.js'
        ) as { value: string };
        container.textContent = m.value;
      }),
    };

    global.require = require;
    (window as Window & { require?: NodeRequire }).require = require;

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
      vault: { adapter: { getBasePath: () => tempVault } },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      // Note in a subfolder — this must NOT affect the require resolution base
      'Ektaron/Ektaron.md'
    );

    expect(result.success).toBe(true);
    expect('container' in result && result.container?.textContent).toBe('resolved-from-vault-root');
  });

  it('shims getResourcePath to return vault-relative paths during DataviewJS execution', async () => {
    // Shared adapter object — the shim patches this in-place, so the executeJs mock
    // sees the shimmed version when it accesses adapter.getResourcePath (like geo-tree.js
    // accesses app.vault.adapter.getResourcePath).
    const adapter = {
      getResourcePath: jest.fn((resourcePath: string) => `app://local/${resourcePath}`),
    };

    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        const img = document.createElement('img');
        // Simulate geo-tree.js: img.src = app.vault.adapter.getResourcePath(iconPath)
        img.src = adapter.getResourcePath('_assets/_icones/Continent.ico');
        container.appendChild(img);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
      vault: { adapter },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'dv.el("div", "test")',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(result.success).toBe(true);
    const container = 'container' in result ? result.container : null;
    // The img src must be the vault-relative path, not the app:// URL,
    // so that DetectAssetsService can detect and upload the icon.
    expect(container?.querySelector('img')?.getAttribute('src')).toBe(
      '_assets/_icones/Continent.ico'
    );
    // After execution the original implementation must be restored
    expect(adapter.getResourcePath('_assets/_icones/Nation.ico')).toBe(
      'app://local/_assets/_icones/Nation.ico'
    );
  });

  it('restores getResourcePath even when DataviewJS execution fails', async () => {
    const adapter = {
      getResourcePath: jest.fn((resourcePath: string) => `app://local/${resourcePath}`),
    };

    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async () => {
        throw new Error('render failure');
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
      vault: { adapter },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'dv.el("div", "test")',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(result.success).toBe(false);
    // Original implementation must be restored even on failure
    expect(adapter.getResourcePath('_assets/_icones/Continent.ico')).toBe(
      'app://local/_assets/_icones/Continent.ico'
    );
  });

  it('restores require even when DataviewJS execution fails', async () => {
    global.require = require;
    (window as Window & { require?: NodeRequire }).require = require;

    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async () => {
        throw new Error('boom');
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: {
        getActiveFile: () => null,
      },
      vault: {
        adapter: {
          getBasePath: () => os.tmpdir(),
        },
      },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'await dv.view("_assets/_views/geo/influences")',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'Some Note.md'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(global.require).toBe(require);
    expect((window as Window & { require?: NodeRequire }).require).toBe(require);
  });

  it('force-expands lazy details nodes so nested content is captured for publishing', async () => {
    // Simulate a view that uses createLazyDetails() (like geo-tree.js).
    // Outer node is open={true}, inner nodes are created lazily inside the contentBuilder.
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        // --- Outer lazy details (open by default, like the continents group) ---
        const outerDetails = document.createElement('details');
        outerDetails.open = true;

        const outerSummary = document.createElement('summary');
        outerSummary.textContent = 'Continents (2)';
        outerDetails.appendChild(outerSummary);

        const outerContent = document.createElement('div');
        outerDetails.appendChild(outerContent);

        const ensureOuterLoaded = () => {
          if (outerDetails.dataset.loaded === 'true') return;
          // Each continent creates another lazy details node (not open by default)
          for (const name of ['Aegasos', 'Yalgranthir']) {
            const inner = document.createElement('details');
            // NOT open by default

            const innerSummary = document.createElement('summary');
            innerSummary.textContent = name;
            inner.appendChild(innerSummary);

            const innerContent = document.createElement('div');
            inner.appendChild(innerContent);

            const ensureInnerLoaded = () => {
              if (inner.dataset.loaded === 'true') return;
              innerContent.textContent = `Nations of ${name}`;
              inner.dataset.loaded = 'true';
            };
            inner.addEventListener('toggle', () => {
              if (inner.open) ensureInnerLoaded();
            });
            if (inner.open) ensureInnerLoaded();

            outerContent.appendChild(inner);
          }
          outerDetails.dataset.loaded = 'true';
        };

        outerDetails.addEventListener('toggle', () => {
          if (outerDetails.open) ensureOuterLoaded();
        });
        if (outerDetails.open) ensureOuterLoaded();

        container.appendChild(outerDetails);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(result.success).toBe(true);
    const captured = 'container' in result ? result.container : null;

    // All lazy details must be expanded and their content populated
    const allDetails = captured?.querySelectorAll('details') ?? [];
    for (const el of Array.from(allDetails)) {
      expect(el.getAttribute('data-loaded')).toBe('true');
    }

    // Inner nation text must be present in the serialized DOM
    expect(captured?.innerHTML).toContain('Nations of Aegasos');
    expect(captured?.innerHTML).toContain('Nations of Yalgranthir');
  });

  it('waits for a mutation that lands after executeJs() returns, instead of capturing the container too early', async () => {
    // Mirrors what Dataview's own executeJs() really does: the renderer's onload() calls
    // render() without awaiting it (fire-and-forget), so our executeJs() mock can resolve
    // before that render() has finished its own async work. The content below lands via a
    // setTimeout fired AFTER the mock resolves, simulating render()'s continuation after an
    // internal await (e.g. dv.view() or async Markdown rendering) -- it must still be in the
    // captured container, not missed because we stopped watching too soon.
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container, component) => {
        component.addChild({ unload: jest.fn() } as unknown as Component);
        setTimeout(() => {
          const span = document.createElement('span');
          span.textContent = 'rendered-late';
          container.appendChild(span);
        }, 150);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(result.success).toBe(true);
    const captured = 'container' in result ? result.container : null;
    expect(captured?.querySelector('span')?.textContent).toBe('rendered-late');
    // Exactly one span: waiting for quiescence must not re-run the script, so there is
    // no second, overlapping render that could duplicate this content.
    expect(captured?.querySelectorAll('span').length).toBe(1);
  });

  it('resolves quickly for a purely synchronous view, instead of always waiting the full cap', async () => {
    // Mirrors the common case: a dataviewjs script (dv.table()/dv.list()/dv.pages()) that
    // renders entirely within onload()'s synchronous call stack, with no further await of
    // its own. All DOM mutations happen before executeJs() itself returns.
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container, component) => {
        component.addChild({ unload: jest.fn() } as unknown as Component);
        const span = document.createElement('span');
        span.textContent = 'sync-rendered';
        container.appendChild(span);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const startedAt = Date.now();
    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );
    const elapsedMs = Date.now() - startedAt;

    expect(result.success).toBe(true);
    const captured = 'container' in result ? result.container : null;
    expect(captured?.querySelector('span')?.textContent).toBe('sync-rendered');
    // Must resolve shortly after the mutation (quietMs), not wait out the full maxWaitMs
    // (2000ms) hard cap that only a never-settling view should ever hit.
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('unloads every renderer captured via addChild, so their refresh listeners and DOM watchers do not leak on republish', async () => {
    const firstUnload = jest.fn();
    const secondUnload = jest.fn();

    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, _container, component) => {
        component.addChild({ unload: firstUnload } as unknown as Component);
        component.addChild({ unload: secondUnload } as unknown as Component);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(firstUnload).toHaveBeenCalledTimes(1);
    expect(secondUnload).toHaveBeenCalledTimes(1);
  });

  it('still discharges every other renderer and restores shims/cache when one unload() throws', async () => {
    const throwingUnload = jest.fn(() => {
      throw new Error('boom');
    });
    const okUnload = jest.fn();

    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, _container, component) => {
        component.addChild({ unload: throwingUnload } as unknown as Component);
        component.addChild({ unload: okUnload } as unknown as Component);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(throwingUnload).toHaveBeenCalledTimes(1);
    // The renderer after the throwing one must still be discharged, and the block must
    // still report success -- a third-party unload() failure must not abort cleanup.
    expect(okUnload).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('captures the rendered DOM before unloading renderers whose unload() empties the container', async () => {
    // Mirrors Dataview 0.5.68: dv.list()/dv.table() append a sub-container and register a
    // ReactRenderer child whose onunload() unmounts its Preact tree (`render(null, el)`),
    // which empties that sub-container. Unloading before capturing published an empty block.
    const unloadOrder: string[] = [];
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container, component) => {
        const subcontainer = document.createElement('div');
        const list = document.createElement('ul');
        const item = document.createElement('li');
        item.textContent = 'Kaela';
        list.appendChild(item);
        subcontainer.appendChild(list);
        container.appendChild(subcontainer);
        component.addChild({
          unload: () => {
            unloadOrder.push('unload');
            subcontainer.replaceChildren();
          },
        } as unknown as Component);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(result.success).toBe(true);
    // The renderer is still discharged (no listener leak)...
    expect(unloadOrder).toEqual(['unload']);
    // ...but only after the DOM was captured.
    const captured = 'container' in result ? result.container : null;
    expect(captured?.querySelector('li')?.textContent).toBe('Kaela');
  });

  it('still unloads captured renderers when the DataviewJS execution fails', async () => {
    const unload = jest.fn();
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, _container, component) => {
        component.addChild({ unload } as unknown as Component);
        throw new Error('view failed');
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );

    expect(result.success).toBe(false);
    expect(unload).toHaveBeenCalledTimes(1);
  });

  it('does not hang when a view never settles, thanks to the hard cap on waiting for DOM quiescence', async () => {
    const dataviewApi: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        // Keeps mutating forever, faster than the quiet window ever needed to resolve --
        // only the hard cap can end the wait.
        const interval = setInterval(() => {
          container.appendChild(document.createElement('span'));
        }, 20);
        setTimeout(() => clearInterval(interval), 2500);
      }),
    };

    const executor = new DataviewExecutor(dataviewApi, {
      workspace: { getActiveFile: () => null },
    });

    const start = Date.now();
    const result = await executor.executeBlock(
      {
        kind: 'js',
        contentRaw: 'test',
        langRaw: 'dataviewjs',
        startIndex: 0,
        endIndex: 0,
        startLine: 1,
        endLine: 1,
      },
      'World/Ektaron.md'
    );
    const elapsedMs = Date.now() - start;

    expect(result.success).toBe(true);
    expect(elapsedMs).toBeLessThan(3000);
  }, 10000);
});

describe('DataviewExecutor with a Dataview-like renderer', () => {
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const jsBlock = {
    kind: 'js' as const,
    contentRaw: 'test',
    langRaw: 'dataviewjs',
    startIndex: 0,
    endIndex: 0,
    startLine: 1,
    endLine: 1,
  };

  /**
   * Mirrors Dataview 0.5.68: the renderer is a Component bound to the container, its onload()
   * calls render() without awaiting it, and executeJs() does load() then addChild().
   */
  class FakeDataviewRenderer extends ObsidianComponent {
    constructor(
      readonly container: HTMLElement,
      private readonly script: (container: HTMLElement) => Promise<void>,
      // The real DataviewJSRenderer.render() catches the view's error and renders an error
      // block, so its promise never rejects; a rejecting variant is kept as defence in depth.
      private readonly catchErrors = true
    ) {
      super();
    }

    onload(): void {
      void this.render();
    }

    async render(): Promise<void> {
      // Dataview resets the container first: a first mutation that carries no content.
      const marker = document.createElement('i');
      this.container.appendChild(marker);
      marker.remove();
      if (!this.catchErrors) {
        await this.script(this.container);
        return;
      }
      try {
        await this.script(this.container);
      } catch (error) {
        const pre = document.createElement('pre');
        pre.className = 'dataview-error';
        pre.textContent = error instanceof Error ? error.message : String(error);
        this.container.appendChild(pre);
      }
    }
  }

  function apiRunning(
    script: (container: HTMLElement) => Promise<void>,
    catchErrors = true
  ): DataviewApi {
    return {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container, component) => {
        const renderer = new FakeDataviewRenderer(container, script, catchErrors);
        renderer.load();
        component.addChild(renderer as unknown as Component);
      }),
    };
  }

  function executorFor(api: DataviewApi, options?: DataviewExecutorOptions): DataviewExecutor {
    return new DataviewExecutor(api, { workspace: { getActiveFile: () => null } }, options);
  }

  const capturedOf = (result: unknown): HTMLElement | null =>
    result !== null && typeof result === 'object' && 'container' in result
      ? ((result as { container: HTMLElement }).container ?? null)
      : null;

  beforeEach(() => {
    // The shared mock's load() is a no-op; real Obsidian's Component.load() runs onload().
    jest.spyOn(ObsidianComponent.prototype, 'load').mockImplementation(function (
      this: ObsidianComponent
    ) {
      this.onload();
    });
  });

  afterEach(() => {
    // Spies go first: a failing assertion below must not leave them in place for the next test.
    jest.restoreAllMocks();
    // Module-level state must be back to rest, or the next test would fail for a reason
    // that has nothing to do with it.
    expect(activeShimLeaseCount()).toBe(0);
    expect(activeRenderTrackerCount()).toBe(0);
  });

  it('keeps the content of a view whose first mutation is empty and whose content lands after the quiet window', async () => {
    const api = apiRunning(async (container) => {
      await sleep(300);
      const span = document.createElement('span');
      span.textContent = 'late-view';
      container.appendChild(span);
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(result.success).toBe(true);
    const captured = 'container' in result ? result.container : null;
    expect(captured?.querySelectorAll('span').length).toBe(1);
    expect(captured?.querySelector('span')?.textContent).toBe('late-view');
  });

  it('waits for MarkdownRenderer.render() calls that the view does not await', async () => {
    jest
      .spyOn(MarkdownRenderer, 'render')
      .mockImplementation(async (_app, markdown, el: HTMLElement) => {
        await sleep(300);
        el.textContent = markdown;
      });
    const api = apiRunning(async (container) => {
      const span = container.appendChild(document.createElement('span'));
      void MarkdownRenderer.render(null as never, 'rendered-markdown', span, '', null as never);
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    const captured = 'container' in result ? result.container : null;
    expect(captured?.querySelector('span')?.textContent).toBe('rendered-markdown');
  });

  it('captures a purely synchronous view after the short quiet tail, not the safety cap', async () => {
    const api = apiRunning(async (container) => {
      container.appendChild(Object.assign(document.createElement('span'), { textContent: 'sync' }));
    });

    const startedAt = Date.now();
    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');
    const elapsedMs = Date.now() - startedAt;

    const captured = 'container' in result ? result.container : null;
    expect(captured?.querySelector('span')?.textContent).toBe('sync');
    // The quiet tail is ~150 ms; the safety cap is 10 s.
    expect(elapsedMs).toBeLessThan(1500);
  });

  it('stops waiting after the safety cap, keeps what the view rendered and logs a warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loadBefore = ObsidianComponent.prototype.load;
    const api = apiRunning((container) => {
      container.appendChild(
        Object.assign(document.createElement('span'), { textContent: 'partial' })
      );
      return new Promise<void>(() => {});
    });

    const startedAt = Date.now();
    const result = await executorFor(api, { renderSettleMaxMs: 200 }).executeBlock(
      jsBlock,
      'World/Ektaron.md'
    );
    const elapsedMs = Date.now() - startedAt;

    expect(result.success).toBe(true);
    expect(elapsedMs).toBeGreaterThanOrEqual(180);
    expect(elapsedMs).toBeLessThan(2000);
    expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('partial');
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/still rendering after 200 ms \(World\/Ektaron\.md\)/)
    );
    expect(ObsidianComponent.prototype.load).toBe(loadBefore);
  });

  it('waits for Markdown rendered through the deprecated renderMarkdown() (table and task cells)', async () => {
    jest
      .spyOn(MarkdownRenderer, 'renderMarkdown')
      .mockImplementation(async (markdown: string, el: HTMLElement) => {
        await sleep(300);
        el.textContent = markdown;
      });
    const api = apiRunning(async (container) => {
      const cell = container.appendChild(document.createElement('td'));
      void MarkdownRenderer.renderMarkdown('cell-markdown', cell, '', null as never);
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(capturedOf(result)?.querySelector('td')?.textContent).toBe('cell-markdown');
  });

  it('waits for a render the view starts after an await of its own', async () => {
    jest
      .spyOn(MarkdownRenderer, 'render')
      .mockImplementation(async (_app, markdown, el: HTMLElement) => {
        await sleep(300);
        el.textContent = markdown;
      });
    const api = apiRunning(async (container) => {
      await sleep(50);
      const span = container.appendChild(document.createElement('span'));
      void MarkdownRenderer.render(null as never, 'chained', span, '', null as never);
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('chained');
  });

  it('keeps a view whose render() rejects after a partial render, without failing the block', async () => {
    const api = apiRunning(async (container) => {
      container.appendChild(
        Object.assign(document.createElement('span'), { textContent: 'before' })
      );
      await sleep(30);
      throw new Error('view failed');
    }, false);

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(result.success).toBe(true);
    expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('before');
  });

  it('publishes the error block Dataview renders when a view throws (render() catches it)', async () => {
    const api = apiRunning(async () => {
      throw new Error('view failed');
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(result.success).toBe(true);
    expect(capturedOf(result)?.querySelector('pre.dataview-error')?.textContent).toBe(
      'view failed'
    );
  });

  it('waits for Markdown started by a Preact-style effect after render() resolved (dv.table/dv.list cells)', async () => {
    jest
      .spyOn(MarkdownRenderer, 'renderMarkdown')
      .mockImplementation(async (markdown: string, el: HTMLElement) => {
        await sleep(200);
        el.textContent = markdown;
      });
    const api = apiRunning(async (container) => {
      // Mounted synchronously, empty; the cell is rendered from an effect ~100 ms later.
      const cell = container.appendChild(document.createElement('td'));
      window.setTimeout(() => {
        void MarkdownRenderer.renderMarkdown('cell-from-effect', cell, '', null as never);
      }, 60);
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(capturedOf(result)?.querySelector('td')?.textContent).toBe('cell-from-effect');
  });

  it('keeps DOM changes a view makes by timer just after its render() resolved', async () => {
    const api = apiRunning(async (container) => {
      window.setTimeout(() => {
        container.appendChild(
          Object.assign(document.createElement('span'), { textContent: 'timer' })
        );
      }, 10);
    });

    const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('timer');
  });

  it('does not wait for Markdown rendered elsewhere in the live document', async () => {
    jest.spyOn(MarkdownRenderer, 'render').mockImplementation(async () => {
      await sleep(3000);
    });
    const uiElement = document.body.appendChild(document.createElement('div'));
    try {
      const api = apiRunning(async (container) => {
        void MarkdownRenderer.render(null as never, 'ui', uiElement, '', null as never);
        container.appendChild(
          Object.assign(document.createElement('span'), { textContent: 'view' })
        );
      });

      const startedAt = Date.now();
      const result = await executorFor(api, { renderSettleMaxMs: 5000 }).executeBlock(
        jsBlock,
        'World/Ektaron.md'
      );

      expect(Date.now() - startedAt).toBeLessThan(1500);
      expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('view');
    } finally {
      uiElement.remove();
    }
  });

  it('isolates concurrent executions: a fast view is not held back by a slow one, and globals are restored once, by the last', async () => {
    const adapter = {
      getResourcePath: jest.fn((resourcePath: string) => `app://local/${resourcePath}`),
      getBasePath: () => os.tmpdir(),
    };
    const originalGetResourcePath = adapter.getResourcePath;
    const stableCache = new Map<unknown, unknown>([['hash', '<p>cached</p>']]);
    (window as unknown as Record<string, unknown>)['__stableRenderCache'] = stableCache;
    const loadBefore = ObsidianComponent.prototype.load;
    const globalRequireBefore = global.require;
    const windowRequireBefore = (window as Window & { require?: NodeRequire }).require;
    global.require = require;
    (window as Window & { require?: NodeRequire }).require = require;

    const executor = new DataviewExecutor(
      {
        query: jest.fn(),
        executeJs: jest.fn(async (code: string, container: HTMLElement, component: Component) => {
          const renderer = new FakeDataviewRenderer(container, async (el) => {
            await sleep(code === 'slow' ? 1500 : 20);
            el.appendChild(Object.assign(document.createElement('span'), { textContent: code }));
          });
          renderer.load();
          component.addChild(renderer as unknown as Component);
        }),
      },
      { workspace: { getActiveFile: () => null }, vault: { adapter } }
    );

    try {
      const startedAt = Date.now();
      let fastDoneAt = 0;
      let shimsWhenFastDone: [unknown, unknown] = [null, null];
      const slow = executor.executeBlock({ ...jsBlock, contentRaw: 'slow' }, 'A.md');
      const fast = executor
        .executeBlock({ ...jsBlock, contentRaw: 'fast' }, 'B.md')
        .then((result) => {
          fastDoneAt = Date.now() - startedAt;
          shimsWhenFastDone = [
            adapter.getResourcePath,
            (window as Window & { require?: NodeRequire }).require,
          ];
          return result;
        });
      const [slowResult, fastResult] = await Promise.all([slow, fast]);

      // The slow one was still running when the fast one finished: the shims were in place.
      expect(shimsWhenFastDone[0]).not.toBe(originalGetResourcePath);
      expect(shimsWhenFastDone[1]).not.toBe(require);
      expect(fastDoneAt).toBeLessThan(1000);
      expect(capturedOf(fastResult)?.textContent).toBe('fast');
      expect(capturedOf(slowResult)?.textContent).toBe('slow');
      expect(adapter.getResourcePath).toBe(originalGetResourcePath);
      expect((window as Window & { require?: NodeRequire }).require).toBe(require);
      expect(global.require).toBe(require);
      expect([...stableCache.entries()]).toEqual([['hash', '<p>cached</p>']]);
      expect(ObsidianComponent.prototype.load).toBe(loadBefore);
    } finally {
      delete (window as unknown as Record<string, unknown>)['__stableRenderCache'];
      global.require = globalRequireBefore;
      (window as Window & { require?: NodeRequire }).require = windowRequireBefore;
    }
  });

  it('stops observing the DOM once a captured view has settled', async () => {
    const observe = jest.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = jest.spyOn(MutationObserver.prototype, 'disconnect');
    const api = apiRunning(async (container) => {
      await sleep(20);
      container.appendChild(document.createElement('span'));
    });

    await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

    // Every observer put on the view's container is released, whatever their number.
    const ofContainer = observe.mock.calls
      .map(([target], index) => ({ target, observer: observe.mock.contexts[index] }))
      .filter(({ target }) => (target as HTMLElement).classList?.contains('dv-js-container'));
    expect(ofContainer.length).toBeGreaterThan(0);
    for (const { observer } of ofContainer) {
      expect(disconnect.mock.contexts).toContain(observer);
    }
  });

  it('keeps tracking, run after run, when another wrapper sits on top of the hook', async () => {
    const loadBefore = ObsidianComponent.prototype.load;
    let foreignCalls = 0;
    let foreignInstalled = false;
    const api = apiRunning(async (container) => {
      if (!foreignInstalled) {
        foreignInstalled = true;
        const current = ObsidianComponent.prototype.load;
        ObsidianComponent.prototype.load = function (this: ObsidianComponent): void {
          foreignCalls++;
          current.call(this);
        };
      }
      await sleep(250);
      container.appendChild(Object.assign(document.createElement('span'), { textContent: 'late' }));
    });
    const executor = executorFor(api);

    try {
      const first = await executor.executeBlock(jsBlock, 'World/Ektaron.md');
      const second = await executor.executeBlock(jsBlock, 'World/Ektaron.md');

      // The foreign wrapper could not be removed: tracking still works through it, twice.
      expect(capturedOf(first)?.querySelector('span')?.textContent).toBe('late');
      expect(capturedOf(second)?.querySelector('span')?.textContent).toBe('late');
      expect(foreignCalls).toBe(1);
    } finally {
      ObsidianComponent.prototype.load = loadBefore;
    }
  });

  it('keeps tracking when another plugin overwrites the hook without chaining it', async () => {
    const loadBefore = ObsidianComponent.prototype.load;
    let overwritten = false;
    const api = apiRunning(async (container) => {
      if (!overwritten) {
        overwritten = true;
        // Someone puts back a reference captured before ours: our hook leaves the chain.
        ObsidianComponent.prototype.load = loadBefore;
      }
      await sleep(250);
      container.appendChild(Object.assign(document.createElement('span'), { textContent: 'late' }));
    });
    const executor = executorFor(api);

    try {
      await executor.executeBlock(jsBlock, 'World/Ektaron.md');
      const second = await executor.executeBlock(jsBlock, 'World/Ektaron.md');

      expect(capturedOf(second)?.querySelector('span')?.textContent).toBe('late');
    } finally {
      ObsidianComponent.prototype.load = loadBefore;
    }
  });

  it('attributes Markdown to the execution whose container it renders into, not to concurrent ones', async () => {
    jest
      .spyOn(MarkdownRenderer, 'render')
      .mockImplementation(async (_app, markdown, el: HTMLElement) => {
        await sleep(markdown === 'slow-markdown' ? 3000 : 10);
        el.textContent = markdown;
      });
    const executor = new DataviewExecutor(
      {
        query: jest.fn(),
        executeJs: jest.fn(async (code: string, container: HTMLElement, component: Component) => {
          const renderer = new FakeDataviewRenderer(container, async (el) => {
            // Both executions must be tracked when the Markdown render starts, otherwise the
            // neighbour's tracker could not see it whatever the attribution rule says.
            await sleep(50);
            const span = el.appendChild(document.createElement('span'));
            void MarkdownRenderer.render(null as never, code, span, '', null as never);
          });
          renderer.load();
          component.addChild(renderer as unknown as Component);
        }),
      },
      { workspace: { getActiveFile: () => null } },
      { renderSettleMaxMs: 400 }
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const slow = executor.executeBlock({ ...jsBlock, contentRaw: 'slow-markdown' }, 'A.md');
    const startedAt = Date.now();
    const fast = await executor.executeBlock({ ...jsBlock, contentRaw: 'fast-markdown' }, 'B.md');
    const fastElapsedMs = Date.now() - startedAt;
    await slow;

    expect(capturedOf(fast)?.querySelector('span')?.textContent).toBe('fast-markdown');
    // The warning count below is what discriminates; this only guards against a long wait.
    expect(fastElapsedMs).toBeLessThan(1500);
    // Only the slow block hit the cap; the fast one was not blamed for its neighbour.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('A.md'));
  });

  it('does not track a renderer bound to another container that loads during the execution', async () => {
    const stranger = document.createElement('div');
    const api: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container, component) => {
        const strangerRenderer = new FakeDataviewRenderer(
          stranger,
          () => new Promise<void>(() => {})
        );
        strangerRenderer.load();
        const renderer = new FakeDataviewRenderer(container, async (el) => {
          el.appendChild(Object.assign(document.createElement('span'), { textContent: 'own' }));
        });
        renderer.load();
        component.addChild(renderer as unknown as Component);
      }),
    };

    const startedAt = Date.now();
    const result = await executorFor(api, { renderSettleMaxMs: 5000 }).executeBlock(
      jsBlock,
      'World/Ektaron.md'
    );

    expect(Date.now() - startedAt).toBeLessThan(1500);
    expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('own');
  });

  it('warns once per executor, and falls back to DOM quiescence, when no render() can be captured', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const api: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        container.appendChild(Object.assign(document.createElement('span'), { textContent: 'x' }));
      }),
    };
    const executor = executorFor(api);

    const first = await executor.executeBlock(jsBlock, 'World/Ektaron.md');
    await executor.executeBlock(jsBlock, 'World/Other.md');

    expect(capturedOf(first)?.querySelector('span')?.textContent).toBe('x');
    const notCaptured = warn.mock.calls.filter(([message]) =>
      String(message).includes('no renderer render() could be captured')
    );
    expect(notCaptured).toHaveLength(1);
  });

  it('rolls back and releases the lease when installing the shims fails, so the next execution still gets them', async () => {
    const original = (resourcePath: string): string => `app://local/${resourcePath}`;
    // A base path and a require() make the require shim install first, then be rolled back.
    const adapter: Record<string, unknown> = { getBasePath: () => os.tmpdir() };
    const globalRequireBefore = global.require;
    const windowRequireBefore = (window as Window & { require?: NodeRequire }).require;
    global.require = require;
    (window as Window & { require?: NodeRequire }).require = require;
    Object.defineProperty(adapter, 'getResourcePath', {
      configurable: true,
      get: () => original,
      set: () => {
        throw new Error('read-only adapter');
      },
    });
    const api: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async (_code, container) => {
        const img = document.createElement('img');
        img.src = (adapter['getResourcePath'] as (path: string) => string)('_assets/a.ico');
        container.appendChild(img);
      }),
    };
    const executor = new DataviewExecutor(api, {
      workspace: { getActiveFile: () => null },
      vault: { adapter },
    });

    try {
      const failed = await executor.executeBlock(jsBlock, 'World/Ektaron.md');
      expect(failed.success).toBe(false);
      expect('error' in failed ? failed.error : '').toContain('read-only adapter');
      // The require shim went in before getResourcePath failed: it must have been undone.
      expect((window as Window & { require?: NodeRequire }).require).toBe(require);
      expect(global.require).toBe(require);

      // Make the adapter writable again: a leaked lease would skip installing the shims now.
      Object.defineProperty(adapter, 'getResourcePath', {
        configurable: true,
        writable: true,
        value: original,
      });
      const retried = await executor.executeBlock(jsBlock, 'World/Ektaron.md');

      expect(capturedOf(retried)?.querySelector('img')?.getAttribute('src')).toBe('_assets/a.ico');
      expect(adapter['getResourcePath']).toBe(original);
      expect((window as Window & { require?: NodeRequire }).require).toBe(require);
    } finally {
      global.require = globalRequireBefore;
      (window as Window & { require?: NodeRequire }).require = windowRequireBefore;
    }
  });

  it('bypasses the stableRender cache while executions are in flight, whichever one starts', async () => {
    const stableCache = new Map<unknown, unknown>([['hash', '<p>cached</p>']]);
    (window as unknown as Record<string, unknown>)['__stableRenderCache'] = stableCache;
    const sizesSeen: Record<string, number> = {};
    try {
      const executor = new DataviewExecutor(
        {
          query: jest.fn(),
          executeJs: jest.fn(async (code: string, container: HTMLElement, component: Component) => {
            const renderer = new FakeDataviewRenderer(container, async () => {
              sizesSeen[code] = stableCache.size;
              if (code === 'first') {
                // Refills the cache, as stableRender.js does after rendering...
                stableCache.set('first-view', '<p>first</p>');
                await sleep(400);
              }
            });
            renderer.load();
            component.addChild(renderer as unknown as Component);
          }),
        },
        { workspace: { getActiveFile: () => null } }
      );

      const first = executor.executeBlock({ ...jsBlock, contentRaw: 'first' }, 'A.md');
      await sleep(100);
      // ...so a second execution that starts meanwhile must still find it empty.
      const second = executor.executeBlock({ ...jsBlock, contentRaw: 'second' }, 'B.md');
      await Promise.all([first, second]);

      expect(sizesSeen['first']).toBe(0);
      expect(sizesSeen['second']).toBe(0);
      expect([...stableCache.entries()]).toEqual([['hash', '<p>cached</p>']]);
    } finally {
      delete (window as unknown as Record<string, unknown>)['__stableRenderCache'];
    }
  });

  it('warns and stops after the maximum number of settle rounds when a view keeps starting renders', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let started = 0;
    // The chain must not outlive the test: its timers would feed the next test's spy.
    let chainOn = true;
    jest
      .spyOn(MarkdownRenderer, 'render')
      .mockImplementation(async (_app, markdown, el: HTMLElement) => {
        el.textContent = markdown;
        // Every link mutates the DOM, which keeps the quiet tail open until its own bound
        // (1 s), so five rounds of tail are needed to run out of rounds.
        if (chainOn && started < 80) {
          started++;
          // Started later and by a timer, inside the quiet tail: only a new round can see it.
          window.setTimeout(() => {
            if (chainOn) {
              void MarkdownRenderer.render(
                null as never,
                `chain-${started}`,
                el,
                '',
                null as never
              );
            }
          }, 100);
        }
      });
    const api = apiRunning(async (container) => {
      const span = container.appendChild(document.createElement('span'));
      void MarkdownRenderer.render(null as never, 'chain-0', span, '', null as never);
    });

    try {
      const result = await executorFor(api, { renderSettleMaxMs: 8000 }).executeBlock(
        jsBlock,
        'World/Chain.md'
      );

      expect(result.success).toBe(true);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/settle rounds \(World\/Chain\.md\)/)
      );
    } finally {
      chainOn = false;
    }
  }, 15000);

  describe('attribution of Markdown renders to executions', () => {
    const slowRender = (): jest.SpyInstance =>
      jest.spyOn(MarkdownRenderer, 'render').mockImplementation(async () => {
        await sleep(2000);
      });
    const rendersInto =
      (makeTarget: () => unknown) =>
      async (_container: HTMLElement): Promise<void> => {
        // After an await, so that executions started in the same tick are all in flight.
        await sleep(50);
        void MarkdownRenderer.render(
          null as never,
          'x',
          makeTarget() as HTMLElement,
          '',
          null as never
        );
      };
    const stillRendering = (warn: jest.SpyInstance): boolean =>
      warn.mock.calls.some(([message]) => String(message).includes('still rendering'));

    it('does not wait for a detached element that never reaches the view, alone or among others', async () => {
      const render = slowRender();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const executor = executorFor(apiRunning(rendersInto(() => document.createElement('div'))), {
        renderSettleMaxMs: 150,
      });

      const solo = await executor.executeBlock(jsBlock, 'Solo.md');
      const together = await Promise.all([
        executor.executeBlock(jsBlock, 'One.md'),
        executor.executeBlock(jsBlock, 'Two.md'),
      ]);

      // Positive control: the foreign render did happen, three times.
      expect(render).toHaveBeenCalledTimes(3);
      expect([solo, ...together].every((result) => result.success)).toBe(true);
      expect(stillRendering(warn)).toBe(false);
    });

    it('waits for a detached element once the view has attached it to its container', async () => {
      const render = slowRender();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const api = apiRunning(async (container) => {
        const tmp = document.createElement('div');
        void MarkdownRenderer.render(null as never, 'x', tmp, '', null as never);
        await sleep(20);
        container.appendChild(tmp);
      });

      await executorFor(api, { renderSettleMaxMs: 150 }).executeBlock(jsBlock, 'Solo.md');

      expect(render).toHaveBeenCalledTimes(1);
      expect(stillRendering(warn)).toBe(true);
    });

    it('ignores a render that has no target element', async () => {
      const render = slowRender();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const executor = executorFor(apiRunning(rendersInto(() => null)), {
        renderSettleMaxMs: 150,
      });

      const result = await executor.executeBlock(jsBlock, 'Solo.md');

      expect(render).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(stillRendering(warn)).toBe(false);
    });

    it('does not blame the next execution for a late render of a view that outlived its own', async () => {
      const render = slowRender();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const api: DataviewApi = {
        query: jest.fn(),
        executeJs: jest.fn(async (code: string, container: HTMLElement, component: Component) => {
          const renderer = new FakeDataviewRenderer(container, async (el) => {
            if (code === 'outlives') {
              await sleep(300);
              const span = el.appendChild(document.createElement('span'));
              void MarkdownRenderer.render(null as never, 'late', span, '', null as never);
              await new Promise<void>(() => {});
            } else {
              await sleep(500);
            }
          });
          renderer.load();
          component.addChild(renderer as unknown as Component);
        }),
      };
      const app = { workspace: { getActiveFile: () => null } };

      // The first view hits the cap and returns while its script is still running.
      await new DataviewExecutor(api, app, { renderSettleMaxMs: 100 }).executeBlock(
        { ...jsBlock, contentRaw: 'outlives' },
        'A.md'
      );
      warn.mockClear();
      // The second one runs alone while the first one's late render is issued.
      const next = await new DataviewExecutor(api, app, {
        renderSettleMaxMs: 1500,
      }).executeBlock({ ...jsBlock, contentRaw: 'next' }, 'B.md');

      // Positive control: the late render did happen, while the second execution was running.
      expect(render).toHaveBeenCalledTimes(1);
      expect(next.success).toBe(true);
      expect(stillRendering(warn)).toBe(false);
    }, 10000);
  });

  it('waits for Markdown rendered into a temporary element the view attaches afterwards, even with other executions in flight', async () => {
    jest
      .spyOn(MarkdownRenderer, 'render')
      .mockImplementation(async (_app, markdown, el: HTMLElement) => {
        await sleep(500);
        el.textContent = markdown;
      });
    const executor = new DataviewExecutor(
      {
        query: jest.fn(),
        executeJs: jest.fn(async (code: string, container: HTMLElement, component: Component) => {
          const renderer = new FakeDataviewRenderer(container, async (el) => {
            await sleep(50);
            if (code === 'temp') {
              const tmp = document.createElement('div');
              void MarkdownRenderer.render(null as never, 'temp-rendered', tmp, '', null as never);
              el.appendChild(tmp);
            } else {
              await sleep(300);
            }
          });
          renderer.load();
          component.addChild(renderer as unknown as Component);
        }),
      },
      { workspace: { getActiveFile: () => null } }
    );

    const [withTemp] = await Promise.all([
      executor.executeBlock({ ...jsBlock, contentRaw: 'temp' }, 'A.md'),
      executor.executeBlock({ ...jsBlock, contentRaw: 'other' }, 'B.md'),
    ]);

    expect(capturedOf(withTemp)?.textContent).toBe('temp-rendered');
  });

  it('counts the quiet tail against the safety cap', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let timer: number | undefined;
    const api = apiRunning(async (container) => {
      // Keeps mutating long after render() resolved: uncapped, the tail runs to its 1 s bound.
      timer = window.setInterval(() => container.appendChild(document.createElement('i')), 40);
    });

    try {
      const startedAt = Date.now();
      await executorFor(api, { renderSettleMaxMs: 250 }).executeBlock(jsBlock, 'World/Ektaron.md');
      const elapsedMs = Date.now() - startedAt;

      // Capped: about 250 ms. Uncapped it would be about 1000 ms. The floor proves the cap
      // (and not an early exit) ended the wait.
      expect(elapsedMs).toBeGreaterThanOrEqual(200);
      expect(elapsedMs).toBeLessThan(650);
    } finally {
      window.clearInterval(timer);
    }
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('still rendering'));
  });

  it('falls back to DOM quiescence, and still publishes, when the hooks cannot be installed', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const descriptor = Object.getOwnPropertyDescriptor(ObsidianComponent.prototype, 'load');
    Object.defineProperty(ObsidianComponent.prototype, 'load', {
      ...descriptor,
      writable: false,
    });
    try {
      const api = apiRunning(async (container) => {
        container.appendChild(Object.assign(document.createElement('span'), { textContent: 'ok' }));
      });

      const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

      expect(result.success).toBe(true);
      expect(capturedOf(result)?.querySelector('span')?.textContent).toBe('ok');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('render tracking is unavailable'),
        expect.anything()
      );
    } finally {
      Object.defineProperty(ObsidianComponent.prototype, 'load', { ...descriptor });
    }
  });

  describe('global state around failures', () => {
    type RequireHolder = Window & { require?: NodeRequire };
    const requireHolder = window as RequireHolder;
    const globalRequireBefore = global.require;
    const windowRequireBefore = requireHolder.require;
    const resourcePathOf = (resourcePath: string): string => `app://local/${resourcePath}`;

    function makeAdapter(): {
      getResourcePath: (path: string) => string;
      getBasePath: () => string;
    } {
      return { getResourcePath: resourcePathOf, getBasePath: () => os.tmpdir() };
    }

    beforeEach(() => {
      global.require = require;
      requireHolder.require = require;
    });

    afterEach(() => {
      // Undo whatever a test did to the property, accessor or not.
      Object.defineProperty(window, 'require', {
        configurable: true,
        writable: true,
        enumerable: true,
        value: windowRequireBefore,
      });
      global.require = globalRequireBefore;
      delete (window as unknown as Record<string, unknown>)['__stableRenderCache'];
    });

    it('releases the shims, the cache, the observers and the lease when executeJs throws', async () => {
      const adapter = makeAdapter();
      const stableCache = new Map<unknown, unknown>([['hash', '<p>cached</p>']]);
      (window as unknown as Record<string, unknown>)['__stableRenderCache'] = stableCache;
      const observe = jest.spyOn(MutationObserver.prototype, 'observe');
      const disconnect = jest.spyOn(MutationObserver.prototype, 'disconnect');
      const api: DataviewApi = {
        query: jest.fn(),
        executeJs: jest.fn(async () => {
          throw new Error('boom');
        }),
      };

      const result = await new DataviewExecutor(api, {
        workspace: { getActiveFile: () => null },
        vault: { adapter },
      }).executeBlock(jsBlock, 'World/Ektaron.md');

      expect(result.success).toBe(false);
      expect(adapter.getResourcePath).toBe(resourcePathOf);
      expect(requireHolder.require).toBe(require);
      expect([...stableCache.entries()]).toEqual([['hash', '<p>cached</p>']]);
      expect(observe.mock.contexts.length).toBeGreaterThan(0);
      for (const observer of observe.mock.contexts) {
        expect(disconnect.mock.contexts).toContain(observer);
      }
      expect(activeShimLeaseCount()).toBe(0);
    });

    it('puts the hooks back when a later one cannot be installed', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const loadBefore = ObsidianComponent.prototype.load;
      const descriptor = Object.getOwnPropertyDescriptor(MarkdownRenderer, 'render');
      Object.defineProperty(MarkdownRenderer, 'render', { ...descriptor, writable: false });
      try {
        const api = apiRunning(async (container) => {
          container.appendChild(document.createElement('span'));
        });

        const result = await executorFor(api).executeBlock(jsBlock, 'World/Ektaron.md');

        expect(result.success).toBe(true);
        // Component.load had been wrapped first: it must be back as it was.
        expect(ObsidianComponent.prototype.load).toBe(loadBefore);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('render tracking is unavailable'),
          expect.anything()
        );
      } finally {
        Object.defineProperty(MarkdownRenderer, 'render', { ...descriptor });
      }
    });

    it('still restores the other shims and the cache when one restore step fails', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const adapter = makeAdapter();
      const stableCache = new Map<unknown, unknown>([['hash', '<p>cached</p>']]);
      (window as unknown as Record<string, unknown>)['__stableRenderCache'] = stableCache;
      const api: DataviewApi = {
        query: jest.fn(),
        executeJs: jest.fn(async (_code, container) => {
          container.appendChild(document.createElement('span'));
          stableCache.set('refilled-by-view', '<p>x</p>');
          // From now on, putting require() back fails.
          const shim = requireHolder.require;
          Object.defineProperty(window, 'require', {
            configurable: true,
            get: () => shim,
            set: () => {
              throw new Error('locked require');
            },
          });
        }),
      };

      const result = await new DataviewExecutor(api, {
        workspace: { getActiveFile: () => null },
        vault: { adapter },
      }).executeBlock(jsBlock, 'World/Ektaron.md');

      expect(result.success).toBe(true);
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining('shim restore failed'),
        expect.objectContaining({ message: 'locked require' })
      );
      expect(adapter.getResourcePath).toBe(resourcePathOf);
      expect([...stableCache.entries()]).toEqual([['hash', '<p>cached</p>']]);
      expect(activeShimLeaseCount()).toBe(0);
    });

    it('does not undo a require() that another plugin installed in the meantime', async () => {
      const adapter = makeAdapter();
      const foreignRequire = ((request: string) => require(request)) as NodeRequire;
      const api: DataviewApi = {
        query: jest.fn(),
        executeJs: jest.fn(async (_code, container) => {
          container.appendChild(document.createElement('span'));
          requireHolder.require = foreignRequire;
          adapter.getResourcePath = (resourcePath: string) => `foreign://${resourcePath}`;
        }),
      };

      await new DataviewExecutor(api, {
        workspace: { getActiveFile: () => null },
        vault: { adapter },
      }).executeBlock(jsBlock, 'World/Ektaron.md');

      expect(requireHolder.require).toBe(foreignRequire);
      expect(adapter.getResourcePath('a.png')).toBe('foreign://a.png');
    });
  });

  it('leaves Component.load and MarkdownRenderer.render exactly as it found them', async () => {
    const loadBefore = ObsidianComponent.prototype.load;
    const renderBefore = MarkdownRenderer.render;

    await executorFor(apiRunning(async () => {})).executeBlock(jsBlock, 'World/Ektaron.md');
    expect(ObsidianComponent.prototype.load).toBe(loadBefore);
    expect(MarkdownRenderer.render).toBe(renderBefore);

    const failing: DataviewApi = {
      query: jest.fn(),
      executeJs: jest.fn(async () => {
        throw new Error('boom');
      }),
    };
    const result = await executorFor(failing).executeBlock(jsBlock, 'World/Ektaron.md');
    expect(result.success).toBe(false);
    expect(ObsidianComponent.prototype.load).toBe(loadBefore);
    expect(MarkdownRenderer.render).toBe(renderBefore);
  });
});
