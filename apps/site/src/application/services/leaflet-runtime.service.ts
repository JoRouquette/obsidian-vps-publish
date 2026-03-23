import { inject, Injectable } from '@angular/core';
import { Slug, type ManifestPage } from '@core-domain';

import { CatalogFacade } from '../facades/catalog-facade';
import { ContentVersionService } from '../../infrastructure/content-version/content-version.service';

export interface LeafletResolvedLink {
  href: string;
  external: boolean;
  text: string;
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

    const page = this.findPageForMarkerLink(clean);
    return {
      href: page?.route ?? this.buildFallbackInternalHref(clean),
      external: false,
      text: page?.title ?? clean,
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

  private findPageForMarkerLink(cleanLink: string): ManifestPage | undefined {
    const manifest = this.catalog.manifest();
    const lower = cleanLink.toLowerCase();
    const routeCandidate = this.normalizeRouteCandidate(cleanLink);
    const slugCandidate = Slug.fromRoute(cleanLink).value;

    return manifest.pages.find((page) => {
      const title = page.title?.toLowerCase?.() ?? '';
      return (
        page.route === cleanLink ||
        page.route === routeCandidate ||
        page.slug.value === cleanLink ||
        page.slug.value === slugCandidate ||
        title === lower
      );
    });
  }

  private buildFallbackInternalHref(cleanLink: string): string {
    if (cleanLink.includes('/')) {
      return this.normalizeRouteCandidate(cleanLink);
    }

    return `/${Slug.fromRoute(cleanLink).value}`;
  }

  private normalizeRouteCandidate(value: string): string {
    const stripped = value.replace(/^\/+|\/+$/g, '');
    if (!stripped) {
      return '/';
    }

    const encoded = stripped.split('/').map(encodeURIComponent).join('/');
    return `/${encoded}`;
  }
}
