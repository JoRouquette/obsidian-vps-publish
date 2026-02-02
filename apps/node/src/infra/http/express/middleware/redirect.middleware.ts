import type { LoggerPort, Manifest } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware pour gérer les redirections 301 basées sur le canonicalMap du manifest.
 *
 * Ce middleware:
 * 1. Charge le manifest de manière asynchrone (lazy)
 * 2. Vérifie si l'URL courante correspond à une ancienne route
 * 3. Émet une redirection 301 vers la route canonique si trouvée
 * 4. Laisse passer la requête si pas de mapping trouvé
 *
 * @example
 * ```typescript
 * // Dans app.ts
 * const manifestLoader = async () => { ... };
 * app.use(createRedirectMiddleware(manifestLoader, logger));
 * ```
 */
export function createRedirectMiddleware(
  manifestLoader: () => Promise<Manifest>,
  logger?: LoggerPort
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        // Ignorer les requêtes statiques (assets, API, etc.)
        if (shouldSkipRedirect(req.path)) {
          next();
          return;
        }

        // Charger le manifest (lazy loading)
        const manifest = await manifestLoader();

        // Vérifier si canonicalMap existe et n'est pas vide
        if (!manifest.canonicalMap || Object.keys(manifest.canonicalMap).length === 0) {
          next();
          return;
        }

        // Normaliser le path (supprimer trailing slash sauf pour /)
        const normalizedPath = normalizePath(req.path);

        // Chercher le mapping dans canonicalMap
        const canonicalRoute = manifest.canonicalMap[normalizedPath];

        if (canonicalRoute && canonicalRoute !== normalizedPath) {
          // Émettre redirection 301 permanente
          logger?.info('301 redirect', {
            from: normalizedPath,
            to: canonicalRoute,
            userAgent: req.headers['user-agent'],
          });

          res.redirect(301, canonicalRoute);
          return;
        }

        // Pas de mapping trouvé, continuer
        next();
      } catch (error) {
        // En cas d'erreur, ne pas bloquer la requête
        logger?.warn('Redirect middleware error', {
          path: req.path,
          error: error instanceof Error ? error.message : String(error),
        });
        next();
      }
    })();
  };
}

/**
 * Détermine si une requête doit être ignorée par le middleware de redirection.
 * Exclut: API, assets, SEO, health check, public-config, fichiers statiques.
 */
function shouldSkipRedirect(path: string): boolean {
  return (
    path.startsWith('/api/') ||
    path.startsWith('/assets/') ||
    path.startsWith('/content/') ||
    path.startsWith('/seo/') ||
    path === '/health' ||
    path === '/public-config' ||
    path.includes('.') // Fichiers statiques (*.js, *.css, *.png, etc.)
  );
}

/**
 * Normalise un path en supprimant le trailing slash (sauf pour /).
 * Garantit la cohérence entre routes avec/sans trailing slash.
 *
 * @example
 * normalizePath('/about/') => '/about'
 * normalizePath('/') => '/'
 * normalizePath('/blog') => '/blog'
 */
function normalizePath(path: string): string {
  if (path === '/' || !path.endsWith('/')) {
    return path;
  }
  return path.slice(0, -1);
}
