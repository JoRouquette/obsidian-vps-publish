jest.mock('obsidian', () => ({
  AbstractInputSuggest: class {},
  Modal: class {},
  Notice: class {},
  Setting: class {},
  TFile: class {},
  setIcon: jest.fn(),
}));

import { validateRouteTree } from '@core-domain';
import { type LoggerPort, LogLevel } from '@core-domain/ports/logger-port';

import { normalizeSettings } from '../lib/settings/normalize-settings';
import type { PluginSettings } from '../lib/settings/plugin-settings.type';
import { addVpsConfig } from '../lib/settings/sections/vps-section';

function createLogger(): LoggerPort {
  const logger: LoggerPort = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => logger),
    level: LogLevel.debug,
  };
  return logger;
}

function createSettings(): PluginSettings {
  return {
    vpsConfigs: [],
    locale: 'system',
    assetsFolder: 'assets',
    enableAssetsVaultFallback: true,
    frontmatterKeysToExclude: [],
    frontmatterTagsToExclude: [],
    logLevel: LogLevel.info,
    calloutStylePaths: [],
  };
}

describe('addVpsConfig', () => {
  it('creates a VPS with a single root route and no legacy folders', async () => {
    const settings = createSettings();
    const save = jest.fn(async () => undefined);
    const refresh = jest.fn();

    await addVpsConfig({ settings, logger: createLogger(), save, refresh });

    expect(settings.vpsConfigs).toHaveLength(1);
    const [vps] = settings.vpsConfigs;
    expect(vps).not.toHaveProperty('folders');
    expect(vps).not.toHaveProperty('customIndexes');
    const routeTree = vps.routeTree ?? { roots: [] };
    expect(routeTree.roots).toHaveLength(1);
    expect(routeTree.roots[0]).toMatchObject({ segment: '', ignoredCleanupRuleIds: [] });
    expect(validateRouteTree(routeTree).valid).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('creates a VPS that normalization keeps as is', async () => {
    const settings = createSettings();
    await addVpsConfig({
      settings,
      logger: createLogger(),
      save: async () => undefined,
      refresh() {},
    });
    const routeTree = settings.vpsConfigs[0].routeTree;

    normalizeSettings(settings);

    expect(settings.vpsConfigs[0].routeTree).toBe(routeTree);
  });
});
