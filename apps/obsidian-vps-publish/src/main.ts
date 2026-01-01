import { PerformanceTrackerAdapter } from '@core-application/infra/performance-tracker.adapter';
import { processWithControlledConcurrency } from '@core-application/utils/concurrency.util';
import { EvaluateIgnoreRulesHandler } from '@core-application/vault-parsing/handler/evaluate-ignore-rules.handler';
import { HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { ParseContentHandler } from '@core-application/vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '@core-application/vault-parsing/mappers/notes.mapper';
import { ComputeRoutingService } from '@core-application/vault-parsing/services/compute-routing.service';
import { DeduplicateNotesService } from '@core-application/vault-parsing/services/deduplicate-notes.service';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { DetectLeafletBlocksService } from '@core-application/vault-parsing/services/detect-leaflet-blocks.service';
import { DetectWikilinksService } from '@core-application/vault-parsing/services/detect-wikilinks.service';
import { EnsureTitleHeaderService } from '@core-application/vault-parsing/services/ensure-title-header.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '@core-application/vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '@core-application/vault-parsing/services/resolve-wikilinks.service';
import {
  applyCustomIndexesToRouteTree,
  CancellationError,
  type CancellationPort,
  type CollectedNote,
  type CustomIndexConfig,
  migrateLegacyFoldersToRouteTree,
  type VpsConfig,
} from '@core-domain';
import { type HttpResponse } from '@core-domain/entities/http-response';
import { ProgressStepId, ProgressStepStatus } from '@core-domain/entities/progress-step';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import {
  createPublishingStats,
  formatPublishingStats,
  type PublishingStats,
} from '@core-domain/entities/publishing-stats';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { LogLevel } from '@core-domain/ports/logger-port';
import type { PerformanceTrackerPort } from '@core-domain/ports/performance-tracker.port';
import { type DataAdapter, Notice, Plugin, type RequestUrlResponse } from 'obsidian';

import { getTranslations, translate } from './i18n';
import { decryptApiKey, encryptApiKey } from './lib/api-key-crypto';
import { DEFAULT_LOGGER_LEVEL } from './lib/constants/default-logger-level.constant';
import { type DataviewApi, DataviewExecutor } from './lib/dataview/dataview-executor';
import { processDataviewBlocks } from './lib/dataview/process-dataview-blocks.service';
import { AbortCancellationAdapter } from './lib/infra/abort-cancellation.adapter';
import { AssetsUploaderAdapter } from './lib/infra/assets-uploader.adapter';
import { ConsoleLoggerAdapter } from './lib/infra/console-logger.adapter';
import { EventLoopMonitorAdapter } from './lib/infra/event-loop-monitor.adapter';
import { GuidGeneratorAdapter } from './lib/infra/guid-generator.adapter';
import { NotesUploaderAdapter } from './lib/infra/notes-uploader.adapter';
import { NoticeNotificationAdapter } from './lib/infra/notice-notification.adapter';
import { NoticeProgressAdapter } from './lib/infra/notice-progress.adapter';
import { ObsidianAssetsVaultAdapter } from './lib/infra/obsidian-assets-vault.adapter';
import { ObsidianVaultAdapter } from './lib/infra/obsidian-vault.adapter';
import { PublishingTraceService } from './lib/infra/publishing-trace.service';
import { createStepMessages, getStepLabel } from './lib/infra/step-messages.factory';
import { StepProgressManagerAdapter } from './lib/infra/step-progress-manager.adapter';
import { UiPressureMonitorAdapter } from './lib/infra/ui-pressure-monitor.adapter';
import { testVpsConnection } from './lib/services/http-connection.service';
import { SessionApiClient } from './lib/services/session-api.client';
import { ObsidianVpsPublishSettingTab } from './lib/setting-tab.view';
import type { PluginSettings } from './lib/settings/plugin-settings.type';
import { enrichCleanupRules } from './lib/utils/create-default-folder-config.util';
import { getEffectiveFolders } from './lib/utils/get-effective-folders.util';
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
  // Performance defaults (conservative values for stability)
  maxConcurrentDataviewNotes: 5,
  maxConcurrentUploads: 3,
  maxConcurrentFileReads: 5,
  // Performance debugging
  enablePerformanceDebug: false,
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
  private currentPublishAbortController: AbortController | null = null;
  private cancelRibbonIcon: HTMLElement | null = null;

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
        selectVpsOrAuto(
          this.app,
          this.settings.vpsConfigs,
          async (vps) => {
            await this.uploadToVps(vps);
          },
          t
        );
      },
    });

    this.addCommand({
      id: 'cancel-publish',
      name: t.plugin.commandCancelPublish,
      callback: () => {
        if (this.currentPublishAbortController) {
          this.logger.info('User requested cancellation');
          this.currentPublishAbortController.abort();
          new Notice('Cancelling publishing...', 3000);
        } else {
          new Notice('No publishing operation in progress', 3000);
        }
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
        selectVpsOrAuto(
          this.app,
          this.settings.vpsConfigs,
          async (vps) => {
            await this.testConnectionForVps(vps);
          },
          t
        );
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

    this.addCommand({
      id: 'open-help',
      name: t.plugin.commandOpenHelp,
      callback: () => {
        const { HelpModal } = require('./lib/modals/help-modal');
        new HelpModal(this.app, t).open();
      },
    });

    this.addCommand({
      id: 'insert-no-publishing',
      name: t.plugin.commandInsertNoPublishing,
      editorCheckCallback: (checking: boolean, editor) => {
        // Command is only available in editor views (edit/source mode)
        if (checking) {
          return editor !== null;
        }

        if (editor) {
          const cursor = editor.getCursor();
          editor.replaceRange('^no-publishing', cursor);
          // Move cursor after the inserted text
          editor.setCursor({
            line: cursor.line,
            ch: cursor.ch + '^no-publishing'.length,
          });
        }
      },
    });

    this.addRibbonIcon('rocket', t.plugin.commandPublish, async () => {
      try {
        if (!this.settings.vpsConfigs || this.settings.vpsConfigs.length === 0) {
          new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
          return;
        }
        selectVpsOrAuto(
          this.app,
          this.settings.vpsConfigs,
          async (vps) => {
            await this.uploadToVps(vps);
          },
          t
        );
      } catch (e) {
        this.logger.error('Publish failed from ribbon', { error: e });
        new Notice(t.plugin.publishError);
      }
    });

    // Add cancel ribbon icon (initially hidden)
    this.cancelRibbonIcon = this.addRibbonIcon('x-circle', t.plugin.commandCancelPublish, () => {
      if (this.currentPublishAbortController) {
        this.logger.info('User requested cancellation via ribbon');
        this.currentPublishAbortController.abort();
        new Notice('Cancelling publishing...', 3000);
      }
    });
    this.cancelRibbonIcon.style.display = 'none'; // Hide initially

    this.logger.debug('Plugin loaded.');
  }

  /**
   * Show cancel ribbon icon during publishing
   */
  private showCancelRibbon() {
    if (this.cancelRibbonIcon) {
      this.cancelRibbonIcon.style.display = 'flex';
    }
  }

  /**
   * Hide cancel ribbon icon after publishing completes/fails
   */
  private hideCancelRibbon() {
    if (this.cancelRibbonIcon) {
      this.cancelRibbonIcon.style.display = 'none';
    }
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
      this.logger.error('Failed to load snapshot settings', { error: e });
    }
    const merged: PluginSettings = {
      ...defaultSettings,
      ...(internalRaw as Partial<PluginSettings>),
      ...(snapshotRaw as Partial<PluginSettings>),
    };

    // BREAKING CHANGE: Auto-migrate legacy folders to route tree
    let needsSave = false;
    if (merged.vpsConfigs && Array.isArray(merged.vpsConfigs)) {
      merged.vpsConfigs = merged.vpsConfigs.map((vps) => {
        // Check if migration is needed (has folders but no routeTree)
        if (vps.folders && vps.folders.length > 0 && !vps.routeTree) {
          this.logger.info(`Migrating VPS "${vps.name}" from legacy folders to route tree`, {
            vpsId: vps.id,
            foldersCount: vps.folders.length,
            customIndexesCount: vps.customIndexes?.length || 0,
          });

          const routeTree = migrateLegacyFoldersToRouteTree(vps.folders);

          // Apply custom indexes to route tree
          if (vps.customIndexes && vps.customIndexes.length > 0) {
            this.logger.debug('Applying custom indexes to route tree', {
              vpsId: vps.id,
              customIndexesCount: vps.customIndexes.length,
            });
            applyCustomIndexesToRouteTree(routeTree, vps.customIndexes);
          }

          this.logger.debug('Migration completed', {
            vpsId: vps.id,
            routeTreeRoots: routeTree.roots.length,
          });

          needsSave = true;

          // Return migrated VPS with routeTree and cleaned up legacy fields
          const { folders: _folders, customIndexes: _customIndexes, ...cleanVps } = vps;
          return {
            ...cleanVps,
            routeTree,
          };
        }

        return vps;
      });

      // Enrich cleanup rules with default metadata (translation keys, isDefault flag)
      merged.vpsConfigs = merged.vpsConfigs.map((vps) => ({
        ...vps,
        cleanupRules: enrichCleanupRules(vps.cleanupRules || []),
      }));
    }

    this.settings = withDecryptedApiKeys(merged);

    // Save immediately if migration occurred
    if (needsSave) {
      this.logger.info('Auto-saving migrated settings');
      await this.saveSettings();
      new Notice('VPS configuration migrated to new route-based model (BREAKING CHANGE)', 5000);
    }
  }

  async saveSettings() {
    const toPersist = withEncryptedApiKeys(this.settings);
    await this.saveData(toPersist);
  }

  async testConnectionForVps(vps: VpsConfig): Promise<void> {
    const { t } = getTranslations(this.app, this.settings);
    const res: HttpResponse = await testVpsConnection(vps, this.responseHandler, this.logger, t);

    if (!res.isError) {
      this.logger.debug('VPS connection test succeeded', { vpsId: vps.id });
      this.logger.debug(`Test connection message: ${res.text}`);
      new Notice(t.settings.testConnection.success);
    } else {
      this.logger.error('VPS connection test failed', { vpsId: vps.id, error: res.error });
      const errorMsg = res.error instanceof Error ? res.error.message : JSON.stringify(res.error);
      new Notice(translate(t, 'settings.testConnection.failedWithError', { error: errorMsg }));
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
      new Notice(translate(t, 'notice.noFoldersConfigured'));
      return;
    }

    // Create AbortController for cancellation support
    const abortController = new AbortController();
    this.currentPublishAbortController = abortController;
    const cancellation = new AbortCancellationAdapter(abortController.signal);

    // Show cancel ribbon icon
    this.showCancelRibbon();

    const scopedLogger = this.logger.child({ vps: vps.id ?? 'default' });
    const guidGenerator = new GuidGeneratorAdapter();

    // ========================================================================
    // PHASE 1: PERFORMANCE INSTRUMENTATION
    // ========================================================================
    // Generate unique upload run ID for correlation
    const uploadRunId = guidGenerator.generateGuid();

    // Enable performance debug mode if configured
    const enablePerfDebug = settings.enablePerformanceDebug ?? false;

    // Initialize publishing trace service
    const trace = new PublishingTraceService(uploadRunId, scopedLogger);
    scopedLogger.info('🚀 Publishing started', {
      uploadRunId,
      vpsId: vps.id,
      vpsName: vps.name,
      perfDebugEnabled: enablePerfDebug,
    });

    // Start event loop lag monitor
    const eventLoopMonitor = new EventLoopMonitorAdapter(scopedLogger, 100);
    eventLoopMonitor.start();

    // Initialize performance tracker
    // Debug mode enabled if logLevel is 'debug'
    const debugMode = settings.logLevel === LogLevel.debug;
    const perfTracker = new PerformanceTrackerAdapter(scopedLogger, debugMode);
    const sessionPerfSpan = perfTracker.startSpan('publishing-session', {
      vpsId: vps.id,
      vpsName: vps.name,
    });

    // Initialize UI pressure monitor
    const uiMonitor = new UiPressureMonitorAdapter(scopedLogger);

    // Initialiser les statistiques de publication
    const stats: PublishingStats = createPublishingStats();
    stats.startedAt = new Date();

    // Initialiser le système de progress et notifications
    const totalProgressAdapter = new NoticeProgressAdapter(
      translate(t, 'notice.publishing'),
      t,
      uiMonitor
    );
    const notificationAdapter = new NoticeNotificationAdapter(uiMonitor);
    const stepMessages = createStepMessages(t.plugin);
    const stepProgressManager = new StepProgressManagerAdapter(
      totalProgressAdapter,
      notificationAdapter,
      stepMessages
    );

    // Start progress bar immediately (at 0%)
    totalProgressAdapter.start(0);

    let sessionId: string | null = null;
    let sessionClient: SessionApiClient | null = null;

    try {
      // ====================================================================
      // ÉTAPE 1: PARSE_VAULT - Parsing du vault
      // ====================================================================
      trace.startStep('1-parse-vault-init');

      const parseVaultSpan = perfTracker.startSpan('parse-vault');

      notificationAdapter.info(translate(t, 'notice.analyzingVault'));

      trace.checkpoint('1-parse-vault-init', 'creating-vault-adapter');

      const vault = new ObsidianVaultAdapter(
        this.app,
        guidGenerator,
        scopedLogger,
        vps.customRootIndexFile
      );

      trace.checkpoint('1-parse-vault-init', 'collection-method-decision');
      trace.endStep('1-parse-vault-init');

      trace.startStep('2-collect-notes');

      // Use route tree if available, otherwise fallback to legacy folders
      let notes: CollectedNote[];
      if (vps.routeTree && vps.routeTree.roots.length > 0) {
        scopedLogger.debug('Using route tree collection (new method)', {
          rootCount: vps.routeTree.roots.length,
        });
        notes = await vault.collectFromRouteTree(
          {
            routeTree: vps.routeTree,
            vpsId: vps.id,
          },
          cancellation
        );
      } else {
        scopedLogger.debug('Using legacy folder collection (fallback)', {
          folderCount: vps.folders?.length || 0,
        });
        // Extract effective folders from route tree (or legacy folders)
        const effectiveFolders = getEffectiveFolders(vps);
        notes = await vault.collectFromFolder(
          {
            folderConfig: effectiveFolders,
          },
          cancellation
        );
      }

      trace.endStep('2-collect-notes', { notesCount: notes.length });

      stats.totalNotesAnalyzed = notes.length;

      // Check if Dataview plugin is available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dataviewApi = (this.app as any).plugins?.plugins?.dataview?.api as
        | DataviewApi
        | undefined;

      trace.startStep('3-check-dataview');

      scopedLogger.debug('🔌 Dataview plugin status check', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasPluginsManager: !!(this.app as any).plugins,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasDataviewPlugin: !!(this.app as any).plugins?.plugins?.dataview,
        hasDataviewApi: !!dataviewApi,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataviewVersion: (this.app as any).plugins?.plugins?.dataview?.manifest?.version,
      });
      if (!dataviewApi) {
        scopedLogger.debug(
          'Dataview plugin not found or not enabled. Dataview blocks will be replaced with error messages.'
        );
        notificationAdapter.info(translate(t, 'notice.dataviewNotDetected'));
      } else {
        scopedLogger.debug('Dataview plugin detected and ready');
      }

      trace.endStep('3-check-dataview');

      trace.startStep('4-build-parse-handler');

      const parseContentHandler = this.buildParseContentHandler(
        vps,
        settings,
        scopedLogger,
        dataviewApi,
        perfTracker.child('content-pipeline'),
        cancellation
      );

      trace.endStep('4-build-parse-handler');

      scopedLogger.debug('Parsing content', {
        notesCount: notes.length,
      });

      trace.startStep('5-parse-content');

      const publishables = await parseContentHandler.handle(notes);

      trace.endStep('5-parse-content', { publishablesCount: publishables.length });

      perfTracker.endSpan(parseVaultSpan, {
        notesCollected: notes.length,
        publishableNotes: publishables.length,
      });

      scopedLogger.debug('Content parsed', {
        publishablesCount: publishables.length,
      });

      // ====================================================================
      // ÉTAPE 5b: DEDUPLICATE_NOTES - Déduplication par dossier
      // ====================================================================
      trace.startStep('5b-deduplicate-notes');

      const deduplicateSpan = perfTracker.startSpan('deduplicate-notes');

      const deduplicateService = new DeduplicateNotesService(scopedLogger);
      const deduplicated = deduplicateService.process(publishables);

      perfTracker.endSpan(deduplicateSpan, {
        inputCount: publishables.length,
        outputCount: deduplicated.length,
        duplicatesRemoved: publishables.length - deduplicated.length,
      });

      trace.endStep('5b-deduplicate-notes', {
        inputCount: publishables.length,
        outputCount: deduplicated.length,
      });

      scopedLogger.debug('Notes deduplicated', {
        inputCount: publishables.length,
        outputCount: deduplicated.length,
        removed: publishables.length - deduplicated.length,
      });

      const publishableCount = deduplicated.length;
      stats.notesEligible = publishableCount;
      stats.notesIgnored = notes.length - publishableCount;

      const notesWithAssets = deduplicated.filter((n) => n.assets && n.assets.length > 0);
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
        new Notice(translate(t, 'notice.noPublishableNotes'));
        totalProgressAdapter.finish();
        return;
      }

      // Don't show analysis stats that could reveal ignored count
      // Progress bar will show current step instead

      // ====================================================================
      // SESSION START - Démarrage de la session
      // ====================================================================
      trace.startStep('6-session-start');

      sessionClient = new SessionApiClient(
        vps.baseUrl,
        vps.apiKey,
        this.responseHandler,
        this.logger,
        t
      );

      trace.checkpoint('6-session-start', 'loading-callout-styles');

      const calloutStyles = await this.loadCalloutStyles(settings.calloutStylePaths ?? []);

      trace.checkpoint('6-session-start', 'building-custom-index-configs');

      // Build custom index configs from VPS and folder settings
      const customIndexConfigs: CustomIndexConfig[] = [];
      const guidGen = new GuidGeneratorAdapter();

      // Add root index if configured
      if (vps.customRootIndexFile) {
        customIndexConfigs.push({
          id: guidGen.generateGuid(),
          folderPath: '',
          indexFilePath: vps.customRootIndexFile,
          isRootIndex: true,
        });
      }

      // Add folder indexes if configured (use getEffectiveFolders for route tree compatibility)
      const effectiveFolders = getEffectiveFolders(vps);
      for (const folder of effectiveFolders) {
        if (folder.customIndexFile) {
          customIndexConfigs.push({
            id: guidGen.generateGuid(),
            folderPath: folder.routeBase, // Use routeBase (published route) not vaultFolder
            indexFilePath: folder.customIndexFile,
          });
        }
      }

      this.logger.debug('Custom index configs built', {
        count: customIndexConfigs.length,
        configs: customIndexConfigs,
      });

      trace.checkpoint('6-session-start', 'calling-startSession-api');

      const defaultNginxLimit = 1 * 1024 * 1024; // 1 MB
      const started = await sessionClient.startSession({
        notesPlanned: publishableCount,
        assetsPlanned: assetsPlanned,
        maxBytesPerRequest: defaultNginxLimit,
        calloutStyles,
        customIndexConfigs,
        ignoredTags: settings.frontmatterTagsToExclude || [],
      });

      sessionId = started.sessionId;
      const serverRequestLimit = started.maxBytesPerRequest;

      trace.endStep('6-session-start', {
        sessionId,
        maxBytesPerRequest: serverRequestLimit,
      });

      this.logger.debug('Session started', { sessionId, maxBytesPerRequest: serverRequestLimit });

      // ====================================================================
      // ÉTAPE 2: UPLOAD_NOTES - Upload des notes
      // ====================================================================
      trace.startStep('7-upload-notes');

      const uploadNotesSpan = perfTracker.startSpan('upload-notes');

      // Filtrer les règles de nettoyage : ne garder que celles activées avec regex valide
      const validCleanupRules = (vps.cleanupRules ?? []).filter(
        (rule) => rule.isEnabled && rule.regex && rule.regex.trim().length > 0
      );

      this.logger.debug('Cleanup rules filtering', {
        total: vps.cleanupRules?.length ?? 0,
        valid: validCleanupRules.length,
        rules: validCleanupRules.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.isEnabled,
          hasRegex: !!r.regex,
        })),
      });

      const notesUploader = new NotesUploaderAdapter(
        sessionClient,
        sessionId,
        new GuidGeneratorAdapter(),
        this.logger,
        serverRequestLimit,
        stepProgressManager,
        validCleanupRules,
        settings.maxConcurrentUploads || 3
      );

      // Calculer le nombre de batchs
      const notesBatchInfo = notesUploader.getBatchInfo(deduplicated);
      stats.notesBatchCount = notesBatchInfo.batchCount;

      stepProgressManager.startStep(
        ProgressStepId.UPLOAD_NOTES,
        getStepLabel(t, ProgressStepId.UPLOAD_NOTES),
        publishableCount
      );

      notificationAdapter.info(
        translate(t, 'notice.uploadingNotesBatches', {
          count: String(stats.notesBatchCount),
          plural: stats.notesBatchCount > 1 ? 'es' : '',
        })
      );

      await notesUploader.upload(deduplicated);

      stats.notesUploaded = publishableCount;

      perfTracker.endSpan(uploadNotesSpan, {
        notesUploaded: stats.notesUploaded,
        batchCount: stats.notesBatchCount,
      });

      trace.endStep('7-upload-notes', {
        notesUploaded: stats.notesUploaded,
        batchCount: stats.notesBatchCount,
      });

      stepProgressManager.completeStep(ProgressStepId.UPLOAD_NOTES);

      // ====================================================================
      // ÉTAPE 3: UPLOAD_ASSETS - Upload des assets
      // ====================================================================
      if (notesWithAssets.length > 0 && assetsPlanned > 0) {
        trace.startStep('8-upload-assets');

        const uploadAssetsSpan = perfTracker.startSpan('upload-assets');

        const assetsVault = new ObsidianAssetsVaultAdapter(this.app, this.logger);
        const assetsUploader = new AssetsUploaderAdapter(
          sessionClient,
          sessionId,
          new GuidGeneratorAdapter(),
          this.logger,
          serverRequestLimit,
          stepProgressManager,
          settings.maxConcurrentUploads || 3
        );

        const resolvedAssets = await assetsVault.resolveAssetsFromNotes(
          notesWithAssets,
          settings.assetsFolder,
          settings.enableAssetsVaultFallback
        );

        // Calculer le nombre de batchs
        const assetsBatchInfo = await assetsUploader.getBatchInfo(resolvedAssets);
        stats.assetsBatchCount = assetsBatchInfo.batchCount;

        stepProgressManager.startStep(
          ProgressStepId.UPLOAD_ASSETS,
          getStepLabel(t, ProgressStepId.UPLOAD_ASSETS),
          assetsPlanned
        );

        notificationAdapter.info(
          translate(t, 'notice.uploadingAssetsBatches', {
            count: String(stats.assetsBatchCount),
            plural: stats.assetsBatchCount > 1 ? 'es' : '',
          })
        );

        await assetsUploader.upload(resolvedAssets);

        stats.assetsUploaded = resolvedAssets.length;

        perfTracker.endSpan(uploadAssetsSpan, {
          assetsUploaded: stats.assetsUploaded,
          batchCount: stats.assetsBatchCount,
        });

        trace.endStep('8-upload-assets', {
          assetsUploaded: stats.assetsUploaded,
          batchCount: stats.assetsBatchCount,
        });

        stepProgressManager.completeStep(ProgressStepId.UPLOAD_ASSETS);
        this.logger.debug('Assets uploaded', { assetsUploaded: stats.assetsUploaded });
      } else {
        // Pas d'assets à uploader, on skip l'étape
        stepProgressManager.skipStep(
          ProgressStepId.UPLOAD_ASSETS,
          translate(t, 'plugin.progress.uploadAssets.skip')
        );
      }

      // ====================================================================
      // ÉTAPE 4: FINALIZE_SESSION - Finalisation
      // ====================================================================
      trace.startStep('9-finalize-session');

      const finalizeSpan = perfTracker.startSpan('finalize-session');

      stepProgressManager.startStep(
        ProgressStepId.FINALIZE_SESSION,
        getStepLabel(t, ProgressStepId.FINALIZE_SESSION),
        1
      );

      await sessionClient.finishSession(sessionId, {
        notesProcessed: stats.notesUploaded,
        assetsProcessed: stats.assetsUploaded,
      });

      stepProgressManager.advanceStep(ProgressStepId.FINALIZE_SESSION, 1);
      stepProgressManager.completeStep(ProgressStepId.FINALIZE_SESSION);

      perfTracker.endSpan(finalizeSpan);

      trace.endStep('9-finalize-session');

      // Terminer le progress global
      totalProgressAdapter.finish();

      // Finaliser les stats
      stats.completedAt = new Date();

      // ========================================================================
      // PHASE 1: STOP PERFORMANCE INSTRUMENTATION AND GENERATE REPORTS
      // ========================================================================
      // Stop event loop monitor
      const eventLoopStats = eventLoopMonitor.stop();

      // End performance tracking
      perfTracker.endSpan(sessionPerfSpan, {
        totalDurationMs: stats.completedAt.getTime() - stats.startedAt.getTime(),
        notesPublished: stats.notesUploaded,
        assetsPublished: stats.assetsUploaded,
      });

      // Generate and log performance summary
      const perfSummary = perfTracker.generateSummary();
      scopedLogger.info('📊 Performance Summary:\n' + perfSummary);

      // Generate and log publishing trace summary
      const traceSummary = trace.getSummary();
      scopedLogger.info(traceSummary);

      // Log event loop statistics
      scopedLogger.info('⏱️ Event Loop Lag Statistics', {
        uploadRunId,
        samples: eventLoopStats.samples,
        minLagMs: eventLoopStats.minLagMs.toFixed(2),
        maxLagMs: eventLoopStats.maxLagMs.toFixed(2),
        avgLagMs: eventLoopStats.avgLagMs.toFixed(2),
        p50LagMs: eventLoopStats.p50LagMs.toFixed(2),
        p95LagMs: eventLoopStats.p95LagMs.toFixed(2),
        p99LagMs: eventLoopStats.p99LagMs.toFixed(2),
      });

      // Generate and log UI pressure summary
      const uiPressureSummary = uiMonitor.generateSummary();
      scopedLogger.info('🎯 ' + uiPressureSummary);

      // Afficher les stats finales
      const summary = formatPublishingStats(stats, t.publishingStats);

      // Add performance debug summary if enabled
      let perfDebugInfo = '';
      if (enablePerfDebug) {
        const traceData = trace.getStructuredData();
        const topSteps = traceData.steps
          .sort((a, b) => b.durationSec - a.durationSec)
          .slice(0, 3)
          .map((step) => `${step.name}: ${step.durationSec.toFixed(2)}s`)
          .join(', ');

        perfDebugInfo = `\n\n🔍 Performance Debug:\nTotal: ${traceData.totalDurationSec.toFixed(2)}s\nTop steps: ${topSteps}\nEvent loop p95 lag: ${eventLoopStats.p95LagMs.toFixed(0)}ms`;
      }

      // Add performance hint if debug mode is off
      let perfHint = '';
      if (!debugMode && !enablePerfDebug) {
        perfHint = t.notice.debugModeHint;
      }

      new Notice(summary + perfDebugInfo + perfHint, 10000); // Afficher pendant 10 secondes

      this.logger.debug('Publishing completed successfully', { stats });
    } catch (err) {
      // Check if error is a cancellation
      const isCancellation = err instanceof CancellationError;

      if (isCancellation) {
        this.logger.info('Publishing cancelled by user');
      } else {
        this.logger.error('Publishing failed, aborting session if created', { error: err });
      }

      stats.completedAt = new Date();
      stats.notesFailed = stats.notesEligible - stats.notesUploaded;
      stats.assetsFailed = stats.assetsPlanned - stats.assetsUploaded;

      // Marquer l'étape en cours comme échouée
      const currentStep = stepProgressManager
        .getAllSteps()
        .find((step) => step.status === ProgressStepStatus.IN_PROGRESS);
      if (currentStep && !isCancellation) {
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
          this.logger.error('Failed to abort session', { error: abortErr });
        }
      }

      totalProgressAdapter.finish();

      if (isCancellation) {
        new Notice(translate(t, 'notice.publishingCancelled'), 5000);
      } else {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        new Notice(translate(t, 'notice.publishingFailedWithError', { error: errorMsg }), 0);
      }
    } finally {
      // Clean up abort controller
      this.currentPublishAbortController = null;
      // Hide cancel ribbon icon
      this.hideCancelRibbon();
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
    const res: HttpResponse = await testVpsConnection(vps, this.responseHandler, this.logger, t);

    if (!res.isError) {
      this.logger.debug('VPS connection test succeeded');
      this.logger.debug(`Test connection message: ${res.text}`);
      new Notice(t.settings.testConnection.success);
    } else {
      this.logger.error('VPS connection test failed: ', { error: res.error });
      const errorMsg = res.error instanceof Error ? res.error.message : JSON.stringify(res.error);
      new Notice(translate(t, 'settings.testConnection.failedWithError', { error: errorMsg }));
    }
  }

  // ---------------------------------------------------------------------------
  // VPS Maintenance
  // ---------------------------------------------------------------------------
  async cleanupVps(target: VpsConfig, confirmationName: string): Promise<void> {
    const t = getTranslations(this.app, this.settings).t;

    if (!target) {
      throw new Error(translate(t, 'sessionErrors.missingVpsConfig'));
    }

    const targetName = (target.name ?? '').trim();
    if (!targetName) {
      throw new Error(translate(t, 'sessionErrors.missingVpsName'));
    }
    if (!target.baseUrl) {
      throw new Error(translate(t, 'sessionErrors.invalidUrl'));
    }
    if (!target.apiKey) {
      throw new Error(translate(t, 'sessionErrors.missingApiKey'));
    }
    if (confirmationName !== targetName) {
      throw new Error(translate(t, 'sessionErrors.confirmationMismatch'));
    }

    const clientLogger = this.logger.child({ vps: target.id ?? targetName });
    const client = new SessionApiClient(
      target.baseUrl,
      target.apiKey,
      this.responseHandler,
      clientLogger,
      getTranslations(this.app, this.settings).t
    );

    await client.cleanupVps(confirmationName);
  }

  private buildParseContentHandler(
    vps: VpsConfig,
    settings: PluginSettings,
    logger: LoggerPort,
    dataviewApi?: DataviewApi,
    perfTracker?: PerformanceTrackerPort,
    cancellation?: CancellationPort
  ): ParseContentHandler {
    const normalizeFrontmatterService = new NormalizeFrontmatterService(logger);
    const evaluateIgnoreRulesHandler = new EvaluateIgnoreRulesHandler(
      vps.ignoreRules ?? [],
      logger
    );
    const noteMapper = new NotesMapper();
    const inlineDataviewRenderer = new RenderInlineDataviewService(logger);

    // Dataview block processor (plugin-side only)
    // Executes blocks via Dataview API and converts results to native Markdown
    // (wikilinks, inclusions, tables MD, lists) - NOT HTML
    const dataviewProcessor = async (
      notes: PublishableNote[],
      cancel?: CancellationPort
    ): Promise<PublishableNote[]> => {
      // Create executor if Dataview API is available
      const executor = dataviewApi ? new DataviewExecutor(dataviewApi, this.app) : undefined;

      // Process notes with controlled concurrency to avoid UI freeze
      const results: PublishableNote[] = [];

      await processWithControlledConcurrency(
        notes,
        async (note) => {
          cancel?.throwIfCancelled();

          try {
            const result = await processDataviewBlocks(
              note.content,
              executor,
              note.vaultPath,
              cancel
            );

            // CRITICAL: Replace content with native Markdown
            // This ensures fenced code blocks are NEVER uploaded
            // Content now has Markdown wikilinks/tables instead of ```dataview blocks
            results.push({
              ...note,
              content: result.content, // Content now has Markdown instead of ```dataview blocks
            });
          } catch (error) {
            logger.error('Failed to process Dataview blocks', {
              noteId: note.noteId,
              error: error instanceof Error ? error.message : String(error),
            });
            // Return note unchanged on catastrophic error
            results.push(note);
          }
        },
        {
          concurrency: settings.maxConcurrentDataviewNotes || 5, // Configurable
          yieldEveryN: 5, // Yield to UI every 5 notes
          onProgress: (current, total) => {
            logger.debug('Dataview processing progress', {
              current,
              total,
              percentComplete: ((current / total) * 100).toFixed(1),
            });
          },
        }
      );

      return results;
    };

    const leafletBlocksDetector = new DetectLeafletBlocksService(logger);
    // Note: ContentSanitizerService est maintenant appliqué côté backend après la finalisation
    const removeNoPublishingMarkerService = new RemoveNoPublishingMarkerService(logger);
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
      leafletBlocksDetector,
      ensureTitleHeaderService,
      removeNoPublishingMarkerService,
      assetsDetector,
      resolveWikilinks,
      computeRoutingService,
      logger,
      dataviewProcessor, // Plugin-side Dataview processing
      perfTracker, // Performance tracking
      cancellation // Cancellation support
    );
  }
}
