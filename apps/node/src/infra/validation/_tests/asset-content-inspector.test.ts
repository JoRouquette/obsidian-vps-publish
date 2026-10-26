import { findUnsafeContent, hasSvgRootElement } from '../asset-content-inspector';

function inspectSvg(svg: string): string | undefined {
  return findUnsafeContent('image/svg+xml', Buffer.from(svg));
}

describe('findUnsafeContent', () => {
  describe('SVG active content', () => {
    it.each([
      ['a script element', '<svg><script>alert(1)</script></svg>'],
      ['a namespace-prefixed script element', '<svg:svg xmlns:svg="x"><svg:script/></svg:svg>'],
      ['a script element with a dotted prefix', '<svg><a.b:script>alert(1)</a.b:script></svg>'],
      ['a spaced script element', '<svg>< script>alert(1)</script></svg>'],
      ['a foreignObject', '<svg><foreignObject><iframe/></foreignObject></svg>'],
      ['a namespace-prefixed foreignObject', '<svg><svg:foreignObject/></svg>'],
      ['a DOCTYPE', '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd"><svg/>'],
      ['a lower-case doctype', '<!doctype svg><svg/>'],
      ['an ENTITY declaration', '<!DOCTYPE svg [<!ENTITY a "b">]><svg/>'],
      ['an ENTITY declaration without a DOCTYPE', '<svg><!ENTITY a "b"></svg>'],
      ['an onload handler', '<svg onload="alert(1)"/>'],
      ['a javascript: href', '<svg><a href="javascript:alert(1)"/></svg>'],
      ['a &Tab; obfuscated javascript: href', '<svg><a href="java&Tab;script:alert(1)"/></svg>'],
      ['a &NewLine; obfuscated javascript: href', '<svg><a href="java&NewLine;script:x"/></svg>'],
      ['a &colon; obfuscated javascript: href', '<svg><a href="javascript&colon;alert(1)"/></svg>'],
      ['a &colon; in an xlink:href', "<svg><a xlink:href='javascript&colon;alert(1)'/></svg>"],
    ])('refuses %s', (_, svg) => {
      expect(inspectSvg(svg)).toBeDefined();
    });

    it.each([
      [
        '<set> on href',
        '<svg><a href="#x"><set attributeName="href" to="javascript:alert(1)"/></a></svg>',
      ],
      [
        '<set> on xlink:href',
        '<svg><a><set attributeName="xlink:href" to="javascript:x"/></a></svg>',
      ],
      [
        '<animate> on href',
        '<svg><a><animate attributeName="href" values="javascript:x"/></a></svg>',
      ],
      ['<animate> with single quotes', "<svg><a><animate attributeName='href' to='j'/></a></svg>"],
      [
        '<animate> after a > in a value',
        '<svg><a><animate title=">" attributeName="href"/></a></svg>',
      ],
      ['<animateTransform> on href', '<svg><a><animateTransform attributeName="href"/></a></svg>'],
      ['a prefixed <svg:set>', '<svg><svg:set attributeName="href" to="x"/></svg>'],
      ['an entity-obfuscated attributeName', '<svg><set attributeName="&#104;ref" to="x"/></svg>'],
    ])('refuses %s', (_, svg) => {
      expect(inspectSvg(svg)).toBe('SVG animates a link target');
    });

    it('accepts an animation of a harmless attribute', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1">' +
        '<animate attributeName="width" from="1" to="5" dur="1s"/>' +
        '<set attributeName="fill" to="red"/></rect></svg>';

      expect(inspectSvg(svg)).toBeUndefined();
    });

    it('accepts a plain SVG with internal links', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="#t"><rect/></a></svg>';

      expect(inspectSvg(svg)).toBeUndefined();
    });

    it('refuses an SVG that is not UTF-8 text', () => {
      expect(findUnsafeContent('image/svg+xml', Buffer.from('<svg/>', 'utf16le'))).toBe(
        'SVG is not UTF-8 text'
      );
    });
  });

  describe('SVG animation tags', () => {
    it('refuses a SMIL tag that never closes', () => {
      expect(inspectSvg('<svg><set attributeName="fill" to="red"')).toBe(
        'SVG contains an unterminated or oversized animation tag'
      );
    });

    it('refuses a SMIL tag longer than the bound', () => {
      const svg = `<svg><set title="${'a'.repeat(5000)}" attributeName="fill"/></svg>`;

      expect(inspectSvg(svg)).toBe('SVG contains an unterminated or oversized animation tag');
    });

    it('accepts a SMIL tag well within the bound', () => {
      const svg = `<svg><set title="${'a'.repeat(1000)}" attributeName="fill"/></svg>`;

      expect(inspectSvg(svg)).toBeUndefined();
    });
  });

  // Inputs shaped to make a backtracking pattern rescan the rest of the file from every tag.
  // The threshold is wide on purpose (a quadratic scan of 1 MB takes minutes); the verdict is
  // part of the contract: unterminated SMIL tags are refused, a flood of <svg> is plain content.
  describe('hostile inputs stay linear', () => {
    const ONE_MEGABYTE = 1024 * 1024;
    const MAX_DURATION_MS = 200;

    function timed<T>(action: () => T): { result: T; duration: number } {
      const startedAt = performance.now();
      const result = action();
      return { result, duration: performance.now() - startedAt };
    }

    it.each([
      [
        'unterminated <set " tags',
        '<set "',
        'SVG contains an unterminated or oversized animation tag',
      ],
      [
        'unterminated <animate tags',
        '<animate ',
        'SVG contains an unterminated or oversized animation tag',
      ],
      ['<svg tags', '<svg ', undefined],
      ['open angle brackets', '< ', undefined],
      ['attribute-like noise', ' onx href=" ', undefined],
    ])('handles 1 MB of %s quickly and deterministically', (_, unit, expected) => {
      const svg = `<svg>${unit.repeat(Math.ceil(ONE_MEGABYTE / unit.length))}`;

      const { result, duration } = timed(() => inspectSvg(svg));

      expect(result).toBe(expected);
      expect(duration).toBeLessThan(MAX_DURATION_MS);
    });

    it('finds the root of 1 MB of <svg tags quickly', () => {
      const svg = Buffer.from('<svg '.repeat(ONE_MEGABYTE / 5));

      const { result, duration } = timed(() => hasSvgRootElement(svg));

      expect(result).toBe(true);
      expect(duration).toBeLessThan(MAX_DURATION_MS);
    });

    it('gives up on 1 MB of unterminated comments quickly', () => {
      const content = Buffer.from('<!-- '.repeat(ONE_MEGABYTE / 5));

      const { result, duration } = timed(() => hasSvgRootElement(content));

      expect(result).toBe(false);
      expect(duration).toBeLessThan(MAX_DURATION_MS);
    });
  });

  describe('other types', () => {
    it('ignores binary types', () => {
      expect(findUnsafeContent('image/png', Buffer.from([0x89, 0x50, 0x00]))).toBeUndefined();
    });

    it('refuses invalid JSON and NUL bytes in text', () => {
      expect(findUnsafeContent('application/json', Buffer.from('{'))).toBe('invalid JSON');
      expect(findUnsafeContent('text/plain', Buffer.from([0x61, 0x00]))).toBeDefined();
    });
  });
});

describe('hasSvgRootElement', () => {
  it.each([
    ['<svg/>', true],
    ['<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg">', true],
    ['<svg:svg xmlns:svg="x"/>', true],
    ['<?xml version="1.0"?><a/>', false],
    ['<svgfoo/>', false],
    ['<?xml?><html><svg/></html>', false],
    ['<!-- <svg> --><a/>', false],
    ['<!-- c --><svg/>', true],
    ['<?xml version="1.0"?>\n<!-- c -->\n<?pi x?> <svg xmlns="x"/>', true],
    ['<svg:svg xmlns:svg="x"/>', true],
    ['<!-- never closed <svg/>', false],
    ['<?xml never closed <svg/>', false],
    ['', false],
  ])('%j gives %s', (content, expected) => {
    expect(hasSvgRootElement(Buffer.from(content))).toBe(expected);
  });

  it('is false for UTF-16 content', () => {
    expect(hasSvgRootElement(Buffer.from('<svg/>', 'utf16le'))).toBe(false);
  });
});
