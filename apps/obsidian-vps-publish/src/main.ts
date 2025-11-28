import { EvaluateIgnoreRulesHandler } from '@core-application/vault-parsing/handler/evaluate-ignore-rules.handler';
import { HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { ParseContentHandler } from '@core-application/vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '@core-application/vault-parsing/mappers/notes.mapper';
import { ComputeRoutingService } from '@core-application/vault-parsing/services/compute-routing.service';
import { ContentSanitizerService } from '@core-application/vault-parsing/services/content-sanitizer.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectWikilinksService } from '@core-application/vault-parsing/services/detect-wikilinks.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '@core-application/vault-parsing/services/resolve-wikilinks.service';
import { CollectedNote, LogLevel } from '@core-domain';
import { HttpResponse } from '@core-domain/entities/http-response';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { Notice, Plugin, RequestUrlResponse } from 'obsidian';
import { getTranslations } from './i18n';
import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { AssetsUploaderAdapter } from './lib/infra/assets-uploader.adapter';
import { ConsoleLoggerAdapter } from './lib/infra/console-logger.adapter';
import { GuidGeneratorAdapter } from './lib/infra/guid-generator.adapter';
import { NotesUploaderAdapter } from './lib/infra/notes-uploader.adapter';
import { ObsidianAssetsVaultAdapter } from './lib/infra/obsidian-assets-vault.adapter';
import { ObsidianVaultAdapter } from './lib/infra/obsidian-vault.adapter';
import { testVpsConnection } from './lib/services/http-connection.service';
import { SessionApiClient } from './lib/services/session-api.client';
import { ObsidianVpsPublishSettingTab } from './lib/setting-tab.view';
import type { PluginSettings } from './lib/settings/plugin-settings.type';
import { RequestUrlResponseMapper } from './lib/utils/http-response-status.mapper';

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

// -----------------------------------------------------------------------------
// Main Plugin Class
// -----------------------------------------------------------------------------

export default class ObsidianVpsPublishPlugin extends Plugin {
  settings!: PluginSettings;
  responseHandler!: HttpResponseHandler<RequestUrlResponse>;
  logger = new ConsoleLoggerAdapter({ plugin: 'ObsidianVpsPublish' });

  async onload() {
    await this.loadSettings();
    const { t } = getTranslations(this.app, this.settings);

    this.logger.debug('Plugin loading...');

    this.responseHandler = new HttpResponseHandler<RequestUrlResponse>(
      (res: RequestUrlResponse) => new RequestUrlResponseMapper(this.logger).execute(res),
      this.logger
    );

    this.addSettingTab(new ObsidianVpsPublishSettingTab(this.app, this, this.logger));

    this.addCommand({
      id: 'obsidian-vps-publish',
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

    const vps = settings.vpsConfigs[0];
    const scopedLogger = this.logger.child({ vps: vps.id ?? 'default' });
    const guidGenerator = new GuidGeneratorAdapter();
    const vault = new ObsidianVaultAdapter(this.app, guidGenerator, scopedLogger);

    let notes: CollectedNote[] = await vault.collectFromFolder({
      folderConfig: settings.folders,
    });

    const parseContentHandler = this.buildParseContentHandler(settings, scopedLogger);
    let publishables = await parseContentHandler.handle(notes);

    const notesWithAssets = publishables.filter((n) => n.assets && n.assets.length > 0);
    const assetsPlanned = notesWithAssets.reduce(
      (sum, n) => sum + (Array.isArray(n.assets) ? n.assets.length : 0),
      0
    );

    scopedLogger.info('Total notes collected and parsed', { count: notes.length });

    const sessionClient = new SessionApiClient(
      vps.url,
      vps.apiKey,
      this.responseHandler,
      this.logger
    );

    let sessionId = null;
    const maxBytesRequested = 5 * 1024 * 1024;
    let maxBytesPerRequest = maxBytesRequested;
    let assetsUploaded = 0;

    try {
      const started = await sessionClient.startSession({
        notesPlanned: notes.length,
        assetsPlanned: assetsPlanned,
        maxBytesPerRequest: maxBytesRequested,
      });

      sessionId = started.sessionId;
      maxBytesPerRequest = started.maxBytesPerRequest;
      this.logger.info('Session started', { sessionId, maxBytesPerRequest });

      const notesUploader = new NotesUploaderAdapter(
        sessionClient,
        sessionId,
        this.logger,
        maxBytesPerRequest
      );
      await notesUploader.upload(publishables);

      if (notesWithAssets.length > 0) {
        const assetsVault = new ObsidianAssetsVaultAdapter(this.app, this.logger);
        const assetsUploader = new AssetsUploaderAdapter(
          sessionClient,
          sessionId,
          this.logger,
          maxBytesPerRequest
        );

        const resolvedAssets = await assetsVault.resolveAssetsFromNotes(
          notesWithAssets,
          settings.assetsFolder,
          settings.enableAssetsVaultFallback
        );
        assetsUploaded = resolvedAssets.length;

        await assetsUploader.upload(resolvedAssets);

        this.logger.info('Assets uploaded', { assetsUploaded });
      }

      await sessionClient.finishSession(sessionId, {
        notesProcessed: notes.length,
        assetsProcessed: assetsUploaded,
      });

      new Notice(
        '' +
          ('Published ' +
            notes.length +
            ' note(s)' +
            (assetsPlanned ? ' and ' + assetsUploaded + ' asset(s)' : '') +
            '.')
      );
    } catch (err) {
      this.logger.error('Publishing failed, aborting session if created', err);
      if (sessionId) {
        try {
          await sessionClient.abortSession(sessionId);
        } catch (abortErr) {
          this.logger.error('Failed to abort session', abortErr);
        }
      }
      new Notice('❌ Publishing failed (see console).');
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

  private buildParseContentHandler(
    settings: PluginSettings,
    logger: LoggerPort
  ): ParseContentHandler {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(logger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(
      settings.ignoreRules ?? [],
      logger
    );
    const noteMapper = new NotesMapper();
    const inlineDataviewRenderer = new RenderInlineDataviewService(logger);
    const contentSanitizer = new ContentSanitizerService(
      [],
      settings.frontmatterKeysToExclude ?? [],
      settings.frontmatterTagsToExclude ?? [],
      logger
    );
    const assetsDetector = new DetectAssetsService(logger);
    const detectWikilinks = new DetectWikilinksService(logger);
    const resolveWikilinks = new ResolveWikilinksService(logger, detectWikilinks);
    const computeRoutingService = new ComputeRoutingService(logger);

    return new ParseContentHandler(
      normalizeFrontmatterService,
      evaluateIgnoreRulesHandler,
      noteMapper,
      inlineDataviewRenderer,
      contentSanitizer,
      assetsDetector,
      resolveWikilinks,
      computeRoutingService,
      logger
    );
  }
}
