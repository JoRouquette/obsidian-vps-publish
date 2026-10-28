/**
 * Migration d'un réglage sauvegardé au modèle « folders first » vers `routeTree`,
 * telle que `loadSettings` (main.ts) l'applique aux données brutes chargées.
 */
import {
  type LegacyVpsConfig,
  migrateLegacyVpsConfig,
  type RouteTreeConfig,
  validateRouteTree,
} from '@core-domain';
import { LogLevel } from '@core-domain/ports/logger-port';

import { normalizeSettings } from '../lib/settings/normalize-settings';
import type { PluginSettings } from '../lib/settings/plugin-settings.type';
import { getEffectiveFolders } from '../lib/utils/get-effective-folders.util';

const savedLegacyVps = JSON.stringify({
  id: 'vps-1',
  name: 'Legacy VPS',
  baseUrl: 'https://example.com',
  apiKey: 'enc:a2V5',
  ignoreRules: [],
  cleanupRules: [],
  folders: [
    {
      id: 'folder-default',
      vpsId: 'vps-1',
      vaultFolder: '',
      routeBase: '/',
      ignoredCleanupRuleIds: [],
    },
    {
      id: 'folder-home',
      vpsId: 'vps-1',
      vaultFolder: 'Home',
      routeBase: '/',
      ignoredCleanupRuleIds: [],
    },
    {
      id: 'folder-chars',
      vpsId: 'vps-1',
      vaultFolder: 'Lore/Characters',
      routeBase: '/lore/characters',
      ignoredCleanupRuleIds: [],
    },
    {
      id: 'folder-lore',
      vpsId: 'vps-1',
      vaultFolder: 'Lore',
      routeBase: '/lore',
      ignoredCleanupRuleIds: ['rule-1'],
      flattenTree: true,
    },
  ],
  customIndexes: [{ id: 'idx-1', folderPath: '/lore', indexFilePath: 'Lore/_index.md' }],
});

function loadSavedVps(json: string): LegacyVpsConfig {
  const parsed: LegacyVpsConfig = JSON.parse(json);
  return parsed;
}

function createSettings(vpsConfigs: PluginSettings['vpsConfigs']): PluginSettings {
  return {
    vpsConfigs,
    locale: 'system',
    assetsFolder: 'assets',
    enableAssetsVaultFallback: true,
    frontmatterKeysToExclude: [],
    frontmatterTagsToExclude: [],
    logLevel: LogLevel.info,
    calloutStylePaths: [],
  };
}

describe('saved legacy settings migration', () => {
  it('migrates saved folders to a valid route tree that publishes the same folders', () => {
    const { vps, migrated } = migrateLegacyVpsConfig(loadSavedVps(savedLegacyVps));

    expect(migrated).toBe(true);
    expect(vps).not.toHaveProperty('folders');
    expect(vps).not.toHaveProperty('customIndexes');
    expect(vps.apiKey).toBe('enc:a2V5');

    const routeTree = vps.routeTree ?? { roots: [] };
    // Une seule racine « / » malgré deux dossiers sur « / » : saveSettings ne lève pas.
    expect(routeTree.roots.filter((root) => root.segment === '')).toHaveLength(1);
    expect(validateRouteTree(routeTree).valid).toBe(true);

    // « /lore » déclaré après « /lore/characters » garde tous ses réglages.
    expect(getEffectiveFolders(vps)).toEqual([
      expect.objectContaining({ id: 'folder-default', vaultFolder: 'Home', routeBase: '/' }),
      expect.objectContaining({
        id: 'folder-lore',
        vaultFolder: 'Lore',
        routeBase: '/lore',
        customIndexFile: 'Lore/_index.md',
        flattenTree: true,
        ignoredCleanupRuleIds: ['rule-1'],
      }),
      expect.objectContaining({
        id: 'folder-chars',
        vaultFolder: 'Lore/Characters',
        routeBase: '/lore/characters',
      }),
    ]);
  });

  it('keeps a saved route tree and ignores stale legacy folders', () => {
    const routeTree: RouteTreeConfig = {
      roots: [{ id: 'route-docs', segment: 'docs', vaultFolder: 'Docs' }],
    };
    const saved = loadSavedVps(savedLegacyVps);

    const { vps, migrated } = migrateLegacyVpsConfig({ ...saved, routeTree });

    expect(migrated).toBe(false);
    expect(vps.routeTree).toBe(routeTree);
    expect(vps).not.toHaveProperty('folders');
    expect(getEffectiveFolders(vps)).toEqual([
      expect.objectContaining({ id: 'route-docs', vaultFolder: 'Docs', routeBase: '/docs' }),
    ]);
  });

  it('leaves the migrated route tree untouched on normalization', () => {
    const { vps } = migrateLegacyVpsConfig(loadSavedVps(savedLegacyVps));
    const settings = createSettings([vps]);
    const routeTree = vps.routeTree;

    normalizeSettings(settings);

    expect(settings.vpsConfigs[0].routeTree).toBe(routeTree);
  });

  it('gives a root route to a VPS left without route', () => {
    const { vps } = migrateLegacyVpsConfig({ ...loadSavedVps(savedLegacyVps), folders: [] });
    const settings = createSettings([vps]);

    normalizeSettings(settings);

    expect(settings.vpsConfigs[0].routeTree?.roots).toEqual([
      expect.objectContaining({ segment: '' }),
    ]);
  });
});
