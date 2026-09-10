import { type LoggerPort } from '@core-domain/ports/logger-port';
import { type App, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';

import type ObsidianVpsPublishPlugin from '../main';
import { buildSettingsContext } from './settings/context';
import { buildSettingDefinitions } from './settings/definitions';
import { normalizeSettings } from './settings/normalize-settings';
import { renderAdvancedSection } from './settings/sections/advanced-section';
import { renderIgnoreRulesSection } from './settings/sections/ignore-rules-section';
import { renderLanguageSection } from './settings/sections/language-section';
import { renderRoutesSection } from './settings/sections/routes-section';
import { renderVaultSection } from './settings/sections/vault-section';
import { renderVpsSection } from './settings/sections/vps-section';

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
   * Chemin **Obsidian 1.13+**.
   *
   * Le manifest déclare `minAppVersion: 1.5.0` : les deux chemins doivent
   * coexister. Obsidian < 1.13 ignore cette méthode et appelle `display()` ;
   * à partir de 1.13, c'est l'inverse — `display()` n'est plus appelé dès que
   * cette méthode renvoie un tableau non vide.
   *
   * Aucune UI n'est dupliquée : les sections dynamiques délèguent aux mêmes
   * `render*Section()` que `display()`, via `SectionPage`.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    // `update()` est @since 1.13.0 : ce corps n'est atteint que sur 1.13+,
    // puisque les versions antérieures n'appellent jamais cette méthode.
    /* eslint-disable-next-line obsidianmd/no-unsupported-api */
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

  /**
   * Chemin **Obsidian < 1.13** (rendu impératif historique).
   */
  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const ctx = buildSettingsContext(this.plugin, this.logger, () => this.display());

    normalizeSettings(ctx.settings, ctx.logger);

    const root = containerEl.createDiv({
      cls: 'obsidian-vps-publish-settings',
    });

    new Setting(root).setName(ctx.t.settings.tabTitle).setHeading();

    // Help button at the top
    new Setting(root)
      .setName(ctx.t.help.settingsButtonLabel)
      .setDesc(ctx.t.help.settingsButtonDescription)
      .addButton((btn) => {
        btn
          .setButtonText(ctx.t.help.settingsButtonLabel)
          .setIcon('help-circle')
          .onClick(() => {
            const { HelpModal } = require('./modals/help-modal');
            new HelpModal(this.app, ctx.t).open();
          });
      });

    renderLanguageSection(root, ctx);
    renderVaultSection(root, ctx);
    renderRoutesSection(root, ctx);
    renderIgnoreRulesSection(root, ctx);
    renderVpsSection(root, ctx);
    renderAdvancedSection(root, ctx);
  }
}
