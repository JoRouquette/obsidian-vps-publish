import { sanitizeLogUrl } from '../sanitize-log-url.util';

function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
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

  it.each(['access_token', 'auth', 'authorization', 'jwt', 'sig', 'signature'])(
    'redacts the %s parameter',
    (name) => {
      const out = sanitizeLogUrl(`/x?${name}=topsecret&page=2`);

      expect(queryOf(out).get(name)).toBe('[redacted]');
      expect(queryOf(out).get('page')).toBe('2');
      expect(out).not.toContain('topsecret');
    }
  );

  it('redacts every occurrence of a duplicated sensitive key', () => {
    const out = sanitizeLogUrl('/x?token=one&q=a&token=two');

    expect(queryOf(out).getAll('token')).toEqual(['[redacted]', '[redacted]']);
    expect(out).not.toContain('one');
    expect(out).not.toContain('two');
  });

  it('keeps every occurrence of a duplicated non-sensitive key', () => {
    expect(queryOf(sanitizeLogUrl('/x?tag=a&tag=b')).getAll('tag')).toEqual(['a', 'b']);
  });

  it('redacts a sensitive key whatever its case', () => {
    const out = sanitizeLogUrl('/x?SIGNATURE=abc&Jwt=def');

    expect(out).not.toContain('abc');
    expect(out).not.toContain('def');
  });

  it('redacts a sensitive key with an empty value', () => {
    expect(queryOf(sanitizeLogUrl('/x?token=&q=1')).get('token')).toBe('[redacted]');
  });

  it('keeps the query after a second question mark', () => {
    const out = sanitizeLogUrl('/x?a=1?b=2&token=secret');
    const q = queryOf(out);

    expect(q.get('a')).toBe('1?b=2');
    expect(q.get('token')).toBe('[redacted]');
    expect(out).not.toContain('secret');
  });

  it('drops a dangling question mark', () => {
    expect(sanitizeLogUrl('/x?')).toBe('/x');
  });
});
