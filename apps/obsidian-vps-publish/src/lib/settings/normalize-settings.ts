import { VpsConfigInvariants } from '@core-domain/entities/vps-config';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { DEFAULT_LOGGER_LEVEL } from '../constants/default-logger-level.constant';
import type { PluginSettings } from './plugin-settings.type';

export function normalizeSettings(settings: PluginSettings, logger?: LoggerPort): void {
  logger?.debug('Normalizing settings...');

  // Ensure vpsConfigs is an array
  if (!Array.isArray(settings.vpsConfigs)) {
    logger?.warn('settings.vpsConfigs was not an array, resetting.');
    settings.vpsConfigs = [];
  }

  // Apply domain invariants
  try {
    VpsConfigInvariants.validateMinimumVps(settings.vpsConfigs);
  } catch (e) {
    logger?.error('VPS invariant violation, creating default VPS', e);
    settings.vpsConfigs = [createDefaultVps()];
  }

  // Validate each VPS
  settings.vpsConfigs.forEach((vps, index) => {
    try {
      VpsConfigInvariants.validateMinimumFolders(vps);
      VpsConfigInvariants.validateUniqueName(settings.vpsConfigs, vps.name, vps.id);
      VpsConfigInvariants.validateUniqueUrl(settings.vpsConfigs, vps.baseUrl, vps.id);
    } catch (e) {
      logger?.error(`VPS #${index} validation failed`, e);
      // Fix the VPS
      if (!vps.folders || vps.folders.length === 0) {
        vps.folders = [createDefaultFolder(vps.id)];
      }
    }

    // Ensure arrays exist
    if (!Array.isArray(vps.ignoreRules)) {
      vps.ignoreRules = [];
    }
    if (!Array.isArray(vps.cleanupRules)) {
      vps.cleanupRules = [];
    }
    if (!Array.isArray(vps.folders)) {
      vps.folders = [createDefaultFolder(vps.id)];
    }
  });

  // Normalize global settings
  if (!settings.assetsFolder) {
    logger?.debug('No assetsFolder found, setting default "assets".');
    settings.assetsFolder = 'assets';
  }

  if (!Array.isArray(settings.frontmatterKeysToExclude)) {
    logger?.debug('frontmatterKeysToExclude not set, defaulting to empty array.');
    settings.frontmatterKeysToExclude = [];
  }

  if (!Array.isArray(settings.frontmatterTagsToExclude)) {
    logger?.debug('frontmatterTagsToExclude not set, defaulting to empty array.');
    settings.frontmatterTagsToExclude = [];
  }

  if (settings.enableAssetsVaultFallback == null) {
    logger?.debug('enableAssetsVaultFallback not set, defaulting to true.');
    settings.enableAssetsVaultFallback = true;
  }

  if (!Array.isArray(settings.calloutStylePaths)) {
    logger?.debug('calloutStylePaths not set, defaulting to empty array.');
    settings.calloutStylePaths = [];
  }

  if (settings.logLevel == null) {
    settings.logLevel = DEFAULT_LOGGER_LEVEL;
  }

  logger?.debug('Settings normalized successfully');
}

function createDefaultVps(): PluginSettings['vpsConfigs'][0] {
  const vpsId = `vps-${Date.now()}`;
  return {
    id: vpsId,
    name: 'VPS',
    baseUrl: '',
    apiKey: '',
    ignoreRules: [],
    cleanupRules: [],
    folders: [createDefaultFolder(vpsId)],
  };
}

function createDefaultFolder(vpsId: string): PluginSettings['vpsConfigs'][0]['folders'][0] {
  return {
    id: `folder-${Date.now()}`,
    vpsId,
    vaultFolder: '',
    routeBase: '/',
    ignoredCleanupRuleIds: [],
  };
}
