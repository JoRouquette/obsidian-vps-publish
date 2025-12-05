import type { VpsConfig } from '@core-domain/entities/vps-config';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { DEFAULT_LOGGER_LEVEL } from '../constants/default-logger-level.constant';
import type { PluginSettings } from './plugin-settings.type';

export function normalizeSettings(settings: PluginSettings, logger?: LoggerPort): void {
  if (!Array.isArray(settings.vpsConfigs)) {
    logger?.warn('settings.vpsConfigs was not an array, resetting.');
    settings.vpsConfigs = [];
  }

  if (settings.vpsConfigs.length === 0) {
    logger?.info('No VPS config found, creating default.');
    settings.vpsConfigs.push(defaultVpsConfig());
  }

  if (!Array.isArray(settings.folders)) {
    logger?.warn('settings.folders was not an array, resetting.');
    settings.folders = [];
  }

  if (!Array.isArray(settings.ignoreRules)) {
    logger?.info('No ignoreRules found, initializing empty array.');
    settings.ignoreRules = [];
  }

  if (!settings.assetsFolder) {
    logger?.info('No assetsFolder found, setting default "assets".');
    settings.assetsFolder = 'assets';
  }

  if (!Array.isArray(settings.frontmatterKeysToExclude)) {
    logger?.info('frontmatterKeysToExclude not set, defaulting to empty array.');
    settings.frontmatterKeysToExclude = [];
  }

  if (!Array.isArray(settings.frontmatterTagsToExclude)) {
    logger?.info('frontmatterTagsToExclude not set, defaulting to empty array.');
    settings.frontmatterTagsToExclude = [];
  }

  if (settings.enableAssetsVaultFallback == null) {
    logger?.info('enableAssetsVaultFallback not set, defaulting to true.');
    settings.enableAssetsVaultFallback = true;
  }

  if (!Array.isArray(settings.calloutStylePaths)) {
    logger?.info('calloutStylePaths not set, defaulting to empty array.');
    settings.calloutStylePaths = [];
  }

  if (settings.logLevel == null) {
    settings.logLevel = DEFAULT_LOGGER_LEVEL;
  }

  const availableVpsIds = new Set(settings.vpsConfigs.map((v) => v.id));
  const fallbackVpsId = settings.vpsConfigs[0]?.id;

  for (const folder of settings.folders) {
    if (!folder.vpsId || !availableVpsIds.has(folder.vpsId)) {
      if (fallbackVpsId) {
        logger?.debug('Assigning fallback VPS to folder', { folderId: folder.id, fallbackVpsId });
        folder.vpsId = fallbackVpsId;
      }
    }
  }
}

function defaultVpsConfig(): VpsConfig {
  return {
    id: 'default',
    name: 'VPS',
    url: '',
    apiKey: '',
  };
}
