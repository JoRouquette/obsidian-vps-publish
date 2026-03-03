import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Meta } from '@angular/platform-browser';

import { ConfigFacade } from '../../application/facades/config-facade';

/**
 * Service to update PWA meta tags dynamically based on site configuration.
 *
 * Updates:
 * - application-name (Android)
 * - apple-mobile-web-app-title (iOS)
 *
 * These meta tags are used when installing the app to the home screen.
 */
@Injectable({ providedIn: 'root' })
export class PwaMetaService {
  private readonly config = inject(ConfigFacade);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  private initialized = false;

  /**
   * Initialize PWA meta tags with the site name from configuration.
   * Should be called once the config is loaded.
   */
  init(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initialized = true;

    // Get config (already loaded by ConfigFacade.ensure())
    const cfg = this.config.cfg();
    if (cfg?.siteName) {
      this.updateMetaTags(cfg.siteName);
    }

    // Set HTML lang attribute from config locale
    if (cfg?.locale) {
      this.setHtmlLang(cfg.locale);
    }
  }

  /**
   * Set the HTML lang attribute to match the site locale.
   * This prevents browsers from offering to translate the page.
   */
  private setHtmlLang(locale: 'en' | 'fr'): void {
    const html = this.document.documentElement;
    if (html) {
      html.setAttribute('lang', locale);
    }
  }

  private updateMetaTags(siteName: string): void {
    // Short name for PWA (max ~12 characters for best display)
    const shortName = siteName.length > 12 ? siteName.slice(0, 12) : siteName;

    // Update Android PWA meta
    this.meta.updateTag({ name: 'application-name', content: shortName });

    // Update iOS PWA meta
    this.meta.updateTag({ name: 'apple-mobile-web-app-title', content: shortName });

    // Update manifest link to ensure it points to dynamic endpoint
    // (in case static manifest was cached)
    this.updateManifestLink();
  }

  /**
   * Ensure the manifest link points to the dynamic endpoint.
   * The backend serves /manifest.webmanifest with SITE_NAME from config.
   */
  private updateManifestLink(): void {
    const existingLink = this.document.querySelector('link[rel="manifest"]');
    if (existingLink) {
      // Add cache-busting parameter to force refresh if config changed
      const currentHref = existingLink.getAttribute('href') || '';
      if (!currentHref.includes('?')) {
        existingLink.setAttribute('href', `${currentHref}?v=${Date.now()}`);
      }
    }
  }
}
