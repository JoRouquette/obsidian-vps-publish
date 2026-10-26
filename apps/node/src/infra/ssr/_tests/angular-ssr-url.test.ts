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

  describe('invariants over hostile targets and bases', () => {
    const TRUSTED = 'https://trusted.example';
    const targets = [
      '/',
      '',
      '/notes/page?x=1#frag',
      '//evil.example/x',
      '\\\\evil.example\\x',
      '/\\evil.example/x',
      'https://evil.example/x',
      'https://evil.example//evil2.example/x',
      'http://[bad',
      'javascript:alert(1)',
      'data:text/html,<script>',
      '/.//evil.example/x',
      '/%2e//evil.example/x',
      '/a/..//evil.example/x',
      '//[/x',
      '?q=1',
      '#only-hash',
      '/%00',
    ];

    it.each(targets)('keeps the trusted origin and a rooted path for target %j', (target) => {
      const url = new URL(resolveRenderUrl(target, 'http://evil.example', TRUSTED));

      expect(url.origin).toBe(TRUSTED);
      expect(url.pathname.startsWith('/')).toBe(true);
      expect(url.pathname.startsWith('//')).toBe(false);
    });

    it.each(targets)('never throws for target %j whatever the base', (target) => {
      expect(() => resolveRenderUrl(target, 'not a url', 'also not a url')).not.toThrow();
      expect(() => resolveRenderUrl(target, '', undefined)).not.toThrow();
    });

    it.each([
      ['an unparseable trusted origin', 'http://evil.example', 'not a url', 'http://evil.example'],
      [
        'an opaque trusted origin',
        'http://evil.example',
        'data:text/plain,x',
        'http://evil.example',
      ],
      ['an unparseable request origin', 'bad', undefined, 'http://localhost'],
      ['both origins unparseable', 'bad', 'worse', 'http://localhost'],
    ])('resolves an origin with %s', (_, requestOrigin, trustedOrigin, expectedOrigin) => {
      const url = new URL(resolveRenderUrl('/page', requestOrigin, trustedOrigin));

      expect(url.origin).toBe(expectedOrigin);
      expect(url.pathname).toBe('/page');
    });

    it('keeps a non-hierarchical target under the trusted origin', () => {
      expect(resolveRenderUrl('javascript:alert(1)', 'http://localhost', TRUSTED)).toMatch(
        /^https:\/\/trusted\.example\//
      );
    });
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
