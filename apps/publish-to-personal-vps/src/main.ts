import { Notice, Plugin, RequestUrlResponse } from 'obsidian';

import type { PublishPluginSettings } from '@core-domain/entities/publish-plugin-settings';
import { getTranslations } from './i18n';
import type { PluginSettings } from './lib/settings/plugin-settings.type';

import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { testVpsConnection } from './lib/services/http-connection.service';
import { PublishToPersonalVpsSettingTab } from './lib/setting-tab.view';

import { PublishNotesCommandHandler } from '@core-application/vault-parsing/commands/publish-notes.command';
import {
  extractNotesWithAssets,
  type NoteWithAssets,
} from '@core-domain/entities/note-with-assets';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import { PublishAssetsCommandHandler } from '@core-application/vault-parsing/commands/publish-assets.command';
import { ObsidianAssetsVaultAdapter } from './lib/infra/obsidian-assets-vault.adapter';

import { HttpResponse } from '@core-domain/entities/http-response';
import { HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { AssetsUploaderAdapter } from './lib/infra/assets-uploader.adapter';
import { ConsoleLoggerAdapter } from './lib/infra/console-logger.adapter';
import { NotesUploaderAdapter } from './lib/infra/notes-uploader.adapter';
import { RequestUrlResponseMapper } from './lib/utils/http-response-status.mapper';
import { SessionApiClient } from './lib/services/session-api.client';
import { GuidGeneratorAdapter } from './lib/infra/guid-generator.adapter';
import { NoticeProgressAdapter } from './lib/infra/notice-progress.adapter';
import { ObsidianVaultAdapter } from './lib/infra/obsidian-vault.adapter';
import type { UploaderPort } from '@core-domain/ports/uploader-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';

const defaultSettings: PluginSettings = {
  vpsConfigs: [],
  folders: [],
  ignoreRules: [],
  locale: 'system',
  assetsFolder: 'assets',
  enableAssetsVaultFallback: true,
  frontmatterKeysToExclude: [],
  frontmatterTagsToExclude: [],
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

class CollectingUploader implements UploaderPort {
  notes: PublishableNote[] = [];
  constructor(private readonly logger: LoggerPort) {}

  async upload(notes: PublishableNote[]): Promise<boolean> {
    this.notes.push(...notes);
    this.logger.debug('Collected notes for deferred upload', { count: notes.length });
    return true;
  }
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
      (res: RequestUrlResponse) => new RequestUrlResponseMapper(this.logger).execute(res),
      this.logger
    );

    this.addSettingTab(new PublishToPersonalVpsSettingTab(this.app, this, this.logger));

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
      ...defaultSettings,
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
      new Notice('?? No folders configured for publishing.');
      return;
    }

    // const vps = settings.vpsConfigs[0];
    // const scopedLogger = this.logger.child({ vps: vps.id ?? 'default' });
    // const guidGenerator = new GuidGeneratorAdapter();
    // const vault = new ObsidianVaultAdapter(this.app, guidGenerator, scopedLogger);
    // const notesCollector = new CollectingUploader(scopedLogger);
    // const publishNotesHandler = new PublishNotesCommandHandler(
    //   vault,
    //   notesCollector,
    //   scopedLogger
    // );
    // const notesProgress = new NoticeProgressAdapter();
    // const coreSettings = buildCoreSettings(settings);

    // const result = await publishNotesHandler.execute({
    //   settings: coreSettings,
    //   progress: notesProgress,
    // });

    // if (result.type === 'noConfig') {
    //   new Notice('?? No folders or VPS configured.');
    //   return;
    // }

    // if (result.type === 'missingVpsConfig') {
    //   this.logger.warn('Missing VPS for folders:', result.foldersWithoutVps);
    //   new Notice('?? Some folder(s) have no VPS configured (see console).');
    //   return;
    // }

    // if (result.type === 'error') {
    //   this.logger.error('Error during publishing: ', result.error);
    //   new Notice('? Error during publishing (see console).');
    //   return;
    // }

    // const notes = notesCollector.notes ?? result.notes ?? [];
    // if (notes.length === 0) {
    //   new Notice('?? Nothing to publish (0 note).');
    //   return;
    // }

    // const notesWithAssets = extractNotesWithAssets(notes);
    // const assetsPlanned = new Set(
    //   notesWithAssets.flatMap((n) => n.assets?.map((a) => a.target) ?? [])
    // ).size;

    // const sessionClient = new SessionApiClient(
    //   vps.url,
    //   vps.apiKey,
    //   this.responseHandler,
    //   this.logger
    // );

    // let sessionId = null;
    // const maxBytesRequested = 5 * 1024 * 1024;
    // let maxBytesPerRequest = maxBytesRequested;
    // let assetsUploaded = 0;

    // try {
    //   const started = await sessionClient.startSession({
    //     notesPlanned: notes.length,
    //     assetsPlanned: assetsPlanned,
    //     maxBytesPerRequest: maxBytesRequested,
    //   });
    //   sessionId = started.sessionId;
    //   maxBytesPerRequest = started.maxBytesPerRequest;
    //   this.logger.info('Session started', { sessionId, maxBytesPerRequest });

    //   const notesUploader = new NotesUploaderAdapter(
    //     sessionClient,
    //     sessionId,
    //     this.logger,
    //     maxBytesPerRequest
    //   );
    //   await notesUploader.upload(notes);

    //   if (notesWithAssets.length > 0) {
    //     const assetsVault = new ObsidianAssetsVaultAdapter(this.app, this.logger);
    //     const assetsUploader = new AssetsUploaderAdapter(
    //       sessionClient,
    //       sessionId,
    //       this.logger,
    //       maxBytesPerRequest
    //     );
    //     const publishAssetsUsecase = new PublishAssetsCommandHandler(
    //       assetsVault,
    //       assetsUploader,
    //       this.logger
    //     );
    //     const assetsProgress = new NoticeProgressAdapter();

    //     const assetsResult = await publishAssetsUsecase.execute({
    //       notes: notesWithAssets,
    //       assetsFolder: settings.assetsFolder,
    //       enableAssetsVaultFallback: settings.enableAssetsVaultFallback,
    //       progress: assetsProgress,
    //     });

    //     if (assetsResult.type === 'error') {
    //       throw assetsResult.error ?? new Error('Asset publication failed');
    //     }
    //     assetsUploaded = assetsResult.type === 'success' ? assetsResult.publishedAssetsCount : 0;

    //     if (assetsResult.type === 'success' && assetsResult.failures.length > 0) {
    //       this.logger.warn('Some assets failed to upload', {
    //         failures: assetsResult.failures,
    //       });
    //     }
    //   }

    //   await sessionClient.finishSession(sessionId, {
    //     notesProcessed: notes.length,
    //     assetsProcessed: assetsUploaded,
    //   });

    //   new Notice(
    //     '' +
    //       ('? Published ' +
    //         notes.length +
    //         ' note(s)' +
    //         (assetsPlanned ? ' and ' + assetsUploaded + ' asset(s)' : '') +
    //         '.')
    //   );
    // } catch (err) {
    //   this.logger.error('Publishing failed, aborting session if created', err);
    //   if (sessionId) {
    //     try {
    //       await sessionClient.abortSession(sessionId);
    //     } catch (abortErr) {
    //       this.logger.error('Failed to abort session', abortErr);
    //     }
    //   }
    //   new Notice('? Publishing failed (see console).');
    // }
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
    const res: HttpResponse = await testVpsConnection(vps, this.responseHandler, this.logger);

    if (!res.isError) {
      this.logger.info('VPS connection test succeeded');
      this.logger.info(`Test connection message: ${res.text}`);
      new Notice(t.settings.testConnection.success);
    } else {
      this.logger.error('VPS connection test failed: ', res.error);
      new Notice(
        `${t.settings.testConnection.failed} ${
          res.error instanceof Error ? res.error.message : JSON.stringify(res.error)
        }`
      );
    }
  }
}
