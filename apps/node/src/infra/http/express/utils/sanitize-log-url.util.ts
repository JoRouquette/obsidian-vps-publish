/**
 * Query-string parameters whose values must never appear in logs. Matched
 * case-insensitively.
 */
const SENSITIVE_PARAMS: ReadonlySet<string> = new Set([
  'token',
  'access_token',
  'auth',
  'authorization',
  'jwt',
  'sig',
  'signature',
  'user',
  'username',
  'mdp',
  'password',
  'pwd',
  'api-key',
  'apikey',
  'key',
  'secret',
]);

const REDACTED_VALUE = '[redacted]';

export function sanitizeLogUrl(originalUrl: string): string {
  // Split on the first '?' only: any later '?' belongs to the query string itself.
  const queryStart = originalUrl.indexOf('?');
  if (queryStart === -1) {
    return originalUrl;
  }

  const pathname = originalUrl.slice(0, queryStart);
  const queryString = originalUrl.slice(queryStart + 1);
  if (!queryString) {
    return pathname;
  }

  const redacted = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(queryString)) {
    redacted.append(key, SENSITIVE_PARAMS.has(key.toLowerCase()) ? REDACTED_VALUE : value);
  }

  const redactedQuery = redacted.toString();
  return redactedQuery ? `${pathname}?${redactedQuery}` : pathname;
}
