import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import type { ManifestPage } from '@core-domain';

import { ConfigFacade } from '../facades/config-facade';

export interface SeoMetadata {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  siteName?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
  route: string;
  isLast: boolean;
}

/**
 * Service pour gérer les meta tags SEO dynamiques.
 * Utilisé par SeoResolver pour injecter les métadonnées sur chaque route.
 *
 * @example
 * ```typescript
 * // Dans un resolver ou component
 * const page: ManifestPage = ...;
 * this.seoService.updateFromPage(page);
 * ```
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly baseUrl: string;
  private readonly siteName: string;

  constructor(
    private readonly titleService: Title,
    private readonly metaService: Meta,
    private readonly configFacade: ConfigFacade,
    @Inject(PLATFORM_ID) private readonly platformId: object,
    @Inject(DOCUMENT) private readonly document: Document
  ) {
    const config = this.configFacade.config();
    this.baseUrl = config?.baseUrl || 'http://localhost:4200';
    this.siteName = config?.siteName || "Scribe d'Ektaron";
  }

  /**
   * Get breadcrumbs for visual display in components.
   * Useful for rendering HTML breadcrumbs in the UI.
   */
  getBreadcrumbs(route: string): BreadcrumbItem[] {
    const items = this.buildBreadcrumbs(route);
    return items.map((item, index) => ({
      ...item,
      route: item.url.replace(this.baseUrl, '') || '/',
      isLast: index === items.length - 1,
    }));
  }

  /**
   * Met à jour les meta tags depuis un ManifestPage.
   * Génère automatiquement les tags Open Graph et Twitter Card.
   */
  updateFromPage(page: ManifestPage | null): void {
    if (!page) {
      this.setDefaultMetadata();
      return;
    }

    const metadata: SeoMetadata = {
      title: page.title,
      description: page.description || this.generateDescription(page),
      url: this.buildCanonicalUrl(page),
      image: page.coverImage ? this.buildImageUrl(page.coverImage) : undefined,
      type: 'article',
      publishedTime: page.publishedAt ? new Date(page.publishedAt).toISOString() : undefined,
      modifiedTime: page.lastModifiedAt ? new Date(page.lastModifiedAt).toISOString() : undefined,
      tags: page.tags,
      siteName: this.siteName,
    };

    this.updateMetadata(metadata);
    this.updateCanonicalLink(metadata.url);

    // Si noIndex est activé, ajouter meta robots
    if (page.noIndex) {
      this.metaService.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    } else {
      this.metaService.removeTag('name="robots"');
    }

    // Ajouter les tags JSON-LD pour le rich snippet
    this.updateJsonLd(page, metadata);
  }

  /**
   * Met à jour tous les meta tags (OpenGraph, Twitter, etc.)
   */
  private updateMetadata(meta: SeoMetadata): void {
    // Title
    this.titleService.setTitle(`${meta.title} | ${meta.siteName}`);

    // Description
    this.metaService.updateTag({ name: 'description', content: meta.description });

    // Open Graph
    this.metaService.updateTag({ property: 'og:title', content: meta.title });
    this.metaService.updateTag({ property: 'og:description', content: meta.description });
    this.metaService.updateTag({ property: 'og:url', content: meta.url });
    this.metaService.updateTag({ property: 'og:type', content: meta.type || 'website' });
    this.metaService.updateTag({ property: 'og:site_name', content: meta.siteName || '' });

    if (meta.image) {
      this.metaService.updateTag({ property: 'og:image', content: meta.image });
      this.metaService.updateTag({ property: 'og:image:alt', content: meta.title });
    }

    if (meta.publishedTime) {
      this.metaService.updateTag({
        property: 'article:published_time',
        content: meta.publishedTime,
      });
    }

    if (meta.modifiedTime) {
      this.metaService.updateTag({
        property: 'article:modified_time',
        content: meta.modifiedTime,
      });
    }

    if (meta.tags && meta.tags.length > 0) {
      // Open Graph supporte plusieurs tags
      meta.tags.forEach((tag) => {
        this.metaService.updateTag({ property: 'article:tag', content: tag });
      });
    }

    // Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: meta.title });
    this.metaService.updateTag({ name: 'twitter:description', content: meta.description });

    if (meta.image) {
      this.metaService.updateTag({ name: 'twitter:image', content: meta.image });
    }
  }

  /**
   * Met à jour le lien canonical dans le <head>.
   */
  private updateCanonicalLink(url: string): void {
    if (isPlatformBrowser(this.platformId)) {
      // Browser: manipulation DOM classique
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }

      link.setAttribute('href', url);
    } else {
      // SSR: manipulation DOM via DOCUMENT injection
      let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

      if (!link) {
        link = this.document.createElement('link');
        link.setAttribute('rel', 'canonical');
        this.document.head.appendChild(link);
      }

      link.setAttribute('href', url);
    }
  }

  /**
   * Génère et injecte le JSON-LD pour les rich snippets Google.
   * Format: Article schema avec auteur, dates, tags.
   * Works in both SSR and browser modes.
   */
  private updateJsonLd(page: ManifestPage, meta: SeoMetadata): void {
    const doc = isPlatformBrowser(this.platformId) ? document : this.document;

    // Build Article JSON-LD
    const articleJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: page.title,
      description: meta.description,
      url: meta.url,
      datePublished: meta.publishedTime,
      dateModified: meta.modifiedTime || meta.publishedTime,
      publisher: {
        '@type': 'Organization',
        name: meta.siteName,
      },
      image: meta.image,
      keywords: meta.tags?.join(', '),
    };

    // Build BreadcrumbList JSON-LD
    const breadcrumbs = this.buildBreadcrumbs(page.route);
    const breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    };

    // Clean undefined values
    this.cleanUndefinedValues(articleJsonLd);

    // Remove existing JSON-LD scripts
    const existingScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach((script) => script.remove());

    // Inject Article JSON-LD
    const articleScript = doc.createElement('script');
    articleScript.type = 'application/ld+json';
    articleScript.textContent = JSON.stringify(articleJsonLd);
    doc.head.appendChild(articleScript);

    // Inject Breadcrumb JSON-LD (only if more than 1 breadcrumb)
    if (breadcrumbs.length > 1) {
      const breadcrumbScript = doc.createElement('script');
      breadcrumbScript.type = 'application/ld+json';
      breadcrumbScript.textContent = JSON.stringify(breadcrumbJsonLd);
      doc.head.appendChild(breadcrumbScript);
    }
  }

  /**
   * Build breadcrumbs from route path.
   * Ex: /ektaron/divinites/tenebra → [Home, Ektaron, Divinités, Tenebra]
   */
  private buildBreadcrumbs(route: string): Array<{ name: string; url: string }> {
    const breadcrumbs: Array<{ name: string; url: string }> = [
      { name: 'Accueil', url: this.baseUrl },
    ];

    if (!route || route === '/') {
      return breadcrumbs;
    }

    const segments = route
      .replace(/^\/+|\/+$/g, '')
      .split('/')
      .filter(Boolean);
    let currentPath = '';

    for (const segment of segments) {
      currentPath += '/' + segment;
      // Capitalize and humanize segment name
      const name = this.humanizeSegment(segment);
      breadcrumbs.push({
        name,
        url: `${this.baseUrl}${currentPath}`,
      });
    }

    return breadcrumbs;
  }

  /**
   * Humanize a URL segment into a readable name.
   * Ex: "ma-page-cool" → "Ma page cool"
   */
  private humanizeSegment(segment: string): string {
    return segment
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Recursively clean undefined values from an object.
   */
  private cleanUndefinedValues(obj: Record<string, unknown>): void {
    Object.keys(obj).forEach((key) => {
      if (obj[key] === undefined) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.cleanUndefinedValues(obj[key] as Record<string, unknown>);
      }
    });
  }

  /**
   * Définit les métadonnées par défaut (page d'accueil).
   */
  private setDefaultMetadata(): void {
    const meta: SeoMetadata = {
      title: 'Accueil',
      description: `Bienvenue sur ${this.siteName}`,
      url: this.baseUrl,
      siteName: this.siteName,
    };

    this.updateMetadata(meta);
    this.updateCanonicalLink(meta.url);
  }

  /**
   * Génère une description à partir du titre et des tags si pas fournie.
   */
  private generateDescription(page: ManifestPage): string {
    const parts = [page.title];

    if (page.tags && page.tags.length > 0) {
      parts.push(`Tags: ${page.tags.join(', ')}`);
    }

    return parts.join(' - ');
  }

  /**
   * Construit l'URL canonique complète (BASE_URL + route).
   * Gère le cas des canonicalSlug (redirections).
   */
  private buildCanonicalUrl(page: ManifestPage): string {
    const slug = page.canonicalSlug || page.route;
    return `${this.baseUrl}${slug.startsWith('/') ? slug : '/' + slug}`;
  }

  /**
   * Construit l'URL complète d'une image (relative → absolue).
   */
  private buildImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath; // Déjà absolue
    }

    // Relative: ajouter BASE_URL
    const path = imagePath.startsWith('/') ? imagePath : '/' + imagePath;
    return `${this.baseUrl}${path}`;
  }
}
