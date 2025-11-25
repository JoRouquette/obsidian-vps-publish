import { Notice, Plugin, RequestUrlResponse } from 'obsidian';

import type { PublishPluginSettings } from '@core-domain/publish/PublishPluginSettings';
import type { I18nSettings } from './i18n';
import { getTranslations } from './i18n';

import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { GuidGeneratorAdapter } from './lib/guid-generator.adapter';
import { NoticeProgressAdapter } from './lib/notice-progress.adapter';
import { ObsidianVaultAdapter } from './lib/obsidian-vault.adapter';
import { testVpsConnection } from './lib/services/http-connection.service';
import { PublishToPersonalVpsSettingTab } from './lib/setting-tab';

import { PublishToSiteUseCase } from '@core-application/publish/usecases/publish-notes-to-site.usecase';
import {
  extractNotesWithAssets,
  type NoteWithAssets,
} from '@core-domain/publish/NoteWithAssets';
import type { PublishableNote } from '@core-domain/publish/PublishableNote';
import { PublishAssetsToSiteUseCase } from '@core-application/publish/usecases/publish-assets-to-site.usecase';
import { ObsidianAssetsVaultAdapter } from './lib/obsidian-assets-vault.adapter';

import { HttpResponse } from '@core-domain/publish/HttpResponse';
import { HttpResponseHandler } from '@core-application/publish/handler/http-response.handler';
import { AssetsUploaderAdapter } from './lib/assets-uploader.adapter';
import { ConsoleLoggerAdapter } from './lib/console-logger.adapter';
import { NotesUploaderAdapter } from './lib/notes-uploader.adapter';
import { RequestUrlResponseMapper } from './lib/utils/HttpResponseStatus.mapper';

// -----------------------------------------------------------------------------
// Types & Constants
// -----------------------------------------------------------------------------

type PluginLocale = 'en' | 'fr' | 'system';

type PluginSettings = PublishPluginSettings &
  I18nSettings & {
    locale?: PluginLocale;
    assetsFolder: string;
    enableAssetsVaultFallback: boolean;
  };

const DEFAULT_SETTINGS: PluginSettings = {
  vpsConfigs: [],
  folders: [],
  ignoreRules: [],
  locale: 'system',
  assetsFolder: 'assets',
  enableAssetsVaultFallback: true,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function cloneSettings(settings: PluginSettings): PluginSettings {
  return JSON.parse(JSON.stringify(settings));
}

function withEncryptedApiKeys(settings: PluginSettings): PluginSettings {
  const cloned = cloneSettings(settings);
  if (Array.isArray(cloned.vpsConfigs)) {
    cloned.vpsConfigs = cloned.vpsConfigs.map((vps) => ({
      ...vps,
      apiKey: encryptApiKey(vps.apiKey),
    }));
  }
  return cloned;
}

function withDecryptedApiKeys(settings: PluginSettings): PluginSettings {
  const cloned = cloneSettings(settings);
  if (Array.isArray(cloned.vpsConfigs)) {
    cloned.vpsConfigs = cloned.vpsConfigs.map((vps) => ({
      ...vps,
      apiKey: decryptApiKey(vps.apiKey),
    }));
  }
  return cloned;
}

function buildCoreSettings(settings: PluginSettings): PublishPluginSettings {
  const { vpsConfigs, folders, ignoreRules } = settings;
  return { vpsConfigs, folders, ignoreRules };
}

// -----------------------------------------------------------------------------
// Main Plugin Class
// -----------------------------------------------------------------------------

export default class PublishToPersonalVpsPlugin extends Plugin {
  settings!: PluginSettings;
  responseHandler!: HttpResponseHandler<RequestUrlResponse>;
  logger = new ConsoleLoggerAdapter({ plugin: 'PublishToPersonalVps' });

  async onload() {
    await this.loadSettings();
    const { t } = getTranslations(this.app, this.settings);

    this.logger.debug('Plugin loading...');

    this.responseHandler = new HttpResponseHandler<RequestUrlResponse>(
      (res: RequestUrlResponse) =>
        new RequestUrlResponseMapper(this.logger).execute(res),
      this.logger
    );

    this.addSettingTab(
      new PublishToPersonalVpsSettingTab(this.app, this, this.logger)
    );

    this.addCommand({
      id: 'publish-to-personal-vps',
      name: t.plugin.commandPublish,
      callback: async () => this.publishToSiteAsync(),
    });

    this.addCommand({
      id: 'test-vps-connection',
      name: t.plugin.commandTestConnection,
      callback: async () => this.testConnection(),
    });

    this.addCommand({
      id: 'open-vps-settings',
      name: t.plugin.commandOpenSettings,
      callback: () => {
        // @ts-ignore
        this.app.setting.open();
        // @ts-ignore
        this.app.setting.openTabById(`${this.manifest.id}`);
      },
    });

    this.addRibbonIcon('rocket', t.plugin.commandPublish, async () => {
      try {
        await this.publishToSiteAsync();
      } catch (e) {
        console.error('Publish failed from ribbon', e);
        new Notice(t.plugin.publishError);
      }
    });

    this.logger.debug('Plugin loaded.');
  }

  // ---------------------------------------------------------------------------
  // Settings Management
  // ---------------------------------------------------------------------------
  async loadSettings() {
    const internalRaw = (await this.loadData()) ?? {};
    let snapshotRaw: any = null;
    try {
      const adapter: any = this.app.vault.adapter;
      const pluginDir = `.obsidian/plugins/${this.manifest.id}`;
      const filePath = `${pluginDir}/settings.json`;
      if (await adapter.exists(filePath)) {
        const content = await adapter.read(filePath);
        snapshotRaw = JSON.parse(content);
      }
    } catch (e) {
      this.logger.error('Failed to load snapshot settings', e);
    }
    const merged: PluginSettings = {
      ...DEFAULT_SETTINGS,
      ...(internalRaw as Partial<PluginSettings>),
      ...(snapshotRaw as Partial<PluginSettings>),
    };
    this.settings = withDecryptedApiKeys(merged);
  }

  async saveSettings() {
    const toPersist = withEncryptedApiKeys(this.settings);
    await this.saveData(toPersist);
  }

  // ---------------------------------------------------------------------------
  // Publishing Logic
  // ---------------------------------------------------------------------------
  async publishToSiteAsync() {
    const settings = this.settings;
    const { t } = getTranslations(this.app, this.settings);

    if (!settings.vpsConfigs || settings.vpsConfigs.length === 0) {
      this.logger.error('No VPS config defined');
      new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
      return;
    }
    if (!settings.folders || settings.folders.length === 0) {
      this.logger.warn('No folders configured');
      new Notice('⚠️ No folders configured for publishing.');
      return;
    }

    const vps = settings.vpsConfigs[0];
    const vault = new ObsidianVaultAdapter(this.app, this.logger);
    const guidGenerator = new GuidGeneratorAdapter();
    const notesUploader = new NotesUploaderAdapter(
      vps,
      this.responseHandler,
      this.logger
    );
    const publishNotesUsecase = new PublishToSiteUseCase(
      vault,
      notesUploader,
      guidGenerator,
      this.logger
    );
    const notesProgress = new NoticeProgressAdapter();
    const coreSettings = buildCoreSettings(settings);

    const result = await publishNotesUsecase.execute(
      coreSettings,
      notesProgress
    );

    if (result.type === 'noConfig') {
      new Notice('⚠️ No folders or VPS configured.');
      return;
    }

    if (result.type === 'missingVpsConfig') {
      this.logger.warn('Missing VPS for folders:', result.foldersWithoutVps);
      new Notice('⚠️ Some folder(s) have no VPS configured (see console).');
      return;
    }

    if (result.type === 'error') {
      this.logger.error('Error during publishing: ', result.error);
      new Notice('❌ Error during publishing (see console).');
      return;
    }

    const publishedNotesCount = result.publishedCount;
    const notes: PublishableNote[] = result.notes ?? [];
    if (publishedNotesCount === 0) {
      new Notice('✅ Nothing to publish (0 note).');
      return;
    }

    const notesWithAssets: NoteWithAssets[] = extractNotesWithAssets(notes);
    if (notesWithAssets.length === 0) {
      new Notice(
        `✅ Published ${publishedNotesCount} note(s). No assets to publish.`
      );
      return;
    }

    const assetsVault = new ObsidianAssetsVaultAdapter(this.app, this.logger);
    const assetsUploader = new AssetsUploaderAdapter(
      vps,
      this.responseHandler,
      this.logger
    );
    const publishAssetsUsecase = new PublishAssetsToSiteUseCase(
      assetsVault,
      assetsUploader,
      this.logger
    );
    const assetsProgress = new NoticeProgressAdapter();

    const assetsResult = await publishAssetsUsecase.execute({
      notes: notesWithAssets,
      assetsFolder: settings.assetsFolder,
      enableAssetsVaultFallback: settings.enableAssetsVaultFallback,
      progress: assetsProgress,
    });

    switch (assetsResult.type) {
      case 'noAssets':
        new Notice(
          `✅ Published ${publishedNotesCount} note(s). No assets to publish.`
        );
        break;
      case 'error':
        this.logger.error('Error while publishing assets:', assetsResult.error);
        new Notice(
          `✅ Published ${publishedNotesCount} note(s), but assets publication failed (see console).`
        );
        break;
      case 'success': {
        const { publishedAssetsCount, failures } = assetsResult;
        if (failures.length > 0) {
          this.logger.warn('Some assets failed to publish:', failures);
          new Notice(
            `✅ Published ${publishedNotesCount} note(s) and ${publishedAssetsCount} asset(s), with ${failures.length} asset failure(s) (see console).`
          );
        } else {
          new Notice(
            `✅ Published ${publishedNotesCount} note(s) and ${publishedAssetsCount} asset(s).`
          );
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // VPS Connection Test
  // ---------------------------------------------------------------------------
  async testConnection(): Promise<void> {
    const { t } = getTranslations(this.app, this.settings);
    const settings = this.settings;

    if (!settings?.vpsConfigs || settings.vpsConfigs.length === 0) {
      this.logger.error('No VPS config defined');
      new Notice(t.settings.errors.missingVpsConfig);
      return;
    }

    const vps = settings.vpsConfigs[0];
    const res: HttpResponse = await testVpsConnection(
      vps,
      this.responseHandler,
      this.logger
    );

    if (!res.isError) {
      this.logger.info('VPS connection test succeeded');
      this.logger.info(`Test connection message: ${res.text}`);
      new Notice(t.settings.testConnection.success);
    } else {
      this.logger.error('VPS connection test failed: ', res.error);
      new Notice(
        `${t.settings.testConnection.failed} ${
          res.error instanceof Error
            ? res.error.message
            : JSON.stringify(res.error)
        }`
      );
    }
  }
}
