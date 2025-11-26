import { App, PluginSettingTab } from 'obsidian';
import { LoggerPort } from '@core-domain/ports/logger-port';
import PublishToPersonalVpsPlugin from '../main';
import { buildSettingsContext } from './settings/context';
import { normalizeSettings } from './settings/normalize-settings';
import { renderLanguageSection } from './settings/sections/language-section';
import { renderVaultSection } from './settings/sections/vault-section';
import { renderFoldersSection } from './settings/sections/folders-section';
import { renderIgnoreRulesSection } from './settings/sections/ignore-rules-section';
import { renderVpsSection } from './settings/sections/vps-section';

export class PublishToPersonalVpsSettingTab extends PluginSettingTab {
  private readonly plugin: PublishToPersonalVpsPlugin;
  private readonly logger: LoggerPort;

  constructor(app: App, plugin: PublishToPersonalVpsPlugin, logger: LoggerPort) {
    super(app, plugin);
    this.plugin = plugin;
    this.logger = logger;
    this.logger.debug('PublishToPersonalVpsSettingTab initialized');
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const ctx = buildSettingsContext(this.plugin, this.logger, () => this.display());

    normalizeSettings(ctx.settings, ctx.logger);

    const root = containerEl.createDiv({
      cls: 'publish-to-personal-vps-settings',
    });

    root.createEl('h1', { text: ctx.t.settings.tabTitle });

    renderLanguageSection(root, ctx);
    renderVaultSection(root, ctx);
    renderFoldersSection(root, ctx);
    renderIgnoreRulesSection(root, ctx);
    renderVpsSection(root, ctx);
  }
}
