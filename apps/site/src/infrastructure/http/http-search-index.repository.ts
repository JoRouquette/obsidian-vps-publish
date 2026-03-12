import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import type { ContentSearchIndex } from '@core-domain';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { ContentVersionService } from '../content-version/content-version.service';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';
import type { SearchIndexRepository } from '../../domain/ports/search-index-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpSearchIndexRepository implements SearchIndexRepository, OnDestroy {
  private readonly url = StringUtils.buildRoute(CONTENT_ROOT, '_search-index.json');
  private readonly destroy$ = new Subject<void>();
  private readonly contentVersionService = inject(ContentVersionService);
  private inFlight: Promise<ContentSearchIndex> | null = null;
  private cache: ContentSearchIndex | null = null;

  constructor(private readonly http: HttpClient) {
    // Invalidate cache when content version changes (new publication)
    this.contentVersionService.versionChanged$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.invalidate();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Invalidate the in-memory cache.
   * Called when content version changes (new publication detected).
   */
  invalidate(): void {
    this.cache = null;
    this.inFlight = null;
  }

  async load(): Promise<ContentSearchIndex> {
    if (this.cache) return this.cache;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchRemote().finally(() => {
      this.inFlight = null;
    });

    this.cache = await this.inFlight;
    return this.cache;
  }

  private async fetchRemote(): Promise<ContentSearchIndex> {
    try {
      const raw = await firstValueFrom(
        this.http.get<ContentSearchIndex>(this.url, {
          headers: { 'Cache-Control': 'no-cache' },
        })
      );
      return {
        ...raw,
        entries: Array.isArray(raw.entries) ? raw.entries : [],
        builtAt: raw.builtAt ?? '',
        sessionId: raw.sessionId,
      };
    } catch {
      // Si l'index a été supprimé (cleanup), renvoyer un index vide pour que le UI reflète le reset.
      return {
        entries: [],
        builtAt: '',
        sessionId: '',
      };
    }
  }
}
