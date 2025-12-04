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
import { CollectedNote, LogLevel, VpsConfig } from '@core-domain';
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
import { NoticeProgressAdapter } from './lib/infra/notice-progress.adapter';
import { ObsidianVaultAdapter } from './lib/infra/obsidian-vault.adapter';
import { testVpsConnection } from './lib/services/http-connection.service';
import { SessionApiClient } from './lib/services/session-api.client';
import { ObsidianVpsPublishSettingTab } from './lib/setting-tab.view';
import type { PluginSettings } from './lib/settings/plugin-settings.type';
import { RequestUrlResponseMapper } from './lib/utils/http-response-status.mapper';
import { DEFAULT_LOGGER_LEVEL } from './lib/constants/default-logger-level.constant';

const defaultSettings: PluginSettings = {
  vpsConfigs: [],
  folders: [],
  ignoreRules: [],
  locale: 'system',
  assetsFolder: 'assets',
  enableAssetsVaultFallback: true,
  frontmatterKeysToExclude: [],
  frontmatterTagsToExclude: [],
  logLevel: DEFAULT_LOGGER_LEVEL,
  calloutStylePaths: [],
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

    this.logger.level = this.settings.logLevel ?? DEFAULT_LOGGER_LEVEL;
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
      new Notice('No folders configured for publishing.');
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

    const publishableCount = publishables.length;
    const notesWithAssets = publishables.filter((n) => n.assets && n.assets.length > 0);
    const assetsPlanned = notesWithAssets.reduce(
      (sum, n) => sum + (Array.isArray(n.assets) ? n.assets.length : 0),
      0
    );

    scopedLogger.info('Total notes collected and parsed', {
      collected: notes.length,
      publishable: publishableCount,
    });

    if (publishableCount === 0) {
      this.logger.warn('No publishable notes after filtering; aborting upload.');
      new Notice('No publishable notes to upload.');
      return;
    }

    const sessionClient = new SessionApiClient(
      vps.url,
      vps.apiKey,
      this.responseHandler,
      this.logger
    );
    const calloutStyles = await this.loadCalloutStyles(settings.calloutStylePaths ?? []);

    let sessionId = null;
    const maxBytesRequested = 5 * 1024 * 1024;
    let maxBytesPerRequest = maxBytesRequested;
    let assetsUploaded = 0;
    const totalPlanned = publishableCount + assetsPlanned;
    const progress = totalPlanned > 0 ? new NoticeProgressAdapter('Publishing to VPS') : null;
    let progressStarted = false;

    try {
      const started = await sessionClient.startSession({
        notesPlanned: publishableCount,
        assetsPlanned: assetsPlanned,
        maxBytesPerRequest: maxBytesRequested,
        calloutStyles,
      });

      sessionId = started.sessionId;
      maxBytesPerRequest = started.maxBytesPerRequest;
      this.logger.info('Session started', { sessionId, maxBytesPerRequest });

      if (progress && !progressStarted) {
        progress.start(totalPlanned);
        progressStarted = true;
      }

      const notesUploader = new NotesUploaderAdapter(
        sessionClient,
        sessionId,
        this.logger,
        maxBytesPerRequest,
        progress ?? undefined
      );
      await notesUploader.upload(publishables);

      if (notesWithAssets.length > 0) {
        const assetsVault = new ObsidianAssetsVaultAdapter(this.app, this.logger);
        const assetsUploader = new AssetsUploaderAdapter(
          sessionClient,
          sessionId,
          this.logger,
          maxBytesPerRequest,
          progress ?? undefined
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
        notesProcessed: publishableCount,
        assetsProcessed: assetsUploaded,
      });

      if (progressStarted) {
        progress?.finish();
      }

      const successMsg = `Published ${publishableCount} note(s)${
        assetsPlanned ? ` and ${assetsUploaded} asset(s)` : ''
      }.`;
      new Notice(successMsg);
    } catch (err) {
      this.logger.error('Publishing failed, aborting session if created', err);
      if (sessionId) {
        try {
          await sessionClient.abortSession(sessionId);
        } catch (abortErr) {
          this.logger.error('Failed to abort session', abortErr);
        }
      }
      if (progressStarted) {
        progress?.finish();
      }
      new Notice('Publishing failed (see console).');
    }
  }

  private async loadCalloutStyles(paths: string[]): Promise<Array<{ path: string; css: string }>> {
    const styles: Array<{ path: string; css: string }> = [];
    const adapter: any = this.app.vault.adapter;

    for (const raw of paths ?? []) {
      const path = raw.trim();
      if (!path) continue;

      try {
        const exists = await adapter.exists(path);
        if (!exists) {
          this.logger.warn('Callout style path not found', { path });
          continue;
        }
        const css = await adapter.read(path);
        styles.push({ path, css });
      } catch (err) {
        this.logger.error('Failed to read callout style', { path, err });
      }
    }

    if (styles.length) {
      this.logger.info('Loaded callout styles', { count: styles.length });
    }

    return styles;
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

  // ---------------------------------------------------------------------------
  // VPS Maintenance
  // ---------------------------------------------------------------------------
  async cleanupVps(target: VpsConfig, confirmationName: string): Promise<void> {
    if (!target) {
      throw new Error('Missing VPS configuration');
    }

    const targetName = (target.name ?? '').trim();
    if (!targetName) {
      throw new Error('Missing VPS name');
    }
    if (!target.url) {
      throw new Error('Invalid VPS URL');
    }
    if (!target.apiKey) {
      throw new Error('Missing API key');
    }
    if (confirmationName !== targetName) {
      throw new Error('Confirmation name mismatch');
    }

    const clientLogger = this.logger.child({ vps: target.id ?? targetName });
    const client = new SessionApiClient(
      target.url,
      target.apiKey,
      this.responseHandler,
      clientLogger
    );

    await client.cleanupVps(confirmationName);
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
