import { sanitizeLogUrl } from '../sanitize-log-url.util';

function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

describe('sanitizeLogUrl', () => {
  it('returns the path unchanged when there is no query string', () => {
    expect(sanitizeLogUrl('/admin-api/summary')).toBe('/admin-api/summary');
  });

  it('redacts sensitive parameters and keeps the rest', () => {
    const out = sanitizeLogUrl('/admin-api/login?user=admin&mdp=s3cret&limit=200');
    const q = queryOf(out);

    expect(q.get('user')).toBe('[redacted]');
    expect(q.get('mdp')).toBe('[redacted]');
    expect(q.get('limit')).toBe('200');
    expect(q.get('user')).not.toBe('admin');
    expect(out).not.toContain('s3cret');
  });

  it('matches sensitive parameter names case-insensitively', () => {
    const out = sanitizeLogUrl('/x?Token=abc&API-KEY=def&Password=ghi');
    const q = queryOf(out);

    expect(q.get('Token')).toBe('[redacted]');
    expect(q.get('API-KEY')).toBe('[redacted]');
    expect(q.get('Password')).toBe('[redacted]');
    expect(out).not.toContain('abc');
    expect(out).not.toContain('def');
    expect(out).not.toContain('ghi');
  });

  it('leaves non-sensitive query parameters intact', () => {
    expect(sanitizeLogUrl('/search?q=hello&page=2')).toBe('/search?q=hello&page=2');
  });
});
