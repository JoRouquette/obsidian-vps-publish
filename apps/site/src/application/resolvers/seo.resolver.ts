import { inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { FindPageHandler } from '@core-application';
import type { ManifestPage } from '@core-domain';

import { CatalogFacade } from '../facades/catalog-facade';
import { SeoService } from '../services/seo.service';

/**
 * Resolver SEO qui injecte les meta tags dynamiques sur chaque route.
 *
 * Ce resolver:
 * 1. Récupère la page courante depuis le manifest (via route ou slug)
 * 2. Met à jour les meta tags (title, description, OG, Twitter, canonical)
 * 3. Ne bloque pas le chargement de la page (retourne toujours void)
 *
 * @example
 * ```typescript
 * // Dans app.routes.ts
 * {
 *   path: '**',
 *   component: ViewerComponent,
 *   resolve: { seo: seoResolver }
 * }
 * ```
 */
export const seoResolver: ResolveFn<void> = async (route) => {
  const catalogFacade = inject(CatalogFacade);
  const seoService = inject(SeoService);

  // Extraire le path complet de la route
  const path = route.url.map((segment) => segment.path).join('/') || '/';

  try {
    // Charger le manifest si nécessaire
    await catalogFacade.ensureManifest();

    const manifest = catalogFacade.manifest();
    if (!manifest) {
      // Manifest non disponible: meta tags par défaut
      seoService.updateFromPage(null);
      return;
    }

    // Chercher la page correspondant à cette route
    const findQuery = new FindPageHandler();
    const page = await findQuery.handle({ manifest, slugOrRoute: path });

    // Mettre à jour les meta tags (forcer null si page non trouvée)
    seoService.updateFromPage((page as ManifestPage) ?? null);
  } catch (error) {
    // En cas d'erreur, utiliser les meta tags par défaut
    // eslint-disable-next-line no-console
    console.warn('[seoResolver] Failed to load page metadata:', error);
    seoService.updateFromPage(null);
  }

  // Ne pas bloquer le chargement de la page
  return;
};
