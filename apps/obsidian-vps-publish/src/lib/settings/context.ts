import type { FolderConfig } from '@core-domain/entities/folder-config';
import type { VpsConfig } from '@core-domain/entities/vps-config';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { getTranslations } from '../../i18n';
import type ObsidianVpsPublishPlugin from '../../main';
import type { PluginSettings, SettingsContext as BaseContext } from './plugin-settings.type';

export type SettingsViewContext = BaseContext & {
  plugin: ObsidianVpsPublishPlugin;
  t: ReturnType<typeof getTranslations>['t'];
  vpsHelpers: VpsHelpers;
};

export interface VpsHelpers {
  /** Get all VPS configurations */
  getAllVps(): VpsConfig[];

  /** Find VPS by ID */
  findVpsById(id: string): VpsConfig | undefined;

  /** Find VPS by name */
  findVpsByName(name: string): VpsConfig | undefined;

  /** Get folders for a specific VPS */
  getFoldersForVps(vpsId: string): FolderConfig[];

  /** Check if VPS has unique name */
  isVpsNameUnique(name: string, excludeId?: string): boolean;

  /** Check if VPS has unique URL */
  isVpsUrlUnique(url: string, excludeId?: string): boolean;

  /** Get default VPS (first one if only one exists) */
  getDefaultVps(): VpsConfig | undefined;
}

export function buildSettingsContext(
  plugin: ObsidianVpsPublishPlugin,
  logger: LoggerPort,
  refresh: () => void
): SettingsViewContext {
  const { t } = getTranslations(plugin.app, plugin.settings as PluginSettings);

  const base: BaseContext = {
    app: plugin.app,
    settings: plugin.settings as PluginSettings,
    save: () => plugin.saveSettings(),
    refresh,
    logger,
  };

  const vpsHelpers: VpsHelpers = {
    getAllVps: () => base.settings.vpsConfigs || [],

    findVpsById: (id: string) => base.settings.vpsConfigs?.find((vps) => vps.id === id),

    findVpsByName: (name: string) => base.settings.vpsConfigs?.find((vps) => vps.name === name),

    getFoldersForVps: (vpsId: string) => {
      const vps = base.settings.vpsConfigs?.find((v) => v.id === vpsId);
      return vps?.folders || [];
    },

    isVpsNameUnique: (name: string, excludeId?: string) => {
      const vpsList = base.settings.vpsConfigs || [];
      return !vpsList.some((vps) => vps.name === name && vps.id !== excludeId);
    },

    isVpsUrlUnique: (url: string, excludeId?: string) => {
      const normalized = url.trim().toLowerCase().replace(/\/+$/, '');
      const vpsList = base.settings.vpsConfigs || [];
      return !vpsList.some(
        (vps) =>
          vps.baseUrl.trim().toLowerCase().replace(/\/+$/, '') === normalized &&
          vps.id !== excludeId
      );
    },

    getDefaultVps: () => {
      const vpsList = base.settings.vpsConfigs || [];
      return vpsList.length === 1 ? vpsList[0] : undefined;
    },
  };

  return {
    ...base,
    plugin,
    t,
    vpsHelpers,
  };
}
