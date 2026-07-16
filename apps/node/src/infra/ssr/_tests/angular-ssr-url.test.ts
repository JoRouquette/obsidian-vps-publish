import { resolveRenderUrl } from '../angular-ssr.service';

describe('resolveRenderUrl', () => {
  it('uses the trusted origin and ignores the request Host', () => {
    const url = resolveRenderUrl(
      '/notes/page?x=1',
      'http://evil.example',
      'https://trusted.example'
    );

    expect(url).toBe('https://trusted.example/notes/page?x=1');
  });

  it('falls back to the request origin when no trusted origin is configured', () => {
    expect(resolveRenderUrl('/page', 'http://localhost:4200', undefined)).toBe(
      'http://localhost:4200/page'
    );
  });

  it('falls back to the request origin when the trusted origin is empty', () => {
    expect(resolveRenderUrl('/page', 'http://localhost:4200', '')).toBe(
      'http://localhost:4200/page'
    );
  });

  it('resets to the trusted origin root even if it carries a base path', () => {
    const url = resolveRenderUrl('/foo', 'http://evil.example', 'https://trusted.example/base/');

    expect(url).toBe('https://trusted.example/foo');
  });

  it('keeps a leading double slash target as a path, not a host', () => {
    expect(
      resolveRenderUrl('//docs/page', 'http://localhost:4200', 'https://trusted.example')
    ).toBe('https://trusted.example/docs/page');
  });

  it('does not throw on a target that new URL rejects', () => {
    const url = new URL(
      resolveRenderUrl('//[/x', 'http://localhost:4200', 'https://trusted.example')
    );

    expect(url.origin).toBe('https://trusted.example');
  });

  it('keeps the query string untouched', () => {
    expect(
      resolveRenderUrl('/page?a=1&b=%20', 'http://localhost:4200', 'https://trusted.example')
    ).toBe('https://trusted.example/page?a=1&b=%20');
    expect(
      new URL(
        resolveRenderUrl('//evil.example/x?y=1', 'http://localhost:4200', 'https://trusted.example')
      ).search
    ).toBe('?y=1');
  });

  describe.each([
    ['//evil.example/x', '/evil.example/x'],
    ['/\\evil.example/x', '/evil.example/x'],
    ['https://evil.example/x', '/x'],
    // The parsed pathname itself starts with '//': it must not stay protocol-relative
    ['https://evil.example//evil2.example/x', '/evil2.example/x'],
    // Dot segments are normalized after the first collapse and can expose '//' again
    ['/.//evil.example/x', '/evil.example/x'],
    ['/%2e//evil.example/x', '/evil.example/x'],
    ['/a/..//evil.example/x', '/evil.example/x'],
  ])('with hostile originalUrl %s', (originalUrl, expectedPath) => {
    it('keeps the trusted origin', () => {
      const url = new URL(
        resolveRenderUrl(originalUrl, 'http://localhost:4200', 'https://trusted.example')
      );

      expect(url.origin).toBe('https://trusted.example');
      expect(url.pathname).toBe(expectedPath);
    });

    it('keeps the request origin without a trusted origin', () => {
      const url = new URL(resolveRenderUrl(originalUrl, 'http://localhost:4200', undefined));

      expect(url.origin).toBe('http://localhost:4200');
      expect(url.pathname).toBe(expectedPath);
    });
  });
});
