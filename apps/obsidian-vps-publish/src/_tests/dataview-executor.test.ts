/**
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Component } from 'obsidian';

import { type DataviewApi, DataviewExecutor } from '../lib/dataview/dataview-executor';

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
