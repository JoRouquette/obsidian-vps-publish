export function sanitizeLogUrl(originalUrl: string): string {
  const [pathname, queryString] = originalUrl.split('?', 2);
  if (!queryString) {
    return pathname;
  }

  const params = new URLSearchParams(queryString);
  if (params.has('token')) {
    params.set('token', '[redacted]');
  }

  const redactedQuery = params.toString();
  return redactedQuery ? `${pathname}?${redactedQuery}` : pathname;
}
