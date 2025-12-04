import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';
import { SearchIndexRepository } from '../../domain/ports/search-index-repository.port';
import { ContentSearchIndex } from '@core-domain';

@Injectable({ providedIn: 'root' })
export class HttpSearchIndexRepository implements SearchIndexRepository {
  private readonly url = StringUtils.buildRoute(CONTENT_ROOT, '_search-index.json');
  private inFlight: Promise<ContentSearchIndex> | null = null;
  private cache: ContentSearchIndex | null = null;

  constructor(private readonly http: HttpClient) {}

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
        builtAt: (raw as any).builtAt ?? '',
        sessionId: (raw as any).sessionId,
      };
    } catch (error: any) {
      // Si l'index a été supprimé (cleanup), renvoyer un index vide pour que le UI reflète le reset.
      return {
        entries: [],
        builtAt: '',
        sessionId: '',
      };
    }
  }
}
