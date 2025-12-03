import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';
import { Manifest, ManifestRepository } from '@core-domain';

@Injectable({ providedIn: 'root' })
export class HttpManifestRepository implements ManifestRepository {
  private readonly url: string;
  private readonly storageKey = 'vps-manifest-cache';
  private inMemory: Manifest | null = null;
  private inFlight: Promise<Manifest> | null = null;

  constructor(private http: HttpClient) {
    this.url = StringUtils.buildRoute(CONTENT_ROOT, '_manifest.json');
  }

  async load(): Promise<Manifest> {
    if (this.inFlight) {
      return this.inFlight;
    }

    if (this.inMemory) {
      // Serve from memory but trigger a refresh to detect new uploads
      this.inFlight = this.fetchRemote().finally(() => {
        this.inFlight = null;
      });
      return this.inMemory;
    }

    const cached = this.readCache();
    if (cached) {
      this.inMemory = cached;
      // stale-while-revalidate : retourne le cache et rafraîchit en arrière-plan
      this.inFlight = this.fetchRemote().finally(() => {
        this.inFlight = null;
      });
      return cached;
    }

    this.inFlight = this.fetchRemote().finally(() => {
      this.inFlight = null;
    });

    const fresh = await this.inFlight;
    this.inMemory = fresh;
    return fresh;
  }

  private async fetchRemote(): Promise<Manifest> {
    const raw = await firstValueFrom(this.http.get<Manifest>(this.url));
    const normalized = this.normalize(raw);
    const previous = this.inMemory;
    const changed =
      !previous ||
      normalized.lastUpdatedAt.getTime() !== previous.lastUpdatedAt.getTime() ||
      normalized.pages.length !== previous.pages.length;

    if (changed) {
      this.persist(normalized);
      this.inMemory = normalized;
    }

    return this.inMemory ?? normalized;
  }

  private normalize(input: Manifest): Manifest {
    const coerceDate = (d: any) => (d instanceof Date ? d : new Date(d ?? 0));
    return {
      ...input,
      createdAt: coerceDate((input as any).createdAt),
      lastUpdatedAt: coerceDate((input as any).lastUpdatedAt),
      pages: Array.isArray(input.pages) ? input.pages.slice() : [],
    };
  }

  private readCache(): Manifest | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return this.normalize(parsed);
    } catch {
      return null;
    }
  }

  private persist(manifest: Manifest): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const toStore = {
        ...manifest,
        createdAt: manifest.createdAt?.toISOString?.() ?? manifest.createdAt,
        lastUpdatedAt: manifest.lastUpdatedAt?.toISOString?.() ?? manifest.lastUpdatedAt,
      };
      localStorage.setItem(this.storageKey, JSON.stringify(toStore));
    } catch {
      // Ignore si storage indisponible (navigation privée, quota plein, etc.)
    }
  }
}
