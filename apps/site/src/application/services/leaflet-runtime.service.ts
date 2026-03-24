import { inject, Injectable } from '@angular/core';
import { resolveCanonicalInternalLink, UNAVAILABLE_INTERNAL_PAGE_MESSAGE } from '@core-domain';

import { CatalogFacade } from '../facades/catalog-facade';
import { ContentVersionService } from '../../infrastructure/content-version/content-version.service';

export interface LeafletResolvedLink {
  href: string;
  external: boolean;
  text: string;
  unresolved?: boolean;
  unresolvedReason?: string | null;
}

export interface LeafletPersistedViewState {
  center: [number, number];
  zoom: number;
  simpleCrs: boolean;
}

@Injectable({ providedIn: 'root' })
export class LeafletRuntimeService {
  private readonly catalog = inject(CatalogFacade);
  private readonly contentVersionService = inject(ContentVersionService);
  private readonly viewStateByMapId = new Map<string, LeafletPersistedViewState>();

  getMarkerIconUrls(): { iconRetinaUrl: string; iconUrl: string; shadowUrl: string } {
    return {
      iconRetinaUrl: '/assets/leaflet/marker-icon-2x.png',
      iconUrl: '/assets/leaflet/marker-icon.png',
      shadowUrl: '/assets/leaflet/marker-shadow.png',
    };
  }

  buildOverlayAssetUrl(assetPath: string): string {
    const cv = this.contentVersionService.currentVersion;
    const basePath = `/assets/${encodeURI(assetPath)}`;
    return cv ? `${basePath}?cv=${encodeURIComponent(cv)}` : basePath;
  }

  resolveMarkerLink(rawLink: string): LeafletResolvedLink | null {
    const trimmed = rawLink.trim();
    if (!trimmed) {
      return null;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return {
        href: trimmed,
        external: true,
        text: trimmed,
      };
    }

    const clean = trimmed.replaceAll(/^\[\[|\]\]$/g, '').trim();
    if (!clean) {
      return null;
    }

    const resolved = resolveCanonicalInternalLink(clean, this.catalog.manifest().pages);
    if (!resolved.page || !resolved.resolvedHref) {
      return {
        href: '',
        external: false,
        text: clean,
        unresolved: true,
        unresolvedReason: resolved.unresolvedReason ?? UNAVAILABLE_INTERNAL_PAGE_MESSAGE,
      };
    }

    return {
      href: resolved.resolvedHref,
      external: false,
      text: resolved.page.title ?? clean,
    };
  }

  getPersistedViewState(
    mapId: string,
    opts?: { simpleCrs?: boolean }
  ): LeafletPersistedViewState | null {
    const state = this.viewStateByMapId.get(mapId);
    if (!state) {
      return null;
    }

    if (opts?.simpleCrs !== undefined && state.simpleCrs !== opts.simpleCrs) {
      return null;
    }

    return state;
  }

  persistViewState(mapId: string, state: LeafletPersistedViewState): void {
    this.viewStateByMapId.set(mapId, state);
  }
}
