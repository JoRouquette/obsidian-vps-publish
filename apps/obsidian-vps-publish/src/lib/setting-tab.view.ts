import { type LoggerPort } from '@core-domain/ports/logger-port';
import { type App, PluginSettingTab, Setting } from 'obsidian';

import type ObsidianVpsPublishPlugin from '../main';
import { buildSettingsContext } from './settings/context';
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
