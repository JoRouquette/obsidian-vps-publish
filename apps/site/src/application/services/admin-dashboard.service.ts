import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ConfigFacade } from '../facades/config-facade';

interface AdminCredentials {
  user: string;
  mdp: string;
}

export interface AdminNotification {
  level: 'warn' | 'error';
  message: string;
  timestamp?: string;
  meta: Record<string, unknown>;
}

export interface AdminLogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp?: string;
  meta: Record<string, unknown>;
  raw: string;
}

export interface AdminPublicationHistoryEntry {
  sessionId: string;
  sessionStatus: 'pending' | 'active' | 'finished' | 'aborted';
  finalizationStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  notesPlanned: number;
  notesProcessed: number;
  assetsPlanned: number;
  assetsProcessed: number;
  contentRevision: string | null;
  error: string | null;
  promotionStats?: {
    notesPublished: number;
    notesDeduplicated: number;
    notesDeleted: number;
    assetsPublished: number;
    assetsDeduplicated: number;
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
    load?: {
      activeRequests: number;
      eventLoopLagMs: number;
      memoryUsageMB: number;
      rejections: Record<string, number>;
      isUnderPressure: boolean;
    };
    performance?: {
      requestCount: number;
      totalDurationMs: number;
      avgDurationMs: number;
      maxDurationMs: number;
      minDurationMs: number;
      bytesReceived: number;
      bytesSent: number;
      memoryUsageMB: number;
      eventLoopLagMs: number;
      slowRequestsCount: number;
    };
  };
  storage: {
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
  };
  history: {
    recentSessions: AdminPublicationHistoryEntry[];
    queue: {
      totalJobs: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      queueLength: number;
      activeJobs: number;
      maxConcurrentJobs: number;
    };
  };
  diagnostics: {
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
  };
  controls: {
    maintenance: {
      enabled: boolean;
      message: string | null;
      changedAt: string | null;
    };
    backpressure: {
      config: {
        maxActiveRequests: number;
        maxEventLoopLagMs: number;
        maxMemoryUsageMB: number;
      } | null;
      metrics: {
        activeRequests: number;
        eventLoopLagMs: number;
        memoryUsageMB: number;
        rejections: Record<string, number>;
        isUnderPressure: boolean;
      } | null;
    };
  };
  notifications: AdminNotification[];
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigFacade);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'vps-admin-credentials';

  readonly credentials = signal<AdminCredentials | null>(this.loadStoredCredentials());
  readonly snapshot = signal<AdminDashboardSnapshot | null>(null);
  readonly logs = signal<AdminLogEntry[]>([]);
  readonly loading = signal(false);
  readonly logsLoading = signal(false);
  readonly actionLoading = signal(false);
  readonly authError = signal<string | null>(null);
  readonly actionFeedback = signal<string | null>(null);
  readonly lastRefreshedAt = signal<string | null>(null);

  readonly adminEnabled = computed(() => this.config.cfg()?.adminDashboardEnabled ?? false);
  readonly notifications = computed(() => this.snapshot()?.notifications ?? []);
  readonly history = computed(() => this.snapshot()?.history.recentSessions ?? []);

  async login(user: string, mdp: string): Promise<boolean> {
    const nextCredentials = { user: user.trim(), mdp };
    this.credentials.set(nextCredentials);
    this.storeCredentials(nextCredentials);

    const ok = await this.refreshAll();
    if (!ok) {
      this.clearCredentials();
    }
    return ok;
  }

  logout(): void {
    this.clearCredentials();
    this.snapshot.set(null);
    this.logs.set([]);
    this.authError.set(null);
    this.actionFeedback.set(null);
  }

  async refreshAll(): Promise<boolean> {
    const credentials = this.credentials();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!credentials || !apiPath) {
      return false;
    }

    this.loading.set(true);
    this.authError.set(null);

    try {
      const [snapshot, logs] = await Promise.all([
        firstValueFrom(
          this.http.get<AdminDashboardSnapshot>(`${apiPath}/summary`, {
            headers: this.buildHeaders(credentials),
          })
        ),
        firstValueFrom(
          this.http.get<{ lines: AdminLogEntry[] }>(`${apiPath}/logs?limit=200`, {
            headers: this.buildHeaders(credentials),
          })
        ),
      ]);

      this.snapshot.set(snapshot);
      this.logs.set(logs.lines);
      this.lastRefreshedAt.set(new Date().toISOString());
      return true;
    } catch (error) {
      this.handleAuthError(error);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async refreshLogs(): Promise<void> {
    const credentials = this.credentials();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!credentials || !apiPath) {
      return;
    }

    this.logsLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<{ lines: AdminLogEntry[] }>(`${apiPath}/logs?limit=200`, {
          headers: this.buildHeaders(credentials),
        })
      );
      this.logs.set(response.lines);
    } catch (error) {
      this.handleAuthError(error);
    } finally {
      this.logsLoading.set(false);
    }
  }

  async setMaintenance(enabled: boolean, message: string): Promise<void> {
    await this.runAction(async (apiPath, headers) => {
      await firstValueFrom(
        this.http.post(
          `${apiPath}/controls/maintenance`,
          { enabled, message: message.trim() || null },
          { headers }
        )
      );
      this.actionFeedback.set(enabled ? 'Mode maintenance activé.' : 'Mode maintenance désactivé.');
    });
  }

  async updateBackpressure(config: {
    maxActiveRequests: number;
    maxEventLoopLagMs: number;
    maxMemoryUsageMB: number;
  }): Promise<void> {
    await this.runAction(async (apiPath, headers) => {
      await firstValueFrom(this.http.post(`${apiPath}/controls/backpressure`, config, { headers }));
      this.actionFeedback.set('Seuils de backpressure mis à jour.');
    });
  }

  async rotateLogs(): Promise<void> {
    await this.runAction(async (apiPath, headers) => {
      const response = await firstValueFrom(
        this.http.post<{ rotated: boolean }>(`${apiPath}/logs/rotate`, {}, { headers })
      );
      this.actionFeedback.set(
        response.rotated
          ? 'Rotation des logs effectuée.'
          : 'Aucune rotation nécessaire pour le moment.'
      );
    });
  }

  private async runAction(
    action: (apiPath: string, headers: HttpHeaders) => Promise<void>
  ): Promise<void> {
    const credentials = this.credentials();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!credentials || !apiPath) {
      return;
    }

    this.actionLoading.set(true);
    this.actionFeedback.set(null);

    try {
      await action(apiPath, this.buildHeaders(credentials));
      await this.refreshAll();
    } catch (error) {
      this.handleAuthError(error);
    } finally {
      this.actionLoading.set(false);
    }
  }

  private buildHeaders(credentials: AdminCredentials): HttpHeaders {
    return new HttpHeaders({
      'x-admin-user': credentials.user,
      'x-admin-mdp': credentials.mdp,
    });
  }

  private handleAuthError(error: unknown): void {
    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      this.snapshot.set(null);
      this.logs.set([]);
      this.authError.set('Identifiants admin invalides.');
      return;
    }

    if (
      error instanceof HttpErrorResponse &&
      error.error?.error === 'invalid_backpressure_payload'
    ) {
      this.actionFeedback.set('Valeurs de backpressure invalides.');
      return;
    }

    if (
      error instanceof HttpErrorResponse &&
      error.error?.error === 'invalid_maintenance_payload'
    ) {
      this.actionFeedback.set('Payload maintenance invalide.');
      return;
    }

    this.authError.set("Impossible de charger le dashboard d'administration.");
  }

  private clearCredentials(): void {
    this.credentials.set(null);
    if (this.isBrowser) {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private storeCredentials(credentials: AdminCredentials): void {
    if (this.isBrowser) {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(credentials));
    }
  }

  private loadStoredCredentials(): AdminCredentials | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<AdminCredentials>;
      if (typeof parsed.user === 'string' && typeof parsed.mdp === 'string') {
        return { user: parsed.user, mdp: parsed.mdp };
      }
      return null;
    } catch {
      return null;
    }
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
