import type ObsidianVpsPublishPlugin from '../../main';
import { getTranslations } from '../../i18n';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { SettingsContext as BaseContext, PluginSettings } from './plugin-settings.type';

export type SettingsViewContext = BaseContext & {
  plugin: ObsidianVpsPublishPlugin;
  t: ReturnType<typeof getTranslations>['t'];
};

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

  return {
    ...base,
    plugin,
    t,
  };
}
