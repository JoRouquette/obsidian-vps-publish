import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';

import { ContentVersionService } from './content-version.service';

/**
 * URL patterns that should have content version appended.
 * Only published content URLs need versioning (not Angular build assets).
 */
const VERSIONED_URL_PATTERNS = [
  /^\/content\//,
  /^\/_manifest\.json/,
  /^\/content\/_manifest\.json/,
];

/**
 * URL patterns that should NEVER have content version (already fingerprinted or static).
 */
const EXCLUDED_URL_PATTERNS = [
  /\.(js|css|woff2?|ttf|otf)(\?|$)/, // Build assets (already fingerprinted by Angular)
  /\/assets\/icons\//, // PWA icons
  /\/ngsw/, // Service worker files
  /\?cv=/, // Already has content version
];

/**
 * HTTP interceptor that appends content version parameter to published content URLs.
 *
 * This enables cache invalidation via URL versioning:
 * - When content version changes, URLs change, creating new cache entries
 * - Old cached content remains (offline fallback) but new requests get fresh content
 * - Does NOT affect Angular build assets (already fingerprinted)
 *
 * @example
 * ```
 * // Before: /content/_manifest.json
 * // After:  /content/_manifest.json?cv=abc123
 * ```
 */
export const contentVersionInterceptor: HttpInterceptorFn = (req, next) => {
  const contentVersionService = inject(ContentVersionService);
  const version = contentVersionService.currentVersion;

  // Skip if no version available yet
  if (!version) {
    return next(req);
  }

  // Only intercept GET requests
  if (req.method !== 'GET') {
    return next(req);
  }

  // Check if URL should be excluded
  if (shouldExclude(req.url)) {
    return next(req);
  }

  // Check if URL should be versioned
  if (!shouldVersion(req.url)) {
    return next(req);
  }

  // Append content version parameter
  const versionedReq = appendContentVersion(req, version);
  return next(versionedReq);
};

/**
 * Check if URL matches exclusion patterns.
 */
function shouldExclude(url: string): boolean {
  return EXCLUDED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if URL should have content version appended.
 */
function shouldVersion(url: string): boolean {
  return VERSIONED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Append content version parameter to request URL.
 */
function appendContentVersion(req: HttpRequest<unknown>, version: string): HttpRequest<unknown> {
  const separator = req.url.includes('?') ? '&' : '?';
  const versionedUrl = `${req.url}${separator}cv=${encodeURIComponent(version)}`;

  return req.clone({ url: versionedUrl });
}
