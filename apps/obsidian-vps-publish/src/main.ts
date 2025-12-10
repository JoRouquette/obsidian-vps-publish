import { EvaluateIgnoreRulesHandler } from '@core-application/vault-parsing/handler/evaluate-ignore-rules.handler';
import { HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { ParseContentHandler } from '@core-application/vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '@core-application/vault-parsing/mappers/notes.mapper';
import { ComputeRoutingService } from '@core-application/vault-parsing/services/compute-routing.service';
import { ContentSanitizerService } from '@core-application/vault-parsing/services/content-sanitizer.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectWikilinksService } from '@core-application/vault-parsing/services/detect-wikilinks.service';
import { EnsureTitleHeaderService } from '@core-application/vault-parsing/services/ensure-title-header.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '@core-application/vault-parsing/services/resolve-wikilinks.service';
import { type CollectedNote, type VpsConfig } from '@core-domain';
import { type HttpResponse } from '@core-domain/entities/http-response';
import { ProgressStepId, ProgressStepStatus } from '@core-domain/entities/progress-step';
import {
  createPublishingStats,
  formatPublishingStats,
  type PublishingStats,
} from '@core-domain/entities/publishing-stats';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type DataAdapter, Notice, Plugin, type RequestUrlResponse } from 'obsidian';

import { getTranslations } from './i18n';
import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { DEFAULT_LOGGER_LEVEL } from './lib/constants/default-logger-level.constant';
import { AssetsUploaderAdapter } from './lib/infra/assets-uploader.adapter';
import { ConsoleLoggerAdapter } from './lib/infra/console-logger.adapter';
import { GuidGeneratorAdapter } from './lib/infra/guid-generator.adapter';
import { NotesUploaderAdapter } from './lib/infra/notes-uploader.adapter';
import { NoticeNotificationAdapter } from './lib/infra/notice-notification.adapter';
import { NoticeProgressAdapter } from './lib/infra/notice-progress.adapter';
import { ObsidianAssetsVaultAdapter } from './lib/infra/obsidian-assets-vault.adapter';
import { ObsidianVaultAdapter } from './lib/infra/obsidian-vault.adapter';
import { createStepMessages } from './lib/infra/step-messages.factory';
import { StepProgressManagerAdapter } from './lib/infra/step-progress-manager.adapter';
import { testVpsConnection } from './lib/services/http-connection.service';
import { SessionApiClient } from './lib/services/session-api.client';
import { ObsidianVpsPublishSettingTab } from './lib/setting-tab.view';
import type { PluginSettings } from './lib/settings/plugin-settings.type';
import { enrichCleanupRules } from './lib/utils/create-default-folder-config.util';
import { RequestUrlResponseMapper } from './lib/utils/http-response-status.mapper';
import { selectVpsOrAuto } from './lib/utils/vps-selector';

const defaultSettings: PluginSettings = {
  vpsConfigs: [],
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
      id: 'vps-publish',
      name: t.plugin.commandPublish,
      callback: async () => {
        if (!this.settings.vpsConfigs || this.settings.vpsConfigs.length === 0) {
          new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
          return;
        }
        selectVpsOrAuto(this.app, this.settings.vpsConfigs, async (vps) => {
          await this.uploadToVps(vps);
        });
      },
    });

    this.addCommand({
      id: 'test-vps-connection',
      name: t.plugin.commandTestConnection,
      callback: async () => {
        if (!this.settings.vpsConfigs || this.settings.vpsConfigs.length === 0) {
          new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
          return;
        }
        selectVpsOrAuto(this.app, this.settings.vpsConfigs, async (vps) => {
          await this.testConnectionForVps(vps);
        });
      },
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
        if (!this.settings.vpsConfigs || this.settings.vpsConfigs.length === 0) {
          new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
          return;
        }
        selectVpsOrAuto(this.app, this.settings.vpsConfigs, async (vps) => {
          await this.uploadToVps(vps);
        });
      } catch (e) {
        this.logger.error('Publish failed from ribbon', e);
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
    let snapshotRaw: unknown = null;
    try {
      const adapter = this.app.vault.adapter;
      const pluginDir = `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
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

    // Enrich cleanup rules with default metadata (translation keys, isDefault flag)
    if (merged.vpsConfigs && Array.isArray(merged.vpsConfigs)) {
      merged.vpsConfigs = merged.vpsConfigs.map((vps) => ({
        ...vps,
        cleanupRules: enrichCleanupRules(vps.cleanupRules || []),
      }));
    }

    this.settings = withDecryptedApiKeys(merged);
  }

  async saveSettings() {
    const toPersist = withEncryptedApiKeys(this.settings);
    await this.saveData(toPersist);
  }

  async testConnectionForVps(vps: VpsConfig): Promise<void> {
    const { t } = getTranslations(this.app, this.settings);
    const res: HttpResponse = await testVpsConnection(vps, this.responseHandler, this.logger);

    if (!res.isError) {
      this.logger.debug('VPS connection test succeeded', { vpsId: vps.id });
      this.logger.debug(`Test connection message: ${res.text}`);
      new Notice(t.settings.testConnection.success);
    } else {
      this.logger.error('VPS connection test failed', { vpsId: vps.id, error: res.error });
      new Notice(
        `${t.settings.testConnection.failed} ${
          res.error instanceof Error ? res.error.message : JSON.stringify(res.error)
        }`
      );
    }
  }

  async uploadToVps(vps: VpsConfig): Promise<void> {
    // Temporarily replace first VPS with the selected one for upload
    const originalVpsConfigs = [...this.settings.vpsConfigs];
    this.settings.vpsConfigs = [vps];
    try {
      await this.publishToSiteAsync();
    } finally {
      // Restore original
      this.settings.vpsConfigs = originalVpsConfigs;
    }
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

    const vps = settings.vpsConfigs[0];

    if (!vps.folders || vps.folders.length === 0) {
      this.logger.warn('No folders configured for VPS', { vpsId: vps.id });
      new Notice('No folders configured for publishing.');
      return;
    }

    const scopedLogger = this.logger.child({ vps: vps.id ?? 'default' });
    const guidGenerator = new GuidGeneratorAdapter();

    // Initialiser les statistiques de publication
    const stats: PublishingStats = createPublishingStats();
    stats.startedAt = new Date();

    // Initialiser le système de progress et notifications
    const totalProgressAdapter = new NoticeProgressAdapter('Publishing to VPS');
    const notificationAdapter = new NoticeNotificationAdapter();
    const stepMessages = createStepMessages(t.plugin);
    const stepProgressManager = new StepProgressManagerAdapter(
      totalProgressAdapter,
      notificationAdapter,
      stepMessages
    );

    let sessionId: string | null = null;
    let sessionClient: SessionApiClient | null = null;

    try {
      // ====================================================================
      // ÉTAPE 1: PARSE_VAULT - Parsing du vault
      // ====================================================================
      notificationAdapter.info('🔍 Analyzing vault notes...');

      const vault = new ObsidianVaultAdapter(this.app, guidGenerator, scopedLogger);
      const notes: CollectedNote[] = await vault.collectFromFolder({
        folderConfig: vps.folders,
      });

      stats.totalNotesAnalyzed = notes.length;

      const parseContentHandler = this.buildParseContentHandler(vps, settings, scopedLogger);
      const publishables = await parseContentHandler.handle(notes);

      const publishableCount = publishables.length;
      stats.notesEligible = publishableCount;
      stats.notesIgnored = notes.length - publishableCount;

      const notesWithAssets = publishables.filter((n) => n.assets && n.assets.length > 0);
      const assetsPlanned = notesWithAssets.reduce(
        (sum, n) => sum + (Array.isArray(n.assets) ? n.assets.length : 0),
        0
      );
      stats.assetsPlanned = assetsPlanned;

      scopedLogger.debug('Total notes collected and parsed', {
        collected: notes.length,
        publishable: publishableCount,
        ignored: stats.notesIgnored,
        assetsPlanned,
      });

      if (publishableCount === 0) {
        this.logger.warn('No publishable notes after filtering; aborting upload.');
        new Notice('No publishable notes to upload.');
        return;
      }

      // Afficher les stats d'analyse
      notificationAdapter.info(
        `✅ Analysis complete\n📝 ${stats.notesEligible} eligible notes${
          stats.notesIgnored > 0 ? ` (${stats.notesIgnored} ignored)` : ''
        }${stats.assetsPlanned > 0 ? `\n🖼️ ${stats.assetsPlanned} assets detected` : ''}`
      );

      // Initialiser le progress global AVANT le début des opérations réseau
      const totalPlanned = publishableCount + assetsPlanned;
      totalProgressAdapter.start(totalPlanned);

      // ====================================================================
      // SESSION START - Démarrage de la session
      // ====================================================================
      sessionClient = new SessionApiClient(
        vps.baseUrl,
        vps.apiKey,
        this.responseHandler,
        this.logger
      );
      const calloutStyles = await this.loadCalloutStyles(settings.calloutStylePaths ?? []);

      const defaultNginxLimit = 1 * 1024 * 1024; // 1 MB
      const started = await sessionClient.startSession({
        notesPlanned: publishableCount,
        assetsPlanned: assetsPlanned,
        maxBytesPerRequest: defaultNginxLimit,
        calloutStyles,
      });

      sessionId = started.sessionId;
      const serverRequestLimit = started.maxBytesPerRequest;
      this.logger.debug('Session started', { sessionId, maxBytesPerRequest: serverRequestLimit });

      // ====================================================================
      // ÉTAPE 2: UPLOAD_NOTES - Upload des notes
      // ====================================================================
      const notesUploader = new NotesUploaderAdapter(
        sessionClient,
        sessionId,
        new GuidGeneratorAdapter(),
        this.logger,
        serverRequestLimit,
        stepProgressManager
      );

      // Calculer le nombre de batchs
      const notesBatchInfo = notesUploader.getBatchInfo(publishables);
      stats.notesBatchCount = notesBatchInfo.batchCount;
      stats.notesOversized = notesBatchInfo.oversizedCount;

      stepProgressManager.startStep(
        ProgressStepId.UPLOAD_NOTES,
        'Uploading notes',
        publishableCount
      );

      notificationAdapter.info(
        `📤 Uploading notes in ${stats.notesBatchCount} batch${
          stats.notesBatchCount > 1 ? 'es' : ''
        }...`
      );

      await notesUploader.upload(publishables);

      stats.notesUploaded = publishableCount - stats.notesOversized;

      stepProgressManager.completeStep(ProgressStepId.UPLOAD_NOTES);

      // ====================================================================
      // ÉTAPE 3: UPLOAD_ASSETS - Upload des assets
      // ====================================================================
      if (notesWithAssets.length > 0 && assetsPlanned > 0) {
        const assetsVault = new ObsidianAssetsVaultAdapter(this.app, this.logger);
        const assetsUploader = new AssetsUploaderAdapter(
          sessionClient,
          sessionId,
          new GuidGeneratorAdapter(),
          this.logger,
          serverRequestLimit,
          stepProgressManager
        );

        const resolvedAssets = await assetsVault.resolveAssetsFromNotes(
          notesWithAssets,
          settings.assetsFolder,
          settings.enableAssetsVaultFallback
        );

        // Calculer le nombre de batchs
        const assetsBatchInfo = await assetsUploader.getBatchInfo(resolvedAssets);
        stats.assetsBatchCount = assetsBatchInfo.batchCount;
        stats.assetsOversized = assetsBatchInfo.oversizedCount;

        stepProgressManager.startStep(
          ProgressStepId.UPLOAD_ASSETS,
          'Uploading assets',
          assetsPlanned
        );

        notificationAdapter.info(
          `📤 Uploading assets in ${stats.assetsBatchCount} batch${
            stats.assetsBatchCount > 1 ? 'es' : ''
          }...`
        );

        await assetsUploader.upload(resolvedAssets);

        stats.assetsUploaded = resolvedAssets.length - stats.assetsOversized;

        stepProgressManager.completeStep(ProgressStepId.UPLOAD_ASSETS);
        this.logger.debug('Assets uploaded', { assetsUploaded: stats.assetsUploaded });
      } else {
        // Pas d'assets à uploader, on skip l'étape
        stepProgressManager.skipStep(ProgressStepId.UPLOAD_ASSETS, 'No assets to upload');
      }

      // ====================================================================
      // ÉTAPE 4: FINALIZE_SESSION - Finalisation
      // ====================================================================
      stepProgressManager.startStep(ProgressStepId.FINALIZE_SESSION, 'Finalizing', 1);

      await sessionClient.finishSession(sessionId, {
        notesProcessed: stats.notesUploaded,
        assetsProcessed: stats.assetsUploaded,
      });

      stepProgressManager.advanceStep(ProgressStepId.FINALIZE_SESSION, 1);
      stepProgressManager.completeStep(ProgressStepId.FINALIZE_SESSION);

      // Terminer le progress global
      totalProgressAdapter.finish();

      // Finaliser les stats
      stats.completedAt = new Date();

      // Afficher les stats finales
      const summary = formatPublishingStats(stats);
      new Notice(summary, 10000); // Afficher pendant 10 secondes

      this.logger.debug('Publishing completed successfully', stats);
    } catch (err) {
      this.logger.error('Publishing failed, aborting session if created', err);

      stats.completedAt = new Date();
      stats.notesFailed = stats.notesEligible - stats.notesUploaded;
      stats.assetsFailed = stats.assetsPlanned - stats.assetsUploaded;

      // Marquer l'étape en cours comme échouée
      const currentStep = stepProgressManager
        .getAllSteps()
        .find((step) => step.status === ProgressStepStatus.IN_PROGRESS);
      if (currentStep) {
        stepProgressManager.failStep(
          currentStep.id,
          err instanceof Error ? err.message : 'Unknown error'
        );
      }

      // Abort session si elle a été créée
      if (sessionId && sessionClient) {
        try {
          await sessionClient.abortSession(sessionId);
        } catch (abortErr) {
          this.logger.error('Failed to abort session', abortErr);
        }
      }

      totalProgressAdapter.finish();

      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      new Notice(`❌ Publishing failed: ${errorMsg}\n\nCheck console for details.`, 0);
    }
  }

  private async loadCalloutStyles(paths: string[]): Promise<Array<{ path: string; css: string }>> {
    const styles: Array<{ path: string; css: string }> = [];
    const adapter: DataAdapter = this.app.vault.adapter;

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
      this.logger.debug('Loaded callout styles', { count: styles.length });
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
      this.logger.debug('VPS connection test succeeded');
      this.logger.debug(`Test connection message: ${res.text}`);
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
    if (!target.baseUrl) {
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
      target.baseUrl,
      target.apiKey,
      this.responseHandler,
      clientLogger
    );

    await client.cleanupVps(confirmationName);
  }

  private buildParseContentHandler(
    vps: VpsConfig,
    settings: PluginSettings,
    logger: LoggerPort
  ): ParseContentHandler {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(logger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(
      vps.ignoreRules ?? [],
      logger
    );
    const noteMapper = new NotesMapper();
    const inlineDataviewRenderer = new RenderInlineDataviewService(logger);
    const contentSanitizer = new ContentSanitizerService(
      vps.cleanupRules ?? [],
      settings.frontmatterKeysToExclude ?? [],
      settings.frontmatterTagsToExclude ?? [],
      logger
    );
    const assetsDetector = new DetectAssetsService(logger);
    const detectWikilinks = new DetectWikilinksService(logger);
    const resolveWikilinks = new ResolveWikilinksService(logger, detectWikilinks);
    const computeRoutingService = new ComputeRoutingService(logger);
    const ensureTitleHeaderService = new EnsureTitleHeaderService(logger);

    return new ParseContentHandler(
      normalizeFrontmatterService,
      evaluateIgnoreRulesHandler,
      noteMapper,
      inlineDataviewRenderer,
      contentSanitizer,
      ensureTitleHeaderService,
      assetsDetector,
      resolveWikilinks,
      computeRoutingService,
      logger
    );
  }
}
