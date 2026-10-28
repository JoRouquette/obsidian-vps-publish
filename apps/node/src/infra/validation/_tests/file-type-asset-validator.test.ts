import { AssetScanError, type AssetScannerPort, AssetValidationError } from '@core-domain';
import fileType from 'file-type';

import {
  guessMimeTypeFromExtension,
  isAllowedMimeType,
  isExtensionAllowedForMimeType,
} from '../asset-mime-policy';
import { FileTypeAssetValidator } from '../file-type-asset-validator';

describe('FileTypeAssetValidator', () => {
  describe('MIME allowlist', () => {
    it('accepts a supported type resolved from the extension', async () => {
      const validator = new FileTypeAssetValidator();

      const result = await validator.validate(Buffer.from('<svg></svg>'), 'icon.svg');

      expect(result.valid).toBe(true);
      expect(result.detectedMimeType).toBe('image/svg+xml');
    });

    it('accepts plain text and json assets', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(Buffer.from('hello'), 'note.txt')).resolves.toMatchObject({
        detectedMimeType: 'text/plain',
      });
      await expect(validator.validate(Buffer.from('{}'), 'data.json')).resolves.toMatchObject({
        detectedMimeType: 'application/json',
      });
    });

    it('rejects unknown content that falls back to octet-stream', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('MZ binary'), 'payload.exe')
      ).rejects.toBeInstanceOf(AssetValidationError);
    });

    it('still enforces the size limit', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('hello world'), 'note.txt', 'text/plain', 4)
      ).rejects.toMatchObject({ reason: 'SIZE_EXCEEDED' });
    });
  });

  describe('active content types', () => {
    it.each([
      ['page.html', '<html><script>alert(1)</script></html>'],
      ['script.js', 'alert(1)'],
      ['doc.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"></html>'],
      ['data.xml', '<?xml version="1.0"?><a/>'],
    ])('rejects %s', async (filename, content) => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(Buffer.from(content), filename)).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });
  });

  describe('extension bound to the detected type', () => {
    // 8-byte PNG signature plus an IHDR header, enough for file-type to report image/png.
    const png = Buffer.concat([
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52,
      ]),
      Buffer.alloc(64),
    ]);

    it.each([['x.png'], ['x.PNG'], ['folder/x.Png'], ['archive.v2.png'], ['C:\\images\\x.png']])(
      'accepts PNG content named %s',
      async (filename) => {
        const validator = new FileTypeAssetValidator();

        await expect(validator.validate(png, filename)).resolves.toMatchObject({
          detectedMimeType: 'image/png',
        });
      }
    );

    it.each([
      ['x.html'],
      ['x.HTML'],
      ['x.exe'],
      ['x.svg'],
      ['x.jpg'],
      ['x.png.html'],
      ['x.html '],
      ['x.html.'],
      ['x'],
      ['.png'],
      ['folder.png/x'],
      [''],
    ])('rejects PNG content named %j', async (filename) => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(png, filename)).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });

    // Documented decision: when file-type recognises nothing, the declared extension decides the
    // type (that is how text, JSON and SVG assets are accepted). Arbitrary text named x.png is
    // therefore stored and served as image/png with `nosniff`, which a browser shows as a
    // broken image and never runs. Revisit only if a magic-number check is added for PNG.
    it('accepts arbitrary text named x.png, falling back on the extension', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('not an image at all'), 'x.png')
      ).resolves.toMatchObject({ valid: true, detectedMimeType: 'image/png' });
    });

    it('rejects an extension that belongs to another allowed type', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(png, 'x.pdf')).rejects.toBeInstanceOf(AssetValidationError);
    });

    it('accepts JPEG content under both of its extensions', async () => {
      const validator = new FileTypeAssetValidator();
      const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);

      await expect(validator.validate(jpeg, 'a.jpg')).resolves.toMatchObject({ valid: true });
      await expect(validator.validate(jpeg, 'a.JPEG')).resolves.toMatchObject({ valid: true });
    });
  });

  describe('ICO icons', () => {
    // ICONDIR header: reserved 0, type 1 (icon), one image; enough for file-type to report an icon.
    const ico = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]),
      Buffer.alloc(64),
    ]);

    it.each([['Poi.ico'], ['_assets/_icones/Nation.ICO']])(
      'accepts ICO content named %s',
      async (name) => {
        const validator = new FileTypeAssetValidator();

        await expect(validator.validate(ico, name)).resolves.toMatchObject({ valid: true });
      }
    );

    it('allows both MIME names of an icon, for the .ico extension only', () => {
      for (const mimeType of ['image/x-icon', 'image/vnd.microsoft.icon']) {
        expect(isAllowedMimeType(mimeType)).toBe(true);
        expect(isExtensionAllowedForMimeType('Poi.ico', mimeType)).toBe(true);
        expect(isExtensionAllowedForMimeType('Poi.png', mimeType)).toBe(false);
      }
      expect(guessMimeTypeFromExtension('Poi.ico')).toBe('image/x-icon');
    });

    it('rejects PNG content named x.ico', async () => {
      const validator = new FileTypeAssetValidator();
      const png = Buffer.concat([
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
          0x52,
        ]),
        Buffer.alloc(64),
      ]);

      await expect(validator.validate(png, 'x.ico')).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });

    it('accepts bytes file-type does not recognise under .ico, as for the other image types', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('not an image at all'), 'x.ico')
      ).resolves.toMatchObject({ valid: true, detectedMimeType: 'image/x-icon' });
    });

    it('rejects Windows executable content named x.ico', async () => {
      const validator = new FileTypeAssetValidator();

      // The bytes decide: an executable is refused whatever its extension.
      await expect(validator.validate(Buffer.from('MZ binary'), 'x.ico')).rejects.toBeInstanceOf(
        AssetValidationError
      );
    });

    it('still rejects ICO content stored under another extension', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(ico, 'x.html')).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });
  });

  describe('content checks for types resolved from the extension', () => {
    it.each([
      [
        'a script element',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ],
      ['an upper-case script element', '<svg><SCRIPT>alert(1)</SCRIPT></svg>'],
      ['a foreignObject', '<svg><foreignObject><iframe/></foreignObject></svg>'],
      ['an onload handler', '<svg onload="alert(1)"></svg>'],
      ['a slash-separated handler', '<svg/onload=alert(1)></svg>'],
      ['a handler after a > in an attribute', '<svg title=">" onload=alert(1)></svg>'],
      ['an onclick handler on a child', '<svg><rect onclick = "alert(1)"/></svg>'],
      ['an href javascript: link', '<svg><a href="javascript:alert(1)"><rect/></a></svg>'],
      ['an xlink:href javascript: link', "<svg><a xlink:href='javascript:alert(1)'/></svg>"],
      ['a tab-obfuscated javascript: link', '<svg><a href="java\tscript:alert(1)"/></svg>'],
      ['an entity-obfuscated javascript: link', '<svg><a href="&#106;avascript:alert(1)"/></svg>'],
      ['a hex-entity javascript: link', '<svg><a href="&#x6A;avascript:alert(1)"/></svg>'],
    ])('rejects an SVG with %s', async (_, svg) => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(Buffer.from(svg), 'icon.svg')).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });

    it('rejects an SVG encoded as UTF-16', async () => {
      const validator = new FileTypeAssetValidator();
      const utf16 = Buffer.from('<svg><script>alert(1)</script></svg>', 'utf16le');

      await expect(validator.validate(utf16, 'icon.svg')).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });

    it('accepts a plain SVG with a style element and internal links', async () => {
      const validator = new FileTypeAssetValidator();
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{fill:red}</style>' +
        '<a href="#target"><rect class="a" width="5" height="5"/></a></svg>';

      await expect(validator.validate(Buffer.from(svg), 'icon.svg')).resolves.toMatchObject({
        detectedMimeType: 'image/svg+xml',
      });
    });

    it.each([['{not json'], [''], ['undefined'], ["{'a':1}"]])(
      'rejects JSON that does not parse: %j',
      async (content) => {
        const validator = new FileTypeAssetValidator();

        await expect(validator.validate(Buffer.from(content), 'data.json')).rejects.toMatchObject({
          reason: 'INVALID_CONTENT',
        });
      }
    );

    it('accepts JSON with a byte order mark', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('\uFEFF{"a":1}'), 'data.json')
      ).resolves.toMatchObject({ detectedMimeType: 'application/json' });
    });

    it.each([['note.txt'], ['note.md']])('rejects a NUL byte in %s', async (filename) => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from([0x68, 0x69, 0x00, 0x21]), filename)
      ).rejects.toMatchObject({ reason: 'INVALID_CONTENT' });
    });

    it('accepts markdown text', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('# Title\n\nSome *text*.'), 'note.md')
      ).resolves.toMatchObject({ detectedMimeType: 'text/markdown' });
    });
  });

  describe('SVG with an XML prolog', () => {
    const prolog = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const svg = `${prolog}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect/></svg>`;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('is detected by file-type as application/xml, never as an SVG', async () => {
      // If this changes, the extension-based path below can be revisited.
      expect((await fileType.fromBuffer(Buffer.from(svg)))?.mime).toBe('application/xml');
      expect(
        await fileType.fromBuffer(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))
      ).toBeUndefined();
    });

    it('is accepted under the .svg extension', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(Buffer.from(svg), 'drawing.svg')).resolves.toMatchObject({
        valid: true,
        detectedMimeType: 'image/svg+xml',
      });
      await expect(validator.validate(Buffer.from(svg), 'drawing.SVG')).resolves.toMatchObject({
        valid: true,
      });
    });

    it.each([['drawing.xml'], ['drawing.svg.xml'], ['drawing.xml.svg.html'], ['drawing']])(
      'refuses the same content named %s',
      async (filename) => {
        const validator = new FileTypeAssetValidator();

        await expect(validator.validate(Buffer.from(svg), filename)).rejects.toMatchObject({
          reason: 'INVALID_CONTENT',
        });
      }
    );

    it('refuses an XML document without an svg root even under .svg', async () => {
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from(`${prolog}<html xmlns="x"/>`), 'drawing.svg')
      ).rejects.toMatchObject({ reason: 'INVALID_CONTENT' });
    });

    it.each([
      [
        'a script',
        `${prolog}<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
      ],
      ['a DOCTYPE', `${prolog}<!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg"/>`],
      ['an event handler', `${prolog}<svg xmlns="http://www.w3.org/2000/svg" onload="x()"/>`],
    ])('refuses a prolog SVG with %s', async (_, content) => {
      const validator = new FileTypeAssetValidator();

      await expect(validator.validate(Buffer.from(content), 'drawing.svg')).rejects.toMatchObject({
        reason: 'INVALID_CONTENT',
      });
    });

    it('applies the SVG content checks even when file-type reports image/svg+xml', async () => {
      // The library's own types do not list SVG, hence the cast.
      jest
        .spyOn(fileType, 'fromBuffer')
        .mockResolvedValue({ ext: 'svg', mime: 'image/svg+xml' } as unknown as Awaited<
          ReturnType<typeof fileType.fromBuffer>
        >);
      const validator = new FileTypeAssetValidator();

      await expect(
        validator.validate(Buffer.from('<svg><script>alert(1)</script></svg>'), 'icon.svg')
      ).rejects.toMatchObject({ reason: 'INVALID_CONTENT' });
    });
  });

  describe('virus scanning', () => {
    const cleanBuffer = Buffer.from('hello');

    it('passes when the scanner reports the asset is clean', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockResolvedValue({ isClean: true }),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).resolves.toMatchObject({
        valid: true,
      });
    });

    it('rejects when the scanner reports a threat', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockResolvedValue({ isClean: false, threat: 'Eicar-Test' }),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).rejects.toBeInstanceOf(
        AssetValidationError
      );
    });

    it('fails closed when the scanner throws an unexpected error', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockRejectedValue(new Error('clamd unreachable')),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).rejects.toBeInstanceOf(
        AssetValidationError
      );
    });

    it('propagates AssetScanError raised by the scanner', async () => {
      const scanner: AssetScannerPort = {
        scan: jest.fn().mockRejectedValue(new AssetScanError('threat', 'note.txt', 'Trojan')),
      };
      const validator = new FileTypeAssetValidator(scanner);

      await expect(validator.validate(cleanBuffer, 'note.txt')).rejects.toBeInstanceOf(
        AssetScanError
      );
    });
  });
});
