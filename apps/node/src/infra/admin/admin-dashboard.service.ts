import { promises as fs } from 'node:fs';
import path from 'node:path';

import type {
  ContentSearchIndex,
  LoggerPort,
  Manifest,
  ManifestAsset,
  PromotionStats,
  Session,
} from '@core-domain';

import { EnvConfig } from '../config/env-config';
import { type ContentVersionService } from '../content-version/content-version.service';
import { FileSystemSessionRepository } from '../filesystem/file-system-session.repository';
import { type ManifestFileSystem } from '../filesystem/manifest-file-system';
import type { BackpressureMiddleware } from '../http/express/middleware/backpressure.middleware';
import type { PerformanceMonitoringMiddleware } from '../http/express/middleware/performance-monitoring.middleware';
import {
  type FinalizationJob,
  type FinalizationJobHistoryEntry,
  type SessionFinalizationJobService,
} from '../sessions/session-finalization-job.service';
import { type AdminRuntimeControlService } from './admin-runtime-control.service';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface ParsedLogEntry {
  level: LogLevel;
  message: string;
  timestamp?: string;
  meta: Record<string, unknown>;
  raw: string;
}

export interface AdminNotification {
  level: 'warn' | 'error';
  message: string;
  timestamp?: string;
  meta: Record<string, unknown>;
}

export interface AdminPublicationHistoryEntry {
  sessionId: string;
  sessionStatus: Session['status'];
  finalizationStatus: FinalizationJob['status'] | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notesPlanned: number;
  notesProcessed: number;
  assetsPlanned: number;
  assetsProcessed: number;
  contentRevision: string | null;
  error: string | null;
  promotionStats?: PromotionStats;
}

export interface AdminStorageSummary {
  disk: {
    totalBytes: number | null;
    freeBytes: number | null;
    availableBytes: number | null;
    usagePercent: number | null;
  };
  contentBytes: number;
  assetsBytes: number;
  largestAssets: Array<{
    path: string;
    size: number;
    mimeType: string;
    uploadedAt: string | null;
  }>;
  logs: {
    rotatedFilesCount: number;
    rotatedFilesTotalBytes: number;
    rotationRecommended: boolean;
  };
}

export interface AdminDiagnosticsSummary {
  status: 'ok' | 'warn' | 'error';
  missingRequiredEnv: string[];
  missingRecommendedEnv: string[];
  messages: string[];
  contentVersion: {
    fileExists: boolean;
    generatedAt: string | null;
    version: string | null;
    revisionMatchesManifest: boolean | null;
  };
  manifest: {
    exists: boolean;
    missingPageFiles: number;
    missingAssetFiles: number;
    duplicateRoutes: string[];
    searchIndexEntries: number | null;
    searchIndexMatchesManifest: boolean | null;
    searchIndexRevisionMatchesManifest: boolean | null;
  };
}

export interface AdminControlSummary {
  maintenance: ReturnType<AdminRuntimeControlService['getMaintenanceState']>;
  backpressure: {
    config: ReturnType<BackpressureMiddleware['getConfig']> | null;
    metrics: ReturnType<BackpressureMiddleware['getLoadMetrics']> | null;
  };
}

export interface AdminDashboardSnapshot {
  publication: {
    lastPublishedAt: string | null;
    manifestUpdatedAt: string | null;
    contentRevision: string | null;
    contentVersion: string | null;
    pagesCount: number;
    assetsCount: number;
  };
  server: {
    nodeEnv: string;
    loggerLevel: string;
    uptimeSeconds: number;
    pid: number;
    logFilePath: string;
    logFileSizeBytes: number;
    logFileUpdatedAt: string | null;
  };
  health: {
    status: 'healthy' | 'degraded';
    memory: {
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
    };
    load?: ReturnType<BackpressureMiddleware['getLoadMetrics']>;
    performance?: ReturnType<PerformanceMonitoringMiddleware['getMetrics']>;
  };
  storage: AdminStorageSummary;
  history: {
    recentSessions: AdminPublicationHistoryEntry[];
    queue: ReturnType<SessionFinalizationJobService['getQueueStats']>;
  };
  diagnostics: AdminDiagnosticsSummary;
  controls: AdminControlSummary;
  notifications: AdminNotification[];
}

export interface AdminLogEntry {
  level: LogLevel;
  message: string;
  timestamp?: string;
  meta: Record<string, unknown>;
  raw: string;
}

export interface AdminLogTailResponse {
  lines: AdminLogEntry[];
  totalReturned: number;
  logFilePath: string;
}

export interface AdminLogRotationResult {
  rotated: boolean;
  rotatedTo: string | null;
}

export class AdminDashboardService {
  constructor(
    private readonly manifestStorage: ManifestFileSystem,
    private readonly contentVersionService: ContentVersionService,
    private readonly sessionRepository: FileSystemSessionRepository,
    private readonly finalizationJobService: SessionFinalizationJobService,
    private readonly runtimeControl: AdminRuntimeControlService,
    private readonly backpressure: BackpressureMiddleware | undefined,
    private readonly perfMonitor: PerformanceMonitoringMiddleware | undefined,
    private readonly logger: LoggerPort | undefined,
    private readonly env: typeof EnvConfig
  ) {}

  async getSnapshot(): Promise<AdminDashboardSnapshot> {
    const [
      manifest,
      contentVersion,
      logFilePath,
      logFileStat,
      notifications,
      storage,
      history,
      diagnostics,
    ] = await Promise.all([
      this.manifestStorage.load(),
      this.contentVersionService.getVersion(),
      this.resolveLogFilePath(),
      this.getLogFileStat(),
      this.getNotifications(),
      this.getStorageSummary(),
      this.getHistory(),
      this.getDiagnostics(),
    ]);

    const mem = process.memoryUsage();
    const load = this.backpressure?.getLoadMetrics();
    const performance = this.perfMonitor?.getMetrics();

    return {
      publication: {
        lastPublishedAt: contentVersion?.generatedAt ?? null,
        manifestUpdatedAt: manifest?.lastUpdatedAt?.toISOString?.() ?? null,
        contentRevision: contentVersion?.contentRevision ?? manifest?.contentRevision ?? null,
        contentVersion: contentVersion?.version ?? null,
        pagesCount: manifest?.pages.length ?? 0,
        assetsCount: manifest?.assets?.length ?? 0,
      },
      server: {
        nodeEnv: this.env.nodeEnv(),
        loggerLevel: this.env.loggerLevel(),
        uptimeSeconds: Math.round(process.uptime()),
        pid: process.pid,
        logFilePath,
        logFileSizeBytes: Number(logFileStat?.size ?? 0),
        logFileUpdatedAt: logFileStat ? logFileStat.mtime.toISOString() : null,
      },
      health: {
        status: load?.isUnderPressure ? 'degraded' : 'healthy',
        memory: {
          heapUsedMB: this.roundMb(mem.heapUsed),
          heapTotalMB: this.roundMb(mem.heapTotal),
          rssMB: this.roundMb(mem.rss),
        },
        load,
        performance,
      },
      storage,
      history,
      diagnostics,
      controls: {
        maintenance: this.runtimeControl.getMaintenanceState(),
        backpressure: {
          config: this.backpressure?.getConfig() ?? null,
          metrics: this.backpressure?.getLoadMetrics() ?? null,
        },
      },
      notifications,
    };
  }

  async getHistory(limit = 15): Promise<AdminDashboardSnapshot['history']> {
    const [recentSessions, persistedHistory] = await Promise.all([
      this.sessionRepository.listRecent(limit * 2),
      this.finalizationJobService.getPersistedHistory(limit * 3),
    ]);

    const liveJobs = this.finalizationJobService
      .getRecentJobs(limit * 3)
      .map((job) => this.toHistoryEntry(job));

    const latestHistoryBySession = new Map<string, FinalizationJobHistoryEntry>();
    for (const entry of [...liveJobs, ...persistedHistory].sort(
      (left, right) => this.toMillis(right.createdAt) - this.toMillis(left.createdAt)
    )) {
      if (!latestHistoryBySession.has(entry.sessionId)) {
        latestHistoryBySession.set(entry.sessionId, entry);
      }
    }

    const recent = recentSessions
      .map((session) =>
        this.toPublicationHistoryEntry(session, latestHistoryBySession.get(session.id) ?? null)
      )
      .sort((left, right) => this.historyTimestamp(right) - this.historyTimestamp(left))
      .slice(0, limit);

    return {
      recentSessions: recent,
      queue: this.finalizationJobService.getQueueStats(),
    };
  }

  async rotateLogFile(): Promise<AdminLogRotationResult> {
    const logPath = await this.resolveLogFilePath();
    const logFileStat = await this.getLogFileStat();
    if (!logFileStat || Number(logFileStat.size) <= 0) {
      return { rotated: false, rotatedTo: null };
    }

    const parsed = path.parse(logPath);
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '-');
    const rotatedTo = path.join(parsed.dir, `${parsed.name}.${stamp}${parsed.ext || '.log'}`);

    await fs.mkdir(parsed.dir, { recursive: true });
    await fs.rename(logPath, rotatedTo);

    this.logger?.info('Admin log rotation completed', { logPath, rotatedTo });
    return { rotated: true, rotatedTo };
  }

  updateMaintenanceMode(enabled: boolean, message?: string | null) {
    const state = this.runtimeControl.setMaintenanceMode(enabled, message);
    this.logger?.warn('Admin maintenance mode updated', { ...state });
    return state;
  }

  updateBackpressure(config: {
    maxActiveRequests?: number;
    maxEventLoopLagMs?: number;
    maxMemoryUsageMB?: number;
  }) {
    const nextConfig = this.backpressure?.updateConfig(config) ?? null;
    this.logger?.warn(
      'Admin backpressure configuration updated',
      nextConfig ? { ...nextConfig } : {}
    );
    return nextConfig;
  }

  async getLogTail(limit = 200, minimumLevel?: LogLevel): Promise<AdminLogTailResponse> {
    const entries = await this.readLogEntries(limit, minimumLevel);
    const logFilePath = await this.resolveLogFilePath();
    return {
      lines: entries,
      totalReturned: entries.length,
      logFilePath,
    };
  }

  async getNotifications(limit = 20): Promise<AdminNotification[]> {
    const entries = await this.readLogEntries(Math.max(limit * 6, 120), undefined);
    return entries
      .filter(
        (entry): entry is ParsedLogEntry & { level: 'warn' | 'error' } =>
          entry.level === 'warn' || entry.level === 'error'
      )
      .slice(0, limit)
      .map((entry) => ({
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp,
        meta: entry.meta,
      }));
  }

  private async getStorageSummary(): Promise<AdminStorageSummary> {
    const manifest = await this.manifestStorage.load();
    const [contentBytes, assetsBytes, disk, rotatedLogs] = await Promise.all([
      this.getDirectorySize(this.env.contentRoot()),
      this.getDirectorySize(this.env.assetsRoot()),
      this.getDiskSummary(this.env.contentRoot()),
      this.getRotatedLogsSummary(),
    ]);

    const largestAssets = [...(manifest?.assets ?? [])]
      .sort((left, right) => right.size - left.size)
      .slice(0, 8)
      .map((asset) => ({
        path: asset.path,
        size: asset.size,
        mimeType: asset.mimeType,
        uploadedAt: asset.uploadedAt?.toISOString?.() ?? null,
      }));

    return {
      disk,
      contentBytes,
      assetsBytes,
      largestAssets,
      logs: rotatedLogs,
    };
  }

  private async getDiagnostics(): Promise<AdminDiagnosticsSummary> {
    const manifest = await this.manifestStorage.load();
    const contentVersion = await this.contentVersionService.getVersion();
    const logPath = await this.resolveLogFilePath();
    const contentVersionPath = path.join(this.env.contentRoot(), '_content-version.json');
    const searchIndexPath = path.join(this.env.contentRoot(), '_search-index.json');

    const [contentVersionExists, searchIndex, missingPageFiles, missingAssetFiles] =
      await Promise.all([
        this.pathExists(contentVersionPath),
        this.loadSearchIndex(searchIndexPath),
        manifest ? this.countMissingPageFiles(manifest) : Promise.resolve(0),
        manifest ? this.countMissingAssetFiles(manifest.assets ?? []) : Promise.resolve(0),
      ]);

    const duplicateRoutes = manifest ? this.findDuplicateRoutes(manifest) : [];
    const missingRequiredEnv = this.collectMissingEnv([
      'BASE_URL',
      'ADMIN_API_PATH',
      'ADMIN_USERNAME_HASH',
      'ADMIN_PASSWORD_HASH',
    ]);
    const missingRecommendedEnv = this.collectMissingEnv([
      'AUTHOR',
      'REPO_URL',
      'REPORT_ISSUES_URL',
      'HOME_WELCOME_TITLE',
    ]);
    const searchIndexEntries = searchIndex?.entries.length ?? null;
    const searchIndexMatchesManifest =
      manifest && searchIndex ? searchIndex.entries.length === manifest.pages.length : null;
    const searchIndexRevisionMatchesManifest =
      manifest && searchIndex
        ? (searchIndex.contentRevision ?? null) === (manifest.contentRevision ?? null)
        : null;

    const messages: string[] = [];
    if (!manifest) {
      messages.push('Manifest introuvable dans le contenu publié.');
    }
    if (missingRequiredEnv.length > 0) {
      messages.push(`Variables critiques manquantes: ${missingRequiredEnv.join(', ')}`);
    }
    if (missingPageFiles > 0) {
      messages.push(`${missingPageFiles} pages du manifest ne pointent vers aucun fichier HTML.`);
    }
    if (missingAssetFiles > 0) {
      messages.push(`${missingAssetFiles} assets du manifest sont absents du disque.`);
    }
    if (duplicateRoutes.length > 0) {
      messages.push(
        `Routes dupliquées dans le manifest: ${duplicateRoutes.slice(0, 5).join(', ')}`
      );
    }
    if (searchIndexMatchesManifest === false) {
      messages.push('Le search index n’est pas cohérent avec le manifest.');
    }
    if ((contentVersion?.contentRevision ?? null) !== (manifest?.contentRevision ?? null)) {
      messages.push('Le content version ne correspond pas à la révision du manifest.');
    }
    if (!(await this.pathExists(logPath))) {
      messages.push('Le fichier de log actif est introuvable.');
    }

    const status: AdminDiagnosticsSummary['status'] =
      !manifest || missingRequiredEnv.length > 0 || missingPageFiles > 0 || missingAssetFiles > 0
        ? 'error'
        : messages.length > 0
          ? 'warn'
          : 'ok';

    return {
      status,
      missingRequiredEnv,
      missingRecommendedEnv,
      messages,
      contentVersion: {
        fileExists: contentVersionExists,
        generatedAt: contentVersion?.generatedAt ?? null,
        version: contentVersion?.version ?? null,
        revisionMatchesManifest:
          manifest && contentVersion
            ? (contentVersion.contentRevision ?? null) === (manifest.contentRevision ?? null)
            : null,
      },
      manifest: {
        exists: Boolean(manifest),
        missingPageFiles,
        missingAssetFiles,
        duplicateRoutes,
        searchIndexEntries,
        searchIndexMatchesManifest,
        searchIndexRevisionMatchesManifest,
      },
    };
  }

  private toPublicationHistoryEntry(
    session: Session,
    job: FinalizationJobHistoryEntry | null
  ): AdminPublicationHistoryEntry {
    return {
      sessionId: session.id,
      sessionStatus: session.status,
      finalizationStatus: job?.status ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: job?.completedAt ?? null,
      notesPlanned: session.notesPlanned,
      notesProcessed: session.notesProcessed,
      assetsPlanned: session.assetsPlanned,
      assetsProcessed: session.assetsProcessed,
      contentRevision: job?.result?.contentRevision ?? null,
      error: job?.error ?? null,
      promotionStats: job?.result?.promotionStats,
    };
  }

  private toHistoryEntry(job: FinalizationJob): FinalizationJobHistoryEntry {
    return {
      jobId: job.jobId,
      sessionId: job.sessionId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      error: job.error,
      result: job.result,
    };
  }

  private historyTimestamp(entry: AdminPublicationHistoryEntry): number {
    return Math.max(
      this.toMillis(entry.completedAt),
      this.toMillis(entry.updatedAt),
      this.toMillis(entry.createdAt)
    );
  }

  private async readLogEntries(limit: number, minimumLevel?: LogLevel): Promise<ParsedLogEntry[]> {
    const content = await this.readLogTailBytes();
    const levels = this.allowedLevels(minimumLevel);

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .reverse()
      .map((line) => this.parseLogEntry(line))
      .filter((entry): entry is ParsedLogEntry => entry !== null && levels.has(entry.level))
      .slice(0, limit);
  }

  private parseLogEntry(rawLine: string): ParsedLogEntry | null {
    try {
      const parsed = JSON.parse(rawLine) as Record<string, unknown>;
      const level = this.normalizeLevel(parsed['level']);
      if (!level) {
        return null;
      }

      const { level: _level, message, timestamp, ...meta } = parsed;
      return {
        level,
        message: typeof message === 'string' ? message : rawLine,
        timestamp: typeof timestamp === 'string' ? timestamp : undefined,
        meta,
        raw: rawLine,
      };
    } catch {
      return {
        level: 'info',
        message: rawLine,
        timestamp: undefined,
        meta: {},
        raw: rawLine,
      };
    }
  }

  private normalizeLevel(value: unknown): LogLevel | null {
    if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
      return value;
    }
    return null;
  }

  private allowedLevels(minimumLevel?: LogLevel): Set<LogLevel> {
    if (!minimumLevel) {
      return new Set<LogLevel>(['debug', 'info', 'warn', 'error']);
    }

    switch (minimumLevel) {
      case 'error':
        return new Set<LogLevel>(['error']);
      case 'warn':
        return new Set<LogLevel>(['warn', 'error']);
      case 'info':
        return new Set<LogLevel>(['info', 'warn', 'error']);
      case 'debug':
      default:
        return new Set<LogLevel>(['debug', 'info', 'warn', 'error']);
    }
  }

  private async readLogTailBytes(maxBytes = 256 * 1024): Promise<string> {
    const logPath = await this.resolveLogFilePath();

    try {
      const handle = await fs.open(logPath, 'r');
      try {
        const stat = await handle.stat();
        const start = Math.max(0, Number(stat.size) - maxBytes);
        const length = Number(stat.size) - start;
        if (length <= 0) {
          return '';
        }

        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, start);
        return buffer.toString('utf8');
      } finally {
        await handle.close();
      }
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code !== 'ENOENT') {
        this.logger?.warn('Failed to read admin log tail', {
          error: error instanceof Error ? error.message : String(error),
          logFilePath: logPath,
        });
      }
      return '';
    }
  }

  private async getLogFileStat(): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
    try {
      return await fs.stat(await this.resolveLogFilePath());
    } catch {
      return null;
    }
  }

  private async getRotatedLogsSummary(): Promise<AdminStorageSummary['logs']> {
    const logPath = await this.resolveLogFilePath();
    const parsed = path.parse(logPath);
    const logFileStat = await this.getLogFileStat();

    try {
      const entries = await fs.readdir(parsed.dir, { withFileTypes: true });
      const rotatedFiles = await Promise.all(
        entries
          .filter(
            (entry) =>
              entry.isFile() &&
              entry.name.startsWith(`${parsed.name}.`) &&
              entry.name.endsWith(parsed.ext || '.log')
          )
          .map(async (entry) => {
            const stat = await fs.stat(path.join(parsed.dir, entry.name));
            return Number(stat.size);
          })
      );

      return {
        rotatedFilesCount: rotatedFiles.length,
        rotatedFilesTotalBytes: rotatedFiles.reduce((sum, size) => sum + size, 0),
        rotationRecommended: Number(logFileStat?.size ?? 0) >= 10 * 1024 * 1024,
      };
    } catch {
      return {
        rotatedFilesCount: 0,
        rotatedFilesTotalBytes: 0,
        rotationRecommended: Number(logFileStat?.size ?? 0) >= 10 * 1024 * 1024,
      };
    }
  }

  private async getDiskSummary(rootPath: string): Promise<AdminStorageSummary['disk']> {
    try {
      const stats = await fs.statfs(rootPath);
      const blockSize = Number(stats.bsize);
      const totalBytes = Number(stats.blocks) * blockSize;
      const freeBytes = Number(stats.bfree) * blockSize;
      const availableBytes = Number(stats.bavail) * blockSize;
      const usagePercent =
        totalBytes > 0 ? Number((((totalBytes - freeBytes) / totalBytes) * 100).toFixed(2)) : null;

      return {
        totalBytes,
        freeBytes,
        availableBytes,
        usagePercent,
      };
    } catch {
      return {
        totalBytes: null,
        freeBytes: null,
        availableBytes: null,
        usagePercent: null,
      };
    }
  }

  private async getDirectorySize(rootPath: string): Promise<number> {
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      const sizes = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(rootPath, entry.name);
          if (entry.isDirectory()) {
            return this.getDirectorySize(fullPath);
          }
          if (entry.isFile()) {
            const stat = await fs.stat(fullPath);
            return Number(stat.size);
          }
          return 0;
        })
      );

      return sizes.reduce((sum, value) => sum + value, 0);
    } catch {
      return 0;
    }
  }

  private async countMissingPageFiles(manifest: Manifest): Promise<number> {
    const checks = await Promise.all(
      manifest.pages.map(async (page) => {
        const pagePath = this.resolveHtmlPath(page.route);
        return (await this.pathExists(pagePath)) ? 0 : 1;
      })
    );
    return checks.reduce<number>((sum, value) => sum + value, 0);
  }

  private async countMissingAssetFiles(assets: ManifestAsset[]): Promise<number> {
    const checks = await Promise.all(
      assets.map(async (asset) => {
        const relativeAssetPath = asset.path
          .replace(/^\/+assets\/+/i, '')
          .replace(/^\/+/, '')
          .replace(/^_assets\/+/, '_assets/');
        const assetPath = path.join(this.env.assetsRoot(), relativeAssetPath);
        return (await this.pathExists(assetPath)) ? 0 : 1;
      })
    );
    return checks.reduce<number>((sum, value) => sum + value, 0);
  }

  private findDuplicateRoutes(manifest: Manifest): string[] {
    const counts = new Map<string, number>();
    for (const page of manifest.pages) {
      counts.set(page.route, (counts.get(page.route) ?? 0) + 1);
    }

    return [...counts.entries()].filter(([, count]) => count > 1).map(([route]) => route);
  }

  private async loadSearchIndex(searchIndexPath: string): Promise<ContentSearchIndex | null> {
    try {
      const raw = await fs.readFile(searchIndexPath, 'utf8');
      return JSON.parse(raw) as ContentSearchIndex;
    } catch {
      return null;
    }
  }

  private collectMissingEnv(names: string[]): string[] {
    return names.filter((name) => !this.readEnv(name));
  }

  private readEnv(name: string): string {
    return (process.env[name] ?? '').replace(/^\uFEFF/, '').trim();
  }

  private resolveHtmlPath(route: string): string {
    const normalized = route.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!normalized) {
      return path.join(this.env.contentRoot(), 'index.html');
    }

    const segments = normalized.split('/');
    const file = segments.pop() ?? 'index';
    return path.join(this.env.contentRoot(), ...segments, `${file}.html`);
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveLogFilePath(): Promise<string> {
    const configuredPath = this.env.logFilePath();
    if (await this.pathExists(configuredPath)) {
      return configuredPath;
    }

    const fallbackCandidates = [path.resolve('./node.log')].filter(
      (candidate) => candidate !== configuredPath
    );
    for (const candidate of fallbackCandidates) {
      if (await this.pathExists(candidate)) {
        return candidate;
      }
    }

    return configuredPath;
  }

  private toMillis(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : 0;
  }

  private roundMb(value: number): number {
    return Number((value / 1024 / 1024).toFixed(2));
  }
}
