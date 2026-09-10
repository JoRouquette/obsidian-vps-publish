import { type LoggerPort } from '@core-domain/ports/logger-port';
import { type App, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';

import type ObsidianVpsPublishPlugin from '../main';
import { buildSettingsContext } from './settings/context';
import { buildSettingDefinitions } from './settings/definitions';
import { normalizeSettings } from './settings/normalize-settings';

export class ObsidianVpsPublishSettingTab extends PluginSettingTab {
  private readonly plugin: ObsidianVpsPublishPlugin;
  private readonly logger: LoggerPort;

  constructor(app: App, plugin: ObsidianVpsPublishPlugin, logger: LoggerPort) {
    super(app, plugin);
    this.plugin = plugin;
    this.logger = logger;
    this.logger.debug('ObsidianVpsPublishSettingTab initialized');
  }

  /**
   * Construit l'arborescence déclarative des réglages.
   *
   * C'est le **seul** chemin de rendu depuis que le manifest exige Obsidian
   * 1.13.0. La surcharge historique de `display()` a été supprimée : elle
   * n'était plus jamais appelée, donc jamais exercée, et `SettingTab` en
   * fournit de toute façon une implémentation par défaut.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    const ctx = buildSettingsContext(this.plugin, this.logger, () => this.update());
    normalizeSettings(ctx.settings, ctx.logger);
    return buildSettingDefinitions(ctx);
  }

  /**
   * Persiste la valeur d'un contrôle déclaratif via le `saveSettings()` du
   * plugin, et non par une écriture directe : c'est lui qui chiffre les clés
   * d'API et normalise les réglages.
   */
  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    this.logger.debug('Setting changed from the declarative settings API', { key });
    await this.plugin.saveSettings();
  }
}
