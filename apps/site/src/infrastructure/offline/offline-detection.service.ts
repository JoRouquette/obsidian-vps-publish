import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, fromEvent, merge, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map, startWith, takeUntil } from 'rxjs/operators';

/**
 * Browser-only service that detects online/offline status.
 *
 * Features:
 * - Reactive online$ observable
 * - Handles browser online/offline events
 * - SSR-safe (always returns online on server)
 *
 * @example
 * ```typescript
 * // In component
 * isOnline$ = inject(OfflineDetectionService).online$;
 * ```
 */
@Injectable({ providedIn: 'root' })
export class OfflineDetectionService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();

  private readonly onlineSubject = new BehaviorSubject<boolean>(true);

  /**
   * Observable that emits current online status.
   * Emits true when online, false when offline.
   */
  readonly online$: Observable<boolean>;

  /**
   * Observable that emits true when offline.
   */
  readonly offline$: Observable<boolean>;

  /**
   * Synchronous access to current online status.
   */
  get isOnline(): boolean {
    return this.onlineSubject.value;
  }

  /**
   * Synchronous access to current offline status.
   */
  get isOffline(): boolean {
    return !this.onlineSubject.value;
  }

  constructor() {
    if (!this.isBrowser) {
      // SSR: always online
      this.online$ = this.onlineSubject.asObservable();
      this.offline$ = this.online$.pipe(map((online) => !online));
      return;
    }

    // Initialize with current status
    this.onlineSubject.next(navigator.onLine);

    // Set up event listeners
    this.ngZone.runOutsideAngular(() => {
      const online$ = fromEvent(window, 'online').pipe(map(() => true));
      const offline$ = fromEvent(window, 'offline').pipe(map(() => false));

      merge(online$, offline$)
        .pipe(startWith(navigator.onLine), takeUntil(this.destroy$))
        .subscribe((isOnline) => {
          this.ngZone.run(() => {
            this.onlineSubject.next(isOnline);
          });
        });
    });

    this.online$ = this.onlineSubject.pipe(distinctUntilChanged());
    this.offline$ = this.online$.pipe(map((online) => !online));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
