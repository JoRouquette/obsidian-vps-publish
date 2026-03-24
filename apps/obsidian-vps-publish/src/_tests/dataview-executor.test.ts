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
});
