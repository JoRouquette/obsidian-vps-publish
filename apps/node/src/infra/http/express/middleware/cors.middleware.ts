import { type LoggerPort } from '@core-domain';
import { type NextFunction, type Request, type Response } from 'express';

/**
 * Origin of Obsidian's desktop renderer.
 *
 * Exported for {@link allowObsidianDesktopOrigin} and its tests. It is
 * deliberately **not** added to the global allowance: see that function.
 */
export const OBSIDIAN_DESKTOP_ORIGIN = 'app://obsidian.md';

/**
 * Lets Obsidian's desktop renderer read this response, whatever `ALLOWED_ORIGINS`
 * contains. Mount it on the routes that need it, never globally.
 *
 * Every call the publishing plugin makes goes through Obsidian's `requestUrl`,
 * which bypasses CORS entirely. The finalization stream is the one exception:
 * `EventSource` goes through the browser's network stack, which enforces CORS.
 * Leaving that to `ALLOWED_ORIGINS` meant the stream was broken by default on
 * every self-hosted deployment, falling back to status polling without a word.
 *
 * Why this is safe: allowing an origin only permits the response to be read, it
 * authenticates nothing, and this middleware never emits
 * `Access-Control-Allow-Credentials` — so no cookie or ambient credential travels
 * or becomes readable cross-origin. That absence is the invariant the whole
 * argument rests on, and a test pins it down. The stream itself still requires
 * its signed token. The plugin is desktop-only (`isDesktopOnly` in its manifest),
 * so this single origin covers every supported client.
 *
 * Why it is scoped rather than global: the operator stays free to refuse every
 * cross-origin read elsewhere — on the admin router, on `/health`, on the
 * published content — by leaving `ALLOWED_ORIGINS` empty. A global allowance
 * would take that choice away with no way to opt out.
 *
 * Limit worth knowing: this covers **simple requests only**. The global middleware
 * answers every `OPTIONS` before the router is reached, so a preflight is still
 * governed by `ALLOWED_ORIGINS` alone. `EventSource` sends no custom header and so
 * never triggers one — but a route that later accepts one would need more than
 * this.
 */
export function allowObsidianDesktopOrigin(req: Request, res: Response, next: NextFunction) {
  res.vary('Origin');

  if (req.header('origin') === OBSIDIAN_DESKTOP_ORIGIN) {
    res.header('Access-Control-Allow-Origin', OBSIDIAN_DESKTOP_ORIGIN);
  }

  next();
}

export function createCorsMiddleware(allowedOrigins: string[], logger?: LoggerPort) {
  const allowAll = allowedOrigins.includes('*');

  return function corsMiddleware(req: Request, res: Response, next: NextFunction) {
    const origin = req.header('origin');

    // Unconditional: the body of a cacheable response varies with the origin even
    // when this request carries none, so a copy stored without `Vary` would later
    // be served to Obsidian stripped of its allow-origin header — reproducing the
    // very failure this file exists to prevent. `res.vary` appends where
    // `res.header('Vary', …)` would overwrite.
    res.vary('Origin');

    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.header('Access-Control-Allow-Origin', origin);
      logger?.debug('CORS allowed for origin', { origin });
    } else if (origin) {
      logger?.warn('CORS denied for origin', { origin });
    }

    res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      logger?.debug('CORS preflight request handled', { origin, method: req.method });
      return res.sendStatus(200);
    }

    return next();
  };
}
