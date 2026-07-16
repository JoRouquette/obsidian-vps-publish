/**
 * Query-string parameters whose values must never appear in logs. Matched
 * case-insensitively.
 */
const SENSITIVE_PARAMS: ReadonlySet<string> = new Set([
  'token',
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

export function sanitizeLogUrl(originalUrl: string): string {
  const [pathname, queryString] = originalUrl.split('?', 2);
  if (!queryString) {
    return pathname;
  }

  const params = new URLSearchParams(queryString);
  for (const key of Array.from(params.keys())) {
    if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
      params.set(key, '[redacted]');
    }
  }

  const redactedQuery = params.toString();
  return redactedQuery ? `${pathname}?${redactedQuery}` : pathname;
}
