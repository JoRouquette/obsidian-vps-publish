import { DetectLeafletBlocksService } from '@core-application';
import { PerformanceTrackerAdapter } from '@core-application/infra/performance-tracker.adapter';
import { processWithControlledConcurrency } from '@core-application/utils/concurrency.util';
import { EvaluateIgnoreRulesHandler } from '@core-application/vault-parsing/handler/evaluate-ignore-rules.handler';
import { HttpResponseHandler } from '@core-application/vault-parsing/handler/http-response.handler';
import { ParseContentHandler } from '@core-application/vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '@core-application/vault-parsing/mappers/notes.mapper';
import { DetectAssetsService } from '@core-application/vault-parsing/services/detect-assets.service';
import { NormalizeFrontmatterService } from '@core-application/vault-parsing/services/normalize-frontmatter.service';
import { RemoveNoPublishingMarkerService } from '@core-application/vault-parsing/services/remove-no-publishing-marker.service';
import { RenderInlineDataviewService } from '@core-application/vault-parsing/services/render-inline-dataview.service';
import {
  applyCustomIndexesToRouteTree,
  CancellationError,
  type CancellationPort,
  type CollectedNote,
  migrateLegacyFoldersToRouteTree,
  validateRouteTree,
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
import type { ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
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
import { BackgroundThrottleMonitorAdapter } from './lib/infra/background-throttle-monitor.adapter';
import { ConsoleLoggerAdapter } from './lib/infra/console-logger.adapter';
import { AssetHashService } from './lib/infra/crypto/asset-hash.service';
import { BrowserHashService } from './lib/infra/crypto/browser-hash.service';
import { EventLoopMonitorAdapter } from './lib/infra/event-loop-monitor.adapter';
import { applyFinalizationProgressUpdate } from './lib/infra/finalization-progress.util';
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
import {
  PublishConfirmModal,
  type PublishConfirmOptions,
  type PublishSummary,
} from './lib/modals/publish-confirm-modal';
import { getDataviewPlugin, getSettingsApi } from './lib/obsidian/app-capabilities.util';
import { testVpsConnection } from './lib/services/http-connection.service';
import { SessionApiClient } from './lib/services/session-api.client';
import { ObsidianVpsPublishSettingTab } from './lib/setting-tab.view';
import type { PluginSettings } from './lib/settings/plugin-settings.type';
import { enrichCleanupRules } from './lib/utils/create-default-folder-config.util';
import { filterUnchangedNotes } from './lib/utils/filter-unchanged-notes.util';
import { RequestUrlResponseMapper } from './lib/utils/http-response-status.mapper';
import { insertNoPublishingMarker } from './lib/utils/insert-no-publishing-marker.util';
import {
  prepareSessionBootstrapPlan,
  startSessionBootstrapEarly,
} from './lib/utils/session-bootstrap-plan.util';
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
  enableBackgroundThrottleDebug: false,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Compute PipelineSignature for inter-publication note deduplication
 * @param version - Plugin version from manifest
 * @param renderSettings - Settings affecting rendering output
 * @returns PipelineSignature with version and renderSettingsHash
 */
async function computePipelineSignature(
  version: string,
  renderSettings: {
    calloutStyles: Record<string, string>;
    cleanupRules: Array<{ id: string; isEnabled: boolean; regex: string; replace: string }>;
    ignoredTags: string[];
  }
): Promise<{ version: string; renderSettingsHash: string }> {
  const hashService = new BrowserHashService();

  // Create stable JSON representation with SORTED KEYS at all levels
  // 1. Sort calloutStyles keys (critical for stability)
  const sortedCalloutStyles: Record<string, string> = {};
  Object.keys(renderSettings.calloutStyles)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      sortedCalloutStyles[key] = renderSettings.calloutStyles[key];
    });

  // 2. Sort array elements by id for stability
  const sortedCleanupRules = [...renderSettings.cleanupRules]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      isEnabled: r.isEnabled,
      regex: r.regex,
      replace: r.replace,
    }));

  // 3. Build stable object with sorted keys
  const stableObj = {
    calloutStyles: sortedCalloutStyles,
    cleanupRules: sortedCleanupRules,
    ignoredTags: [...renderSettings.ignoredTags].sort((a, b) => a.localeCompare(b)),
  };

  // 4. Stringify with sorted root keys
  const stable = JSON.stringify(
    stableObj,
    Object.keys(stableObj).sort((a, b) => a.localeCompare(b))
  );

  // DEBUG: Log stable representation to verify stability
  console.debug('🔐 Pipeline signature input (first 500 chars):', stable.substring(0, 500));

  const renderSettingsHash = await hashService.computeHash(stable);

  return {
    version,
    renderSettingsHash,
  };
}

function cloneSettings(settings: PluginSettings): PluginSettings {
  return structuredClone(settings);
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

type PublishExecutionOptions = PublishConfirmOptions;

const DEFAULT_PUBLISH_OPTIONS: PublishExecutionOptions = {
  deduplicationEnabled: true,
};

// -----------------------------------------------------------------------------
// Main Plugin Class
// -----------------------------------------------------------------------------

export default class ObsidianVpsPublishPlugin extends Plugin {
  settings!: PluginSettings;
  responseHandler!: HttpResponseHandler<RequestUrlResponse>;
  logger = new ConsoleLoggerAdapter({ plugin: 'ObsidianVpsPublish' });
  private currentPublishAbortController: AbortController | null = null;
  private cancelRibbonIcon: HTMLElement | null = null;
  /** Session flag: show keepFocusWarning only once per session */
  private hasShownFocusWarning = false;

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
            const summary = this.estimatePublishSummary(vps);
            new PublishConfirmModal(this.app, summary, t, async (options) => {
              await this.uploadToVps(vps, options);
            }).open();
          },
          t
        );
      },
    });

    this.addCommand({
      id: 'vps-publish-debug',
      name: t.plugin.commandPublish + ' (Debug: Background Throttle)',
      callback: async () => {
        if (!this.settings.vpsConfigs || this.settings.vpsConfigs.length === 0) {
          new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
          return;
        }
        // Temporarily enable debug flags for this run
        const originalPerfDebug = this.settings.enablePerformanceDebug;
        const originalBgThrottleDebug = this.settings.enableBackgroundThrottleDebug;
        this.settings.enablePerformanceDebug = true;
        this.settings.enableBackgroundThrottleDebug = true;

        try {
          new Notice(
            '🔍 Debug mode enabled: Background throttle monitoring active.\nSwitch tabs or minimize window during publishing to test.',
            8000
          );
          selectVpsOrAuto(
            this.app,
            this.settings.vpsConfigs,
            async (vps) => {
              await this.uploadToVps(vps);
            },
            t
          );
        } finally {
          // Restore original settings
          this.settings.enablePerformanceDebug = originalPerfDebug;
          this.settings.enableBackgroundThrottleDebug = originalBgThrottleDebug;
        }
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
        const settingsApi = getSettingsApi(this.app);
        settingsApi?.open();
        settingsApi?.openTabById(`${this.manifest.id}`);
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
          insertNoPublishingMarker(editor);
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
            const summary = this.estimatePublishSummary(vps);
            new PublishConfirmModal(this.app, summary, t, async (options) => {
              await this.uploadToVps(vps, options);
            }).open();
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
    // Validate route trees before saving
    for (const vps of this.settings.vpsConfigs) {
      if (vps.routeTree) {
        const result = validateRouteTree(vps.routeTree);
        if (!result.valid) {
          const { t } = getTranslations(this.app, this.settings);
          const errorMessages = result.conflicts
            .map((c) => `${c.type}: ${c.message}${c.path ? ` (${c.path})` : ''}`)
            .join('\n');
          new Notice(t.settings.errors.validationFailed + '\n' + errorMessages);
          this.logger.error('Route tree validation failed', {
            vpsId: vps.id,
            conflicts: result.conflicts,
          });
          throw new Error('Route tree validation failed: ' + errorMessages);
        }

        // Sort route tree: move root route ("/") to the end of the array
        // This ensures data.json has the root route last for better readability
        if (vps.routeTree.roots && vps.routeTree.roots.length > 1) {
          const rootRouteIndex = vps.routeTree.roots.findIndex(
            (root) => !root.segment || root.segment === '' || root.segment === '/'
          );
          if (rootRouteIndex !== -1 && rootRouteIndex !== vps.routeTree.roots.length - 1) {
            const rootRoute = vps.routeTree.roots.splice(rootRouteIndex, 1)[0];
            vps.routeTree.roots.push(rootRoute);
          }
        }
      }
    }

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

  /**
   * Estimate the number of notes and assets to be published for a VPS configuration.
   * This provides a rough count for the confirmation modal without doing a full parse.
   */
  estimatePublishSummary(vps: VpsConfig): PublishSummary {
    const allMarkdownFiles = this.app.vault.getMarkdownFiles();
    const allFiles = this.app.vault.getFiles();

    // Get configured vault folders from route tree
    const vaultFolders: string[] = [];
    if (vps.routeTree?.roots) {
      const collectVaultFolders = (nodes: typeof vps.routeTree.roots): void => {
        for (const node of nodes) {
          if (node.vaultFolder) {
            vaultFolders.push(node.vaultFolder);
          }
          if (node.children) {
            collectVaultFolders(node.children);
          }
        }
      };
      collectVaultFolders(vps.routeTree.roots);
    }

    // Count markdown files in configured folders
    let notesCount = 0;
    if (vaultFolders.length > 0) {
      notesCount = allMarkdownFiles.filter((f) =>
        vaultFolders.some((folder) => f.path.startsWith(folder + '/') || f.path === folder)
      ).length;
    } else {
      // Fallback: all markdown files
      notesCount = allMarkdownFiles.length;
    }

    // Estimate assets: non-markdown files in assets folder or vault folders
    const assetsFolder = this.settings.assetsFolder ?? 'assets';
    const assetsCount = allFiles.filter(
      (f) =>
        !f.path.endsWith('.md') &&
        (f.path.startsWith(assetsFolder + '/') ||
          vaultFolders.some((folder) => f.path.startsWith(folder + '/')))
    ).length;

    return {
      vpsName: vps.name ?? 'Unnamed VPS',
      vpsUrl: vps.baseUrl ?? '',
      notesCount,
      assetsCount,
    };
  }

  async uploadToVps(
    vps: VpsConfig,
    options: PublishExecutionOptions = DEFAULT_PUBLISH_OPTIONS
  ): Promise<void> {
    // Temporarily replace first VPS with the selected one for upload
    const originalVpsConfigs = [...this.settings.vpsConfigs];
    this.settings.vpsConfigs = [vps];
    try {
      await this.publishToSiteAsync(options);
    } finally {
      // Restore original
      this.settings.vpsConfigs = originalVpsConfigs;
    }
  }

  // ---------------------------------------------------------------------------
  // Publishing Logic
  // ---------------------------------------------------------------------------
  async publishToSiteAsync(options: PublishExecutionOptions = DEFAULT_PUBLISH_OPTIONS) {
    const settings = this.settings;
    const { t, locale } = getTranslations(this.app, this.settings);
    const deduplicationEnabled = options.deduplicationEnabled !== false;

    if (!settings.vpsConfigs || settings.vpsConfigs.length === 0) {
      this.logger.error('No VPS config defined');
      new Notice(t.settings.errors?.missingVpsConfig ?? 'No VPS configured');
      return;
    }

    const vps = settings.vpsConfigs[0];

    // Check if either routeTree or folders are configured
    const hasRouteTree = vps.routeTree && vps.routeTree.roots.length > 0;
    const hasFolders = vps.folders && vps.folders.length > 0;

    if (!hasRouteTree && !hasFolders) {
      this.logger.warn('No folders or route tree configured for VPS', { vpsId: vps.id });
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
    const publishStartTime = performance.now();

    // ========================================================================
    // PHASE 1: PERFORMANCE INSTRUMENTATION
    // ========================================================================
    // Generate unique upload run ID for correlation
    const uploadRunId = guidGenerator.generateGuid();
    const runLogger = scopedLogger.child({ uploadRunId });

    // Enable performance debug mode if configured
    const enablePerfDebug = settings.enablePerformanceDebug ?? false;
    const enableBgThrottleDebug = settings.enableBackgroundThrottleDebug ?? false;

    // Initialize publishing trace service
    const trace = new PublishingTraceService(uploadRunId, runLogger);
    trace.markEvent('publication_start', {
      vpsId: vps.id,
      vpsName: vps.name,
    });
    scopedLogger.info('🚀 Publishing started', {
      uploadRunId,
      vpsId: vps.id,
      vpsName: vps.name,
      perfDebugEnabled: enablePerfDebug,
      bgThrottleDebugEnabled: enableBgThrottleDebug,
    });

    // Start event loop lag monitor
    const eventLoopMonitor = new EventLoopMonitorAdapter(runLogger, 100);
    eventLoopMonitor.start();

    // Start background throttle monitor (if enabled)
    let backgroundThrottleMonitor: BackgroundThrottleMonitorAdapter | null = null;
    if (enableBgThrottleDebug) {
      backgroundThrottleMonitor = new BackgroundThrottleMonitorAdapter(runLogger, 250);
      backgroundThrottleMonitor.start();
      scopedLogger.info('🔍 Background throttle monitoring enabled (heartbeat: 250ms)');
    }

    // Initialize performance tracker
    // Debug mode enabled if logLevel is 'debug'
    const debugMode = settings.logLevel === LogLevel.debug;
    const perfTracker = new PerformanceTrackerAdapter(runLogger, debugMode);
    const sessionPerfSpan = perfTracker.startSpan('publishing-session', {
      vpsId: vps.id,
      vpsName: vps.name,
    });

    // Initialize UI pressure monitor
    const uiMonitor = new UiPressureMonitorAdapter(runLogger);

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

    // Warn user to keep focus (only once per session)
    if (!this.hasShownFocusWarning) {
      notificationAdapter.info(translate(t, 'notice.keepFocusWarning'));
      this.hasShownFocusWarning = true;
    }

    let sessionId: string | null = null;
    let sessionClient: SessionApiClient | null = null;
    let finalizationRequested = false;
    let startSessionPromise: Promise<{
      startedSession: Awaited<ReturnType<SessionApiClient['startSession']>>;
      calloutStyles: Array<{ path: string; css: string }>;
      pipelineSignature: { version: string; renderSettingsHash: string };
      calloutStyleLoadingDurationMs: number;
    }> | null = null;

    try {
      sessionClient = new SessionApiClient(
        vps.baseUrl,
        vps.apiKey,
        this.responseHandler,
        runLogger,
        t,
        { uploadRunId }
      );

      const sessionBootstrapPlan = prepareSessionBootstrapPlan({
        vps,
        settings,
        manifestVersion: this.manifest.version,
        generateGuid: () => guidGenerator.generateGuid(),
        loadCalloutStyles: (paths) => this.loadCalloutStyles(paths),
        computePipelineSignature,
      });

      const defaultNginxLimit = 1 * 1024 * 1024; // 1 MB

      startSessionPromise = startSessionBootstrapEarly({
        sessionBootstrapPlan,
        notesPlanned: 0,
        assetsPlanned: 0,
        maxBytesPerRequest: defaultNginxLimit,
        ignoreRules: vps.ignoreRules ?? [],
        ignoredTags: settings.frontmatterTagsToExclude || [],
        locale,
        deduplicationEnabled,
        startSession: (payload) => sessionClient!.startSession(payload),
        onCalloutStylesLoaded: ({ durationMs, value }) => {
          trace.recordMetric('callout_style_loading_duration_ms', durationMs, {
            calloutStylesCount: value.length,
          });
        },
        onBeforeStartSession: () => {
          trace.startStep('6-session-start');
          trace.checkpoint('6-session-start', 'calling-startSession-api');
          trace.recordMetric('time_to_first_request_ms', performance.now() - publishStartTime, {
            requestPath: '/api/session/start',
          });
        },
      });

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
        runLogger,
        vps.customRootIndexFile
      );

      trace.checkpoint('1-parse-vault-init', 'collection-method-decision');
      trace.endStep('1-parse-vault-init');

      trace.startStep('2-collect-notes');
      const parseAndTransformStart = performance.now();

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
        notes = await vault.collectFromFolder(
          {
            folderConfig: sessionBootstrapPlan.effectiveFolders,
          },
          cancellation
        );
      }

      trace.endStep('2-collect-notes', { notesCount: notes.length });

      stats.totalNotesAnalyzed = notes.length;

      // Check if Dataview plugin is available
      const dataviewPlugin = getDataviewPlugin(this.app);
      const dataviewApi = dataviewPlugin?.api;

      trace.startStep('3-check-dataview');

      scopedLogger.debug('🔌 Dataview plugin status check', {
        hasPluginsManager: 'plugins' in this.app,
        hasDataviewPlugin: !!dataviewPlugin,
        hasDataviewApi: !!dataviewApi,
        dataviewVersion: dataviewPlugin?.manifest?.version,
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
        runLogger,
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
      trace.recordMetric(
        'parse_and_transform_duration_ms',
        performance.now() - parseAndTransformStart,
        {
          notesCollected: notes.length,
          publishablesCount: publishables.length,
        }
      );

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
      const dedupStart = performance.now();

      const deduplicated = publishables;

      perfTracker.endSpan(deduplicateSpan, {
        inputCount: publishables.length,
        outputCount: deduplicated.length,
        duplicatesRemoved: publishables.length - deduplicated.length,
      });
      trace.recordMetric('dedup_duration_ms', performance.now() - dedupStart, {
        inputCount: publishables.length,
        outputCount: deduplicated.length,
      });

      trace.endStep('5b-deduplicate-notes', {
        inputCount: publishables.length,
        outputCount: deduplicated.length,
      });

      if (deduplicationEnabled) {
        scopedLogger.debug('Notes deduplicated', {
          inputCount: publishables.length,
          outputCount: deduplicated.length,
          removed: publishables.length - deduplicated.length,
        });
      } else {
        scopedLogger.info('Deduplication disabled for this publication', {
          publishablesCount: publishables.length,
        });
      }

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
        if (startSessionPromise !== null && sessionClient) {
          try {
            const startedBootstrap = await startSessionPromise;
            sessionId = startedBootstrap.startedSession.sessionId;
            await sessionClient.abortSession(sessionId);
          } catch (abortErr) {
            this.logger.error('Failed to abort early-started empty session', { error: abortErr });
          }
        }
        new Notice(translate(t, 'notice.noPublishableNotes'));
        totalProgressAdapter.finish();
        return;
      }

      // Don't show analysis stats that could reveal ignored count
      // Progress bar will show current step instead

      // ====================================================================
      // SESSION START - Démarrage de la session
      // ====================================================================
      trace.checkpoint('6-session-start', 'awaiting-startSession-response');

      const {
        startedSession: started,
        calloutStyles,
        pipelineSignature,
      } = await startSessionPromise;

      const { customIndexConfigs, folderDisplayNames, validCleanupRules } = sessionBootstrapPlan;

      this.logger.debug('Custom index configs built', {
        count: customIndexConfigs.length,
        configs: customIndexConfigs,
      });

      this.logger.debug('Folder display names collected', {
        count: Object.keys(folderDisplayNames).length,
        displayNames: folderDisplayNames,
      });

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

      this.logger.info('🔑 Pipeline signature computed', {
        version: pipelineSignature.version,
        renderSettingsHash: pipelineSignature.renderSettingsHash,
        calloutStylesCount: calloutStyles.length,
        cleanupRulesCount: validCleanupRules.length,
        ignoredTagsCount: (settings.frontmatterTagsToExclude || []).length,
      });

      sessionId = started.sessionId;
      const serverRequestLimit = started.maxBytesPerRequest;
      const existingAssetHashes = deduplicationEnabled ? (started.existingAssetHashes ?? []) : [];
      const existingSourceNoteHashesByVaultPath = deduplicationEnabled
        ? (started.existingSourceNoteHashesByVaultPath ?? {})
        : {};
      const pipelineChanged = deduplicationEnabled ? (started.pipelineChanged ?? true) : true;
      const uploadConcurrency = deduplicationEnabled ? settings.maxConcurrentUploads || 3 : 1;

      trace.endStep('6-session-start', {
        sessionId,
        maxBytesPerRequest: serverRequestLimit,
        provisionalNotesPlanned: 0,
        provisionalAssetsPlanned: 0,
        actualPublishableNotes: publishableCount,
        actualAssetsPlanned: assetsPlanned,
        existingAssetHashesCount: existingAssetHashes.length,
        existingSourceNoteHashesByVaultPathCount: Object.keys(existingSourceNoteHashesByVaultPath)
          .length,
        pipelineChanged,
        deduplicationEnabled,
      });

      this.logger.debug('Session started', {
        sessionId,
        maxBytesPerRequest: serverRequestLimit,
        provisionalNotesPlanned: 0,
        provisionalAssetsPlanned: 0,
        actualPublishableNotes: publishableCount,
        actualAssetsPlanned: assetsPlanned,
        existingSourceNoteHashesByVaultPathCount: Object.keys(existingSourceNoteHashesByVaultPath)
          .length,
        pipelineChanged,
        deduplicationEnabled,
      });

      // ====================================================================
      // ÉTAPE 2: UPLOAD_NOTES - Upload des notes
      // ====================================================================
      trace.startStep('7-upload-notes');

      const uploadNotesSpan = perfTracker.startSpan('upload-notes');

      // ====================================================================
      // 2a: FILTER UNCHANGED NOTES (inter-publication deduplication)
      // ====================================================================
      let notesToUpload = deduplicated;
      const noteHashFilterStart = performance.now();
      let noteHashFilterApplied = false;

      if (deduplicationEnabled && !pipelineChanged) {
        noteHashFilterApplied = true;
        trace.checkpoint('7-upload-notes', 'filtering-unchanged-notes');
        const hashService = new BrowserHashService();
        const filterResult = await filterUnchangedNotes({
          notes: deduplicated,
          existingSourceNoteHashesByVaultPath,
          pipelineChanged,
          hashService,
        });

        noteHashFilterApplied = filterResult.applied;
        notesToUpload = filterResult.notesToUpload;

        if (filterResult.applied) {
          this.logger.info('Notes filtered by inter-publication deduplication', {
            totalNotes: deduplicated.length,
            toUpload: notesToUpload.length,
            skipped: filterResult.skippedCount,
            strategy: 'source-hash-by-vault-path',
          });

          trace.checkpoint('7-upload-notes', 'filtering-complete', {
            skippedCount: filterResult.skippedCount,
            uploadCount: notesToUpload.length,
          });
        }
      } else if (!deduplicationEnabled) {
        this.logger.info('Deduplication disabled, uploading all notes', {
          totalNotes: deduplicated.length,
        });
      } else if (pipelineChanged) {
        this.logger.info('Pipeline changed, uploading all notes (full re-render)', {
          totalNotes: deduplicated.length,
        });
      }
      trace.recordMetric(
        'note_hash_filter_duration_ms',
        noteHashFilterApplied ? performance.now() - noteHashFilterStart : 0,
        {
          applied: noteHashFilterApplied,
          totalNotes: deduplicated.length,
          notesToUpload: notesToUpload.length,
        }
      );

      const notesUploader = new NotesUploaderAdapter(
        sessionClient,
        sessionId,
        new GuidGeneratorAdapter(),
        runLogger,
        serverRequestLimit,
        stepProgressManager,
        validCleanupRules,
        uploadConcurrency
      );

      // Calculer le nombre de batchs
      const notesBatchInfoStart = performance.now();
      const notesBatchInfo = notesUploader.getBatchInfo(notesToUpload);
      trace.recordMetric('notes_batch_info_duration_ms', performance.now() - notesBatchInfoStart, {
        notesCount: notesToUpload.length,
        batchCount: notesBatchInfo.batchCount,
      });
      stats.notesBatchCount = notesBatchInfo.batchCount;

      stepProgressManager.startStep(
        ProgressStepId.UPLOAD_NOTES,
        getStepLabel(t, ProgressStepId.UPLOAD_NOTES),
        notesToUpload.length
      );

      notificationAdapter.info(
        translate(t, 'notice.uploadingNotesBatches', {
          count: String(stats.notesBatchCount),
          plural: stats.notesBatchCount > 1 ? 'es' : '',
        })
      );

      await notesUploader.upload(notesToUpload);

      stats.notesUploaded = notesToUpload.length;

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

        const assetHasher = new AssetHashService();
        const assetsVault = new ObsidianAssetsVaultAdapter(this.app, runLogger);
        const assetsUploader = new AssetsUploaderAdapter(
          sessionClient,
          sessionId,
          new GuidGeneratorAdapter(),
          assetHasher,
          runLogger,
          serverRequestLimit,
          stepProgressManager,
          uploadConcurrency,
          existingAssetHashes,
          deduplicationEnabled
        );

        // Log assets to be resolved for debugging
        const allAssetsToResolve = notesWithAssets.flatMap((n) =>
          (n.assets ?? []).map((a) => ({
            noteVaultPath: n.vaultPath,
            target: a.target,
            kind: a.kind,
            origin: a.origin,
            hasLeafletBlocks: (n.leafletBlocks?.length ?? 0) > 0,
          }))
        );
        scopedLogger.info('Assets to resolve', {
          notesWithAssetsCount: notesWithAssets.length,
          totalAssets: allAssetsToResolve.length,
          assetsFolder: settings.assetsFolder,
          vaultFallbackEnabled: settings.enableAssetsVaultFallback,
          assets: allAssetsToResolve.slice(0, 20), // Log first 20 for debugging
        });

        const resolvedAssets = await assetsVault.resolveAssetsFromNotes(
          notesWithAssets,
          settings.assetsFolder,
          settings.enableAssetsVaultFallback
        );

        // Warn user if some assets could not be resolved
        const totalExpectedAssets = notesWithAssets.reduce(
          (sum, n) => sum + (Array.isArray(n.assets) ? n.assets.length : 0),
          0
        );
        const missingAssetsCount = totalExpectedAssets - resolvedAssets.length;
        if (missingAssetsCount > 0) {
          const missingAssets = this.findMissingAssets(notesWithAssets, resolvedAssets);
          scopedLogger.warn('Some assets could not be found in vault', {
            totalExpectedAssets,
            resolvedAssets: resolvedAssets.length,
            missingAssetsCount,
            missingAssets: missingAssets.slice(0, 10), // Log first 10 for debugging
            assetsFolder: settings.assetsFolder,
            vaultFallbackEnabled: settings.enableAssetsVaultFallback,
          });

          // Show user-visible warning
          new Notice(
            translate(t, 'notice.missingAssets', {
              count: String(missingAssetsCount),
              assetsFolder: settings.assetsFolder || 'assets',
            }),
            10000 // Show for 10 seconds
          );
        }

        // Calculer le nombre de batchs
        const assetBatchInfoStart = performance.now();
        const assetsBatchInfo = await assetsUploader.getBatchInfo(resolvedAssets);
        trace.recordMetric(
          'asset_batch_info_duration_ms',
          performance.now() - assetBatchInfoStart,
          {
            assetCount: resolvedAssets.length,
            batchCount: assetsBatchInfo.batchCount,
          }
        );
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
        100
      );

      // Extract all routes collected from the vault for deleted-page detection.
      // CRITICAL: Use publishables (all eligible notes) not deduplicated (only unique ones)
      // to ensure backend receives complete list of vault routes for manifest merge
      finalizationRequested = true;
      const finishResult = await sessionClient.finishSession(
        sessionId,
        {
          notesProcessed: stats.notesUploaded,
          assetsProcessed: stats.assetsUploaded,
        },
        {
          onFinalizationUpdate: (update) => {
            applyFinalizationProgressUpdate(stepProgressManager, t, update);
          },
        }
      );

      // Capture promotion stats from finalization
      if (finishResult.promotionStats) {
        stats.notesDeduplicated = finishResult.promotionStats.notesDeduplicated;
        stats.assetsDeduplicated = finishResult.promotionStats.assetsDeduplicated;
        stats.notesDeleted = finishResult.promotionStats.notesDeleted;
      }

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

      // Stop background throttle monitor (if enabled)
      let backgroundThrottleStats = null;
      if (backgroundThrottleMonitor) {
        backgroundThrottleStats = backgroundThrottleMonitor.stop();
      }

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

      // Generate and log background throttle summary (if enabled)
      if (backgroundThrottleStats) {
        const bgThrottleSummary = backgroundThrottleMonitor!.generateSummary();
        scopedLogger.info('🔍 ' + bgThrottleSummary);
      }

      // Afficher les stats finales
      const summary = formatPublishingStats(stats, t.publishingStats);

      // Add performance debug summary if enabled
      let perfDebugInfo = '';
      if (enablePerfDebug) {
        const traceData = trace.getStructuredData();
        const topSteps = traceData.steps
          .slice()
          .sort((a, b) => b.durationSec - a.durationSec)
          .slice(0, 3)
          .map((step) => `${step.name}: ${step.durationSec.toFixed(2)}s`)
          .join(', ');

        perfDebugInfo = `\n\n🔍 Performance Debug:\nTotal: ${traceData.totalDurationSec.toFixed(2)}s\nTop steps: ${topSteps}\nEvent loop p95 lag: ${eventLoopStats.p95LagMs.toFixed(0)}ms`;
      }

      // Add background throttle debug summary if enabled
      if (enableBgThrottleDebug && backgroundThrottleStats) {
        perfDebugInfo += `\n\n🔍 Background Throttle Debug:\nStalled heartbeats: ${backgroundThrottleStats.stalledHeartbeats}\nMax drift: ${backgroundThrottleStats.maxHeartbeatDriftMs.toFixed(0)}ms\nTime in background: ${(backgroundThrottleStats.timeInBackgroundMs / 1000).toFixed(1)}s`;
      }

      // Add performance hint if debug mode is off
      let perfHint = '';
      if (!debugMode && !enablePerfDebug) {
        perfHint = t.notice.debugModeHint;
      }

      new Notice(summary + perfDebugInfo + perfHint, 10000); // Afficher pendant 10 secondes

      this.logger.debug('Publishing completed successfully', { stats });

      // Log deduplication statistics if available
      if (
        stats.notesDeduplicated !== undefined ||
        stats.assetsDeduplicated !== undefined ||
        stats.notesDeleted !== undefined
      ) {
        scopedLogger.info('📊 Deduplication Statistics', {
          uploadRunId,
          notesDeduplicated: stats.notesDeduplicated ?? 0,
          assetsDeduplicated: stats.assetsDeduplicated ?? 0,
          notesDeleted: stats.notesDeleted ?? 0,
          notesPublished: stats.notesUploaded,
          assetsPublished: stats.assetsUploaded,
        });
      }
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
      if (!sessionId && startSessionPromise !== null) {
        try {
          const startedBootstrap = await startSessionPromise;
          sessionId = startedBootstrap.startedSession.sessionId;
        } catch (startErr) {
          this.logger.debug('Early startSession did not yield an abortable session', {
            error: startErr,
          });
        }
      }
      if (sessionId && sessionClient && !finalizationRequested) {
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

  /**
   * Finds assets that were expected but not resolved.
   * Used for debugging when assets are missing.
   */
  private findMissingAssets(
    notesWithAssets: PublishableNote[],
    resolvedAssets: ResolvedAssetFile[]
  ): string[] {
    const resolvedTargets = new Set(resolvedAssets.map((a) => a.fileName.toLowerCase()));

    const missing: string[] = [];
    for (const note of notesWithAssets) {
      for (const asset of note.assets ?? []) {
        const target = asset.target?.toLowerCase();
        const baseName = target?.split('/').pop();
        if (baseName && !resolvedTargets.has(baseName)) {
          missing.push(`${asset.target} (from ${note.vaultPath})`);
        }
      }
    }

    return missing;
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
          yieldEveryN: 2,
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

    return new ParseContentHandler(
      normalizeFrontmatterService,
      evaluateIgnoreRulesHandler,
      noteMapper,
      inlineDataviewRenderer,
      leafletBlocksDetector,
      removeNoPublishingMarkerService,
      assetsDetector,
      logger,
      dataviewProcessor, // Plugin-side Dataview processing
      perfTracker, // Performance tracking
      cancellation // Cancellation support
    );
  }
}
