import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ConfigFacade } from '../facades/config-facade';

interface AdminLoginResponse {
  token: string;
  expiresAt: string;
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
  private readonly STORAGE_KEY = 'vps-admin-session';
  private readonly LEGACY_CREDENTIALS_KEY = 'vps-admin-credentials';

  readonly sessionToken = signal<string | null>(this.loadStoredToken());
  readonly isAuthenticated = computed(() => this.sessionToken() !== null);
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
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!apiPath) {
      return false;
    }

    this.loading.set(true);
    this.authError.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<AdminLoginResponse>(`${apiPath}/login`, { user: user.trim(), mdp })
      );
      this.sessionToken.set(response.token);
      this.storeToken(response.token);
    } catch (error) {
      this.handleAuthError(error);
      return false;
    } finally {
      this.loading.set(false);
    }

    return this.refreshAll();
  }

  logout(): void {
    const token = this.sessionToken();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (token && apiPath) {
      // Fire and forget: the local session ends whether or not the server revocation succeeds.
      this.http
        .post(`${apiPath}/logout`, null, { headers: this.buildHeaders(token) })
        .subscribe({ error: () => undefined });
    }

    this.clearToken();
    this.snapshot.set(null);
    this.logs.set([]);
    this.authError.set(null);
    this.actionFeedback.set(null);
  }

  async refreshAll(): Promise<boolean> {
    const token = this.sessionToken();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!token || !apiPath) {
      return false;
    }

    this.loading.set(true);
    this.authError.set(null);

    try {
      const [snapshot, logs] = await Promise.all([
        firstValueFrom(
          this.http.get<AdminDashboardSnapshot>(`${apiPath}/summary`, {
            headers: this.buildHeaders(token),
          })
        ),
        firstValueFrom(
          this.http.get<{ lines: AdminLogEntry[] }>(`${apiPath}/logs?limit=200`, {
            headers: this.buildHeaders(token),
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
    const token = this.sessionToken();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!token || !apiPath) {
      return;
    }

    this.logsLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<{ lines: AdminLogEntry[] }>(`${apiPath}/logs?limit=200`, {
          headers: this.buildHeaders(token),
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
    const token = this.sessionToken();
    const apiPath = this.config.cfg()?.adminApiPath;
    if (!token || !apiPath) {
      return;
    }

    this.actionLoading.set(true);
    this.actionFeedback.set(null);

    try {
      await action(apiPath, this.buildHeaders(token));
      await this.refreshAll();
    } catch (error) {
      this.handleAuthError(error);
    } finally {
      this.actionLoading.set(false);
    }
  }

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private handleAuthError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 429) {
      this.authError.set(buildTooManyAttemptsMessage(error.headers.get('Retry-After')));
      return;
    }

    if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
      // Read before clearToken(): login() only stores a token once it succeeds, so a token
      // present here means an open session was refused, not a wrong password.
      const hadSession = this.sessionToken() !== null;
      this.clearToken();
      this.snapshot.set(null);
      this.logs.set([]);
      this.authError.set(
        hadSession ? 'Session expirée, reconnecte-toi.' : 'Identifiants admin invalides.'
      );
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

  // sessionStorage can throw (blocked storage, quota, private mode): the session then simply
  // lives in memory for the current page.
  private clearToken(): void {
    this.sessionToken.set(null);
    if (!this.isBrowser) {
      return;
    }

    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch {
      // Nothing persisted, nothing to clear.
    }
  }

  private storeToken(token: string): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      sessionStorage.setItem(this.STORAGE_KEY, token);
    } catch {
      // The token stays in memory: a failed persistence must not fail the login.
    }
  }

  private loadStoredToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }

    this.removeLegacyCredentials();

    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      return stored && stored.length > 0 ? stored : null;
    } catch {
      return null;
    }
  }

  /** Earlier versions kept the admin credentials in clear text under this key. */
  private removeLegacyCredentials(): void {
    try {
      sessionStorage.removeItem(this.LEGACY_CREDENTIALS_KEY);
    } catch {
      // Storage unavailable: nothing to purge.
    }
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}

function buildTooManyAttemptsMessage(retryAfterHeader: string | null): string {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (retryAfterHeader !== null && Number.isInteger(retryAfterSeconds) && retryAfterSeconds > 0) {
    return `Trop de tentatives, réessaie dans ${retryAfterSeconds} s.`;
  }
  return 'Trop de tentatives, réessaie dans un instant.';
}
