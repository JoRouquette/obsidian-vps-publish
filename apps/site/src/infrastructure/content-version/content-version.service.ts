import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Content version information from backend.
 */
export interface ContentVersionInfo {
  version: string;
  /** Publication revision from manifest (matches manifest.contentRevision). */
  contentRevision?: string;
  generatedAt: string;
}

/**
 * Browser-only service that manages content versioning for cache invalidation.
 *
 * Features:
 * - Maintains current contentVersion as BehaviorSubject
 * - Persists version in localStorage
 * - Connects to SSE /events/content for live updates
 * - Falls back to polling /_content-version.json if SSE fails
 * - Emits version changes for downstream consumers
 *
 * @example
 * ```typescript
 * // In a component
 * contentVersion$ = inject(ContentVersionService).contentVersion$;
 *
 * // Get current version for URL parameter
 * const cv = inject(ContentVersionService).currentVersion;
 * const url = `/content/_manifest.json?cv=${cv}`;
 * ```
 */
@Injectable({ providedIn: 'root' })
export class ContentVersionService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);

  private readonly STORAGE_KEY = 'vps-content-version';
  private readonly SSE_URL = '/events/content';
  private readonly POLLING_URL = '/_content-version.json';
  private readonly POLLING_INTERVAL_MS = 60_000; // 60 seconds

  private readonly destroy$ = new Subject<void>();
  private readonly versionSubject = new BehaviorSubject<string>('');
  private readonly versionChangedSubject = new Subject<ContentVersionInfo>();

  private eventSource: EventSource | null = null;
  private isPolling = false;
  private sseConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY_MS = 5000;

  /**
   * Observable of current content version.
   * Emits immediately with cached version, then updates on changes.
   */
  readonly contentVersion$: Observable<string> = this.versionSubject.asObservable();

  /**
   * Observable that emits when content version changes (new version different from current).
   * Use this to trigger data refresh.
   */
  readonly versionChanged$: Observable<ContentVersionInfo> =
    this.versionChangedSubject.asObservable();

  /**
   * Current content version (synchronous access).
   */
  get currentVersion(): string {
    return this.versionSubject.value;
  }

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    // Load persisted version
    this.loadPersistedVersion();

    // Initialize live connection (SSE with polling fallback)
    this.initializeLiveConnection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectSSE();
  }

  /**
   * Manually trigger a version check (useful after navigation).
   */
  async checkVersion(): Promise<ContentVersionInfo | null> {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const response = await fetch(this.POLLING_URL, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return null;
      }

      const info = (await response.json()) as ContentVersionInfo;
      this.handleVersionUpdate(info);
      return info;
    } catch {
      return null;
    }
  }

  /**
   * Force set a new version (useful for testing or manual override).
   */
  setVersion(version: string): void {
    if (!this.isBrowser) {
      return;
    }

    const oldVersion = this.versionSubject.value;
    this.versionSubject.next(version);
    this.persistVersion(version);

    if (oldVersion && oldVersion !== version) {
      this.versionChangedSubject.next({
        version,
        generatedAt: new Date().toISOString(),
      });
    }
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private loadPersistedVersion(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.versionSubject.next(stored);
      }
    } catch {
      // localStorage may be unavailable (private mode, etc.)
    }
  }

  private persistVersion(version: string): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, version);
    } catch {
      // Ignore storage errors
    }
  }

  private initializeLiveConnection(): void {
    // Run outside Angular zone to avoid unnecessary change detection
    this.ngZone.runOutsideAngular(() => {
      this.connectSSE();
    });
  }

  private connectSSE(): void {
    if (!this.isBrowser || typeof EventSource === 'undefined') {
      this.startPolling();
      return;
    }

    try {
      this.eventSource = new EventSource(this.SSE_URL);

      this.eventSource.onopen = () => {
        this.ngZone.run(() => {
          this.sseConnected = true;
          this.reconnectAttempts = 0;
          this.stopPolling();
        });
      };

      this.eventSource.onmessage = (event: MessageEvent<string>) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(event.data) as {
              type: string;
              version?: string;
              contentRevision?: string;
              generatedAt?: string;
            };
            if (data.type === 'contentVersion' && data.version) {
              this.handleVersionUpdate({
                version: data.version,
                contentRevision: data.contentRevision,
                generatedAt: data.generatedAt ?? new Date().toISOString(),
              });
            }
          } catch {
            // Ignore malformed messages
          }
        });
      };

      this.eventSource.onerror = () => {
        this.ngZone.run(() => {
          this.handleSSEError();
        });
      };
    } catch {
      this.startPolling();
    }
  }

  private handleSSEError(): void {
    this.disconnectSSE();
    this.sseConnected = false;
    this.reconnectAttempts++;

    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      // Try to reconnect after delay
      timer(this.RECONNECT_DELAY_MS)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.connectSSE();
        });
    } else {
      // Fall back to polling
      this.startPolling();
    }
  }

  private disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private startPolling(): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    // Initial check
    void this.checkVersion();

    // Periodic polling
    timer(this.POLLING_INTERVAL_MS, this.POLLING_INTERVAL_MS)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isPolling && !this.sseConnected) {
          void this.checkVersion();
        }
      });
  }

  private stopPolling(): void {
    this.isPolling = false;
  }

  private handleVersionUpdate(info: ContentVersionInfo): void {
    const currentVersion = this.versionSubject.value;

    if (info.version !== currentVersion) {
      this.versionSubject.next(info.version);
      this.persistVersion(info.version);

      // Only emit change event if we had a previous version
      if (currentVersion) {
        this.versionChangedSubject.next(info);
      }
    }
  }
}
