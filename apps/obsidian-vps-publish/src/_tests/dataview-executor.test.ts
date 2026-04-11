/**
 * @jest-environment jsdom
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
});
