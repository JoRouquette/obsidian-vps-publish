import type { LoggerPort, Manifest } from '@core-domain';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware pour gerer les redirections 301 basees sur le canonicalMap du manifest.
 */
export function createRedirectMiddleware(
  manifestLoader: () => Promise<Manifest>,
  logger?: LoggerPort
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async (): Promise<void> => {
      try {
        if (shouldSkipRedirect(req.path)) {
          next();
          return;
        }

        const manifest = await manifestLoader();

        if (!manifest.canonicalMap || Object.keys(manifest.canonicalMap).length === 0) {
          next();
          return;
        }

        const normalizedPath = normalizePath(req.path);
        const canonicalRoute = manifest.canonicalMap[normalizedPath];

        if (canonicalRoute && canonicalRoute !== normalizedPath) {
          const suffix =
            typeof req.originalUrl === 'string' && req.originalUrl.startsWith(req.path)
              ? req.originalUrl.slice(req.path.length)
              : '';
          const redirectTarget = `${canonicalRoute}${suffix}`;

          logger?.info('301 redirect', {
            from: normalizedPath,
            to: redirectTarget,
            userAgent: req.headers['user-agent'],
          });

          res.redirect(301, redirectTarget);
          return;
        }

        next();
      } catch (error) {
        logger?.warn('Redirect middleware error', {
          path: req.path,
          error: error instanceof Error ? error.message : String(error),
        });
        next();
      }
    })();
  };
}

function shouldSkipRedirect(path: string): boolean {
  return (
    path.startsWith('/api/') ||
    path.startsWith('/assets/') ||
    path.startsWith('/content/') ||
    path.startsWith('/seo/') ||
    path === '/health' ||
    path === '/public-config' ||
    path.includes('.')
  );
}

function normalizePath(path: string): string {
  if (path === '/' || !path.endsWith('/')) {
    return path;
  }
  return path.slice(0, -1);
}
