import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type { VpsConfig } from '@core-domain/publish/VpsConfig';
import { getTranslations } from '../i18n';
import PublishToPersonalVpsPlugin from '../main';
import { createDefaultFolderConfig } from './utils/createDefaultFolderConfig';
import { FolderSuggest } from './FolderSuggest';
import { LoggerPort } from '@core-domain/publish/ports/logger-port';

export class PublishToPersonalVpsSettingTab extends PluginSettingTab {
  private readonly plugin: PublishToPersonalVpsPlugin;
  private readonly _logger: LoggerPort;

  constructor(
    app: App,
    plugin: PublishToPersonalVpsPlugin,
    logger: LoggerPort
  ) {
    super(app, plugin);
    this.plugin = plugin;
    this._logger = logger;
    this._logger.debug('PublishToPersonalVpsSettingTab initialized');
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const { t } = getTranslations(this.app, this.plugin.settings);
    const settings = this.plugin.settings;

    // Sanity defaults au cas où (défensif)
    if (!Array.isArray(settings.vpsConfigs)) {
      this._logger.warn('settings.vpsConfigs was not an array, resetting.');
      settings.vpsConfigs = [];
    }
    if (settings.vpsConfigs.length === 0) {
      this._logger.info('No VPS config found, creating default.');
      settings.vpsConfigs.push({
        id: 'default',
        name: 'VPS',
        url: '',
        apiKey: '',
      } as VpsConfig);
    }
    const vps = settings.vpsConfigs[0];

    if (!Array.isArray(settings.folders)) {
      this._logger.warn('settings.folders was not an array, resetting.');
      settings.folders = [];
    }
    if (!settings.ignoreRules) {
      this._logger.info('No ignoreRules found, initializing empty array.');
      settings.ignoreRules = [];
    }
    if (!settings.assetsFolder) {
      this._logger.info('No assetsFolder found, setting default "assets".');
      settings.assetsFolder = 'assets';
    }
    if (settings.enableAssetsVaultFallback == null) {
      this._logger.info(
        'enableAssetsVaultFallback not set, defaulting to true.'
      );
      settings.enableAssetsVaultFallback = true;
    }

    // Racine avec le style principal
    const root = containerEl.createDiv({
      cls: 'publish-to-personal-vps-settings',
    });

    root.createEl('h1', { text: t.settings.tabTitle });

    // -----------------------------------------------------------------------
    // #1 – Langue d’interface
    // -----------------------------------------------------------------------
    const langBlock = root.createDiv({ cls: 'ptpv-block' });
    const langBlockTitle = langBlock.createDiv({ cls: 'ptpv-block-title' });
    langBlockTitle.createEl('h6', { text: t.settings.language.title });

    new Setting(langBlock)
      .setName(t.settings.language.label)
      .setDesc(t.settings.language.description)
      .addDropdown((dropdown) => {
        dropdown
          .addOption('system', 'System / Système')
          .addOption('en', 'English')
          .addOption('fr', 'Français')
          .setValue(settings.locale ?? 'system')
          .onChange(async (value) => {
            this._logger.info('Language changed', { locale: value });
            settings.locale = value as any;
            await this.plugin.saveSettings();
            this.display(); // re-render pour appliquer les nouvelles traductions
          });
      });

    // -----------------------------------------------------------------------
    // #2 – Configuration globale du vault (assets)
    // -----------------------------------------------------------------------
    const vaultBlock = root.createDiv({ cls: 'ptpv-block' });
    const vaultBlockTitle = vaultBlock.createDiv({ cls: 'ptpv-block-title' });
    vaultBlockTitle.createEl('h6', {
      text: t.settings.vault.title,
    });

    vaultBlock.createDiv({
      cls: 'ptpv-help',
      text: t.settings.vault?.help,
    });

    // Dossier d’assets dans le vault
    new Setting(vaultBlock)
      .setName(t.settings.vault?.assetsFolderLabel)
      .setDesc(t.settings.vault?.assetsFolderDescription)
      .addText((text) => {
        text
          .setPlaceholder('assets')
          .setValue(settings.assetsFolder || 'assets')
          .onChange(async (value) => {
            this._logger.debug('Assets folder changed', { value });
            settings.assetsFolder = value.trim() || 'assets';
            await this.plugin.saveSettings();
          });

        new FolderSuggest(this.app, text.inputEl);
      });

    // Fallback de recherche des assets dans tout le vault
    new Setting(vaultBlock)
      .setName(t.settings.vault?.enableAssetsVaultFallbackLabel)
      .setDesc(t.settings.vault?.enableAssetsVaultFallbackDescription)
      .addToggle((toggle) =>
        toggle
          .setValue(settings.enableAssetsVaultFallback)
          .onChange(async (value) => {
            this._logger.debug('enableAssetsVaultFallback changed', { value });
            settings.enableAssetsVaultFallback = value;
            await this.plugin.saveSettings();
          })
      );

    // -----------------------------------------------------------------------
    // #3 – Folder configs (ce qui est publié et où)
    // -----------------------------------------------------------------------
    const folderBlock = root.createDiv({ cls: 'ptpv-block' });
    const folderBlockTitle = folderBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    folderBlockTitle.createEl('h6', { text: t.settings.folders.title });

    // Si aucun dossier, on en crée un par défaut lié au VPS courant
    if (settings.folders.length === 0) {
      this._logger.info('No folder config found, creating default.');
      settings.folders.push(createDefaultFolderConfig(vps.id));
    }

    settings.folders.forEach((folderCfg, index) => {
      const singleFolderFieldset = folderBlock.createEl('fieldset', {
        cls: 'ptpv-folder',
      });

      singleFolderFieldset.createEl('legend', {
        text:
          folderCfg.vaultFolder && folderCfg.vaultFolder.length > 0
            ? folderCfg.vaultFolder
            : `${t.settings.folders.vaultLabel} #${index + 1}`,
      });

      // Bouton suppression du folder
      const folderSetting = new Setting(singleFolderFieldset).setName(
        t.settings.folders.deleteButton ?? 'Delete folder'
      );

      folderSetting.addButton((btn) => {
        btn.setIcon('trash').onClick(async () => {
          if (this.plugin.settings.folders.length <= 1) {
            this._logger.warn('Attempted to delete last folder, forbidden.');
            new Notice(
              t.settings.folders.deleteLastForbidden ??
                'At least one folder is required.'
            );
            return;
          }
          this._logger.info('Folder deleted', { index, folder: folderCfg });
          this.plugin.settings.folders.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        });
      });

      // Dossier du vault
      const vaultSetting = new Setting(singleFolderFieldset)
        .setName(t.settings.folders.vaultLabel)
        .setDesc(t.settings.folders.vaultDescription);

      vaultSetting.addText((text) => {
        text
          .setPlaceholder('Blog')
          .setValue(folderCfg.vaultFolder)
          .onChange(async (value) => {
            this._logger.debug('Folder vaultFolder changed', { index, value });
            folderCfg.vaultFolder = value.trim();
            await this.plugin.saveSettings();
          });

        new FolderSuggest(this.app, text.inputEl);
      });

      // Route de base (côté site)
      const routeSetting = new Setting(singleFolderFieldset)
        .setName(t.settings.folders.routeLabel)
        .setDesc(t.settings.folders.routeDescription);

      routeSetting.addText((text) =>
        text
          .setPlaceholder('/blog')
          .setValue(folderCfg.routeBase)
          .onChange(async (value) => {
            let route = value.trim();
            if (!route) {
              route = '/';
            }
            if (!route.startsWith('/')) {
              route = '/' + route;
            }
            this._logger.debug('Folder routeBase changed', { index, route });
            folderCfg.routeBase = route;
            await this.plugin.saveSettings();
          })
      );

      // Sanitization : suppression des fenced code blocks (règle par défaut mais désactivable)
      const sanitizeSetting = new Setting(singleFolderFieldset)
        .setName(t.settings.folders.sanitizeRemoveCodeBlocksLabel)
        .setDesc(t.settings.folders.sanitizeRemoveCodeBlocksDescription);

      sanitizeSetting.addToggle((toggle) =>
        toggle
          .setValue(folderCfg.sanitization?.removeFencedCodeBlocks ?? true)
          .onChange(async (value) => {
            this._logger.debug('Sanitization.removeFencedCodeBlocks changed', {
              index,
              value,
            });
            if (!folderCfg.sanitization) {
              folderCfg.sanitization = { removeFencedCodeBlocks: value };
            } else {
              folderCfg.sanitization.removeFencedCodeBlocks = value;
            }
            await this.plugin.saveSettings();
          })
      );
    });

    const rowAddFolder = root.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddFolder = rowAddFolder.createEl('button', {
      text: t.settings.folders.addButton ?? 'Add folder',
    });
    btnAddFolder.addClass('mod-cta');
    btnAddFolder.onclick = async () => {
      const vpsId = settings.vpsConfigs?.[0]?.id ?? 'default';
      this._logger.info('Adding new folder config', { vpsId });
      this.plugin.settings.folders.push(createDefaultFolderConfig(vpsId));
      await this.plugin.saveSettings();
      this.display();
    };

    // -----------------------------------------------------------------------
    // #4 – Règles globales d’ignore sur le frontmatter
    // -----------------------------------------------------------------------
    const ignoreBlock = root.createDiv({ cls: 'ptpv-block' });
    const ignoreBlockTitle = ignoreBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    ignoreBlockTitle.createEl('h6', { text: t.settings.ignoreRules.title });

    const ignoreRules = settings.ignoreRules ?? [];

    ignoreRules.forEach((rule, index) => {
      const ruleSetting = new Setting(ignoreBlock).setName(
        `${t.settings.ignoreRules.valueLabel ?? 'Ignore rule'} #${index + 1}`
      );

      ruleSetting.addText((text) =>
        text
          .setPlaceholder('frontmatter property')
          .setValue(rule.property ?? '')
          .onChange(async (value) => {
            this._logger.debug('Ignore rule property changed', {
              index,
              value,
            });
            rule.property = value.trim();
            await this.plugin.saveSettings();
          })
      );

      const mode =
        rule.ignoreValues && rule.ignoreValues.length > 0
          ? 'values'
          : 'boolean';

      ruleSetting.addDropdown((dropdown) =>
        dropdown
          .addOption(
            'boolean',
            t.settings.ignoreRules.modeBoolean ?? 'Ignore if equals'
          )
          .addOption(
            'values',
            t.settings.ignoreRules.modeValues ?? 'Ignore specific values'
          )
          .setValue(mode)
          .onChange(async (value) => {
            this._logger.debug('Ignore rule mode changed', { index, value });
            if (value === 'boolean') {
              rule.ignoreValues = undefined;
              if (typeof rule.ignoreIf !== 'boolean') {
                rule.ignoreIf = true; // default
              }
            } else {
              rule.ignoreIf = undefined;
              if (!rule.ignoreValues) {
                rule.ignoreValues = ['draft'];
              }
            }
            await this.plugin.saveSettings();
            this.display();
          })
      );

      if (mode === 'boolean') {
        ruleSetting.addDropdown((dropdown) =>
          dropdown
            .addOption('true', 'true')
            .addOption('false', 'false')
            .setValue(rule.ignoreIf === false ? 'false' : 'true')
            .onChange(async (value) => {
              this._logger.debug('Ignore rule boolean value changed', {
                index,
                value,
              });
              rule.ignoreIf = value === 'true';
              await this.plugin.saveSettings();
            })
        );
      } else {
        ruleSetting.addText((text) =>
          text
            .setPlaceholder('val1, val2, val3')
            .setValue((rule.ignoreValues ?? []).join(', '))
            .onChange(async (value) => {
              this._logger.debug('Ignore rule values changed', {
                index,
                value,
              });
              rule.ignoreValues = value
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v.length > 0);
              await this.plugin.saveSettings();
            })
        );
      }

      ruleSetting.addExtraButton((btn) =>
        btn
          .setIcon('trash')
          .setTooltip(
            t.settings.ignoreRules.deleteButton ?? 'Delete ignore rule'
          )
          .onClick(async () => {
            this._logger.info('Ignore rule deleted', { index, rule });
            settings.ignoreRules?.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
    });

    const rowAddIgnoreRule = root.createDiv({
      cls: 'ptpv-button-row',
    });
    const btnAddIgnoreRule = rowAddIgnoreRule.createEl('button', {
      text: t.settings.ignoreRules.addButton ?? 'Add ignore rule',
    });
    btnAddIgnoreRule.addClass('mod-cta');
    btnAddIgnoreRule.onclick = async () => {
      const rules = settings.ignoreRules ?? [];
      this._logger.info('Adding new ignore rule');
      rules.push({
        property: 'publish',
        ignoreIf: false,
      });
      settings.ignoreRules = rules;
      await this.plugin.saveSettings();
      this.display();
    };

    // -----------------------------------------------------------------------
    // #5 – VPS (unique pour l’instant) + test de connexion
    // -----------------------------------------------------------------------
    const vpsBlock = root.createDiv({ cls: 'ptpv-block' });
    const vpsBlockTitle = vpsBlock.createDiv({
      cls: 'ptpv-block-title',
    });
    vpsBlockTitle.createEl('h6', { text: t.settings.vps.title });

    new Setting(vpsBlock)
      .setName(t.settings.vps.nameLabel)
      .setDesc(t.settings.vps.nameDescription)
      .addText((text) =>
        text
          .setPlaceholder('VPS')
          .setValue(vps.name)
          .onChange(async (value) => {
            this._logger.debug('VPS name changed', { value });
            vps.name = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(vpsBlock)
      .setName(t.settings.vps.urlLabel)
      .setDesc(t.settings.vps.urlDescription)
      .addText((text) =>
        text
          .setPlaceholder('https://...')
          .setValue(vps.url)
          .onChange(async (value) => {
            this._logger.debug('VPS url changed', { value });
            vps.url = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(vpsBlock)
      .setName(t.settings.vps.apiKeyLabel)
      .setDesc(t.settings.vps.apiKeyDescription)
      .addText((text) =>
        text
          .setPlaceholder('********')
          .setValue(vps.apiKey)
          .onChange(async (value) => {
            this._logger.debug('VPS apiKey changed');
            vps.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

    vpsBlock.createDiv({
      cls: 'ptpv-help',
      text: t.settings.vps.help,
    });

    // Bouton de test de connexion
    const rowTestConnection = root.createDiv({
      cls: 'ptpv-button-row',
    });
    const testBtn = rowTestConnection.createEl('button', {
      text: t.settings.testConnection.label ?? 'Test connection',
    });
    testBtn.addClass('mod-cta');
    testBtn.onclick = async () => {
      try {
        this._logger.info('Testing VPS connection');
        await this.plugin.testConnection();
        this._logger.info('VPS connection test succeeded');
      } catch (e) {
        this._logger.error('VPS connection test failed', e);
        console.error('Connection test failed', e);
      }
    };
  }
}
