import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { Manifest, ManifestRepository } from '@core-domain';
import { defaultManifest } from '@core-domain';
import { firstValueFrom } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';

@Injectable({ providedIn: 'root' })
export class HttpManifestRepository implements ManifestRepository {
  private readonly url: string;
  private readonly storageKey = 'vps-manifest-cache';
  private inFlight: Promise<Manifest> | null = null;
  private inMemory: Manifest | null = null;

  constructor(private http: HttpClient) {
    this.url = StringUtils.buildRoute(CONTENT_ROOT, '_manifest.json');
  }

  async load(): Promise<Manifest> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.fetchRemote().finally(() => {
      this.inFlight = null;
    });

    this.inMemory = await this.inFlight;
    return this.inMemory;
  }

  private async fetchRemote(): Promise<Manifest> {
    try {
      const raw = await firstValueFrom(
        this.http.get<Manifest>(this.url, {
          headers: { 'Cache-Control': 'no-cache' },
        })
      );
      const normalized = this.normalize(raw);
      this.persist(normalized);
      return normalized;
    } catch (error: unknown) {
      const status = (error as { status?: number } | undefined)?.status;

      // Si le manifest a disparu (cleanup), on invalide le cache et on retourne un manifest vide.
      if (status === 404 || status === 410) {
        this.clearCache();
        return this.makeEmpty();
      }

      const cached = this.readCache();
      if (cached) {
        return cached;
      }

      return this.makeEmpty();
    }
  }

  private normalize(input: Manifest): Manifest {
    const coerceDate = (d: string | number | Date | undefined | null) =>
      d instanceof Date ? d : new Date(d ?? 0);
    return {
      ...input,
      createdAt: coerceDate((input as { createdAt?: string | number | Date | null }).createdAt),
      lastUpdatedAt: coerceDate(
        (input as { lastUpdatedAt?: string | number | Date | null }).lastUpdatedAt
      ),
      pages: Array.isArray((input as { pages?: Manifest['pages'] }).pages)
        ? (input as { pages: Manifest['pages'] }).pages.slice()
        : [],
    };
  }

  private makeEmpty(): Manifest {
    return {
      ...defaultManifest,
      createdAt: new Date(0),
      lastUpdatedAt: new Date(0),
      pages: [],
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

  private clearCache(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(this.storageKey);
    } catch {
      // Ignore
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
