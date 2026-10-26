import MarkdownIt from 'markdown-it';

import { sanitizeRenderedHtml } from '../html-sanitizer';
import { registerKatexRenderer } from '../katex-renderer.plugin';

function styleOf(html: string): string {
  return html.match(/style="([^"]*)"/)?.[1] ?? '';
}

// Compares declarations whatever the spacing, so only property and value matter.
function declarationsOf(style: string): string[] {
  return style
    .split(';')
    .map((declaration) =>
      declaration
        .replace(/\s+/g, ' ')
        .replace(/\s*:\s*/, ':')
        .trim()
    )
    .filter((declaration) => declaration.length > 0);
}

function allStyleDeclarations(html: string): string[] {
  return Array.from(html.matchAll(/\sstyle="([^"]*)"/g)).flatMap((match) =>
    declarationsOf(match[1])
  );
}

// What the KaTeX pipeline emits for these must survive the sanitizer, declaration by declaration
// (see `ASSUMED_KATEX_LOSSES` for the ones that are dropped on purpose).
const KATEX_FORMULAS = [
  'x^2',
  'x_i',
  'x_i^2',
  '\\frac{a}{b}',
  '\\sqrt{x}',
  '\\sqrt[3]{x}',
  '\\sum_{i=1}^n i',
  '\\int_0^1 f',
  '\\lim_{x\\to 0} f',
  '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}',
  '\\begin{cases}a&x>0\\\\b&x\\le 0\\end{cases}',
  '\\begin{array}{c|c}a&b\\\\\\hline c&d\\end{array}',
  '\\begin{array}{c:c}a&b\\end{array}',
  '\\begin{array}{cc}a&b\\\\\\hdashline c&d\\end{array}',
  '\\text{abc}',
  '\\hat{x}',
  '\\widehat{xy}',
  '\\overline{x}',
  '\\underline{x}',
  '\\overbrace{x}^{y}',
  '\\xrightarrow{a}',
  '\\cancel{x}',
  '\\left(\\frac{a}{b}\\right)',
  '\\binom{n}{k}',
  '\\color{red}{x}',
  '\\textcolor{red}{x}',
  '\\colorbox{yellow}{x}',
  '\\fcolorbox{red}{yellow}{x}',
  '\\hspace{1em}',
  '\\rule{1em}{2px}',
];

// Declarations KaTeX emits that the sanitizer removes as a deliberate choice: `position:relative`
// on large operators (it would make the element a positioning context for the page).
const ASSUMED_KATEX_LOSSES: readonly RegExp[] = [/^position:/];

function isAssumedKatexLoss(declaration: string): boolean {
  return ASSUMED_KATEX_LOSSES.some((loss) => loss.test(declaration));
}

describe('sanitizeRenderedHtml', () => {
  describe('removes MathML elements that integrate HTML (mXSS surface)', () => {
    it.each([
      [
        'annotation-xml',
        '<math><annotation-xml encoding="text/html"><img src=x></annotation-xml></math>',
      ],
      ['mglyph', '<math><mtext><mglyph><img src=x></mglyph></mtext></math>'],
      ['maction', '<math><maction actiontype="toggle"><mi>a</mi><mi>b</mi></maction></math>'],
    ])('drops <%s>', (tag, html) => {
      expect(sanitizeRenderedHtml(html)).not.toContain(`<${tag}`);
    });
  });

  describe('leaves the MathML emitted by the KaTeX pipeline untouched', () => {
    const md = new MarkdownIt({ html: true });
    registerKatexRenderer(md);

    // The sanitizer writes `<mspace/>` as `<mspace></mspace>` and `style="a: b"` as `style="a:b"`:
    // same element, same declarations.
    const mathml = (html: string) =>
      html
        .match(/<math[\s\S]*<\/math>/)?.[0]
        .replace(/<(\w+)([^<>]*?)\s*\/>/g, '<$1$2></$1>')
        .replace(
          /style="([^"]*)"/g,
          (_, style: string) => `style="${declarationsOf(style).join(';')}"`
        );

    it.each(KATEX_FORMULAS)('%s', (formula) => {
      const raw = md.render(`$$${formula}$$`);

      expect(raw).not.toMatch(/annotation-xml|mglyph|maction/);
      expect(mathml(raw)).toBeDefined();
      expect(mathml(sanitizeRenderedHtml(raw))).toBe(mathml(raw));
    });

    // `\includegraphics` is the only KaTeX command that emits <mglyph>, and only with
    // `trust: true`. The pipeline runs with `trust: false`, where it renders an error instead.
    it('renders \\includegraphics as an error, without <mglyph> or an image', () => {
      const raw = md.render('$$\\includegraphics[height=1em]{https://x.example/a.png}$$');
      const result = sanitizeRenderedHtml(raw);

      // The source stays visible as text in the TeX annotation; no element carries the URL.
      expect(raw).not.toMatch(/mglyph|<img|src=|href=/);
      expect(raw).toContain('class="mord text"');
      expect(result).not.toMatch(/mglyph|<img|src=|href=/);
    });
  });

  describe('keeps the inline styles KaTeX needs for layout', () => {
    const md = new MarkdownIt({ html: true });
    registerKatexRenderer(md);

    it.each(KATEX_FORMULAS)('%s keeps every allowed declaration', (formula) => {
      const raw = md.render(`$$${formula}$$`);
      const kept = allStyleDeclarations(sanitizeRenderedHtml(raw));
      const emitted = allStyleDeclarations(raw);

      expect(kept).toEqual(emitted.filter((declaration) => !isAssumedKatexLoss(declaration)));
    });

    it('drops position:relative on large operators, as a deliberate choice', () => {
      const raw = md.render('$$\\int_0^1 f$$');

      expect(allStyleDeclarations(raw)).toContain('position:relative');
      expect(allStyleDeclarations(sanitizeRenderedHtml(raw))).not.toContain('position:relative');
    });

    it('keeps the colours of \\textcolor, \\colorbox and \\fcolorbox', () => {
      const result = sanitizeRenderedHtml(
        md.render('$$\\textcolor{red}{x}\\colorbox{yellow}{y}\\fcolorbox{red}{yellow}{z}$$')
      );

      expect(result).toContain('color:red');
      expect(result).toContain('background-color:yellow');
      expect(result).toContain('border-color:red');
    });

    it('keeps the dashed separators of arrays', () => {
      const vertical = sanitizeRenderedHtml(md.render('$$\\begin{array}{c:c}a&b\\end{array}$$'));
      const horizontal = sanitizeRenderedHtml(
        md.render('$$\\begin{array}{c}a\\\\\\hdashline b\\end{array}$$')
      );

      expect(vertical).toContain('border-right-style:dashed');
      // The dashed line is drawn by the `hdashline` class of the KaTeX stylesheet.
      expect(horizontal).toContain('hdashline');
    });

    it('keeps the offsets of exponents and subscripts', () => {
      const result = sanitizeRenderedHtml(md.render('$x_i^2$'));

      expect(result).toMatch(/style="top:-\d+(\.\d+)?em;margin-left:/);
      expect(result).toContain('vertical-align:');
      expect(result).toContain('height:');
    });

    it('keeps the border declarations of arrays and fraction bars', () => {
      const array = sanitizeRenderedHtml(
        md.render('$$\\begin{array}{c|c}a&b\\\\\\hline c&d\\end{array}$$')
      );
      const root = sanitizeRenderedHtml(md.render('$$\\sqrt{x}$$'));
      const fraction = sanitizeRenderedHtml(md.render('$$\\frac{a}{b}$$'));

      expect(array).toContain('border-bottom-width:');
      expect(array).toContain('border-right-width:');
      expect(array).toContain('border-right-style:solid');
      expect(fraction).toContain('border-bottom-width:');
      expect(root).toContain('min-width:');
    });

    it.each(KATEX_FORMULAS)('%s never carries position, z-index or url()', (formula) => {
      const result = sanitizeRenderedHtml(md.render(`$$${formula}$$`));

      expect(result).not.toMatch(/position\s*:|z-index|inset|url\(|expression/i);
    });
  });

  describe('removes executable markup', () => {
    it('drops <script> tags and their content', () => {
      const result = sanitizeRenderedHtml('<p>ok</p><script>alert(1)</script>');

      expect(result).toContain('<p>ok</p>');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert(1)');
    });

    it('strips inline event handlers', () => {
      const result = sanitizeRenderedHtml('<img src="/a.png" onerror="alert(1)" alt="x">');

      expect(result).toContain('src="/a.png"');
      expect(result).not.toContain('onerror');
    });

    it('removes javascript: URLs while keeping the anchor text', () => {
      const result = sanitizeRenderedHtml('<a href="javascript:alert(1)">click</a>');

      expect(result).toContain('click');
      expect(result).not.toContain('javascript:');
    });

    it('discards <iframe> and <object> embeds', () => {
      const result = sanitizeRenderedHtml(
        '<p>a</p><iframe src="https://evil.example"></iframe><object data="x"></object>'
      );

      expect(result).toContain('<p>a</p>');
      expect(result).not.toContain('iframe');
      expect(result).not.toContain('object');
    });
  });

  describe('filters the style attribute', () => {
    it.each([
      ['position', 'position:fixed'],
      ['position relative', 'position:relative'],
      ['z-index', 'z-index:9999'],
      ['inset', 'inset:0'],
      ['background with url()', 'background:url(https://x.example/track.png)'],
      ['background-image with url()', 'background-image:url(https://x.example/track.png)'],
      ['behavior', 'behavior:url(script.htc)'],
      ['expression() in width', 'width:expression(alert(1))'],
      ['expression() in color', 'color:expression(alert(1))'],
      ['url() in a custom property', '--callout-color:url(https://x.example/a.png)'],
      ['a javascript: value', 'color:javascript:alert(1)'],
    ])('drops %s', (_, style) => {
      const result = sanitizeRenderedHtml(`<div style="${style}">t</div>`);

      expect(result).toBe('<div>t</div>');
    });

    it('drops position and z-index from a takeover attempt but not the inert offsets', () => {
      const result = sanitizeRenderedHtml(
        '<div style="position:fixed;top:0;left:0;z-index:9999;width:100vw;height:100vh">t</div>'
      );

      expect(result).toBe('<div style="top:0;left:0">t</div>');
    });

    it('keeps the allowed declarations next to a dropped one', () => {
      const result = sanitizeRenderedHtml(
        '<span style="color:red;position:fixed;background-color:#800020;z-index:1">t</span>'
      );

      expect(result).toBe('<span style="color:red;background-color:#800020">t</span>');
    });

    it.each([
      ['margin-top:-9999px', 'margin-top:-9999px'],
      ['a negative px margin shorthand', 'margin:0 -10px'],
      ['a negative em beyond two digits', 'margin-left:-100em'],
      ['top in px', 'top:-5px'],
      ['viewport width and height', 'width:100vw;height:100vh'],
      ['viewport units in max-width', 'max-width:50vw'],
      ['a negative padding', 'padding-left:-1em'],
      ['a function in a length', 'top:calc(1em + 1px)'],
      ['a url() border style', 'border-style:url(x)'],
      ['a dotted border style', 'border-right-style:dotted'],
      ['a url() border colour', 'border-color:url(x)'],
      ['a border shorthand with a url()', 'border:1px solid url(https://x.example/a.png)'],
      ['a border shorthand without a style', 'border:1px red'],
      ['an oversized border shorthand', 'border:9999em solid red'],
      ['an em width beyond three digits', 'width:9999em;height:9999em'],
      ['a rem height beyond three digits', 'height:1000rem'],
      ['a min-width beyond three digits', 'min-width:1000ex'],
      ['a px width beyond four digits', 'max-width:10000px'],
      ['a percentage beyond four digits', 'max-height:10000%'],
      ['a unitless size beyond three digits', 'width:1000'],
    ])('drops %s', (_, style) => {
      const result = sanitizeRenderedHtml(`<div style="${style}">t</div>`);

      expect(result).toBe('<div>t</div>');
    });

    it.each([
      ['figure centring', 'max-width:400px;margin-inline:auto; text-align:center'],
      ['image sizing', 'max-width:300px'],
      ['table alignment', 'text-align:right'],
      ['float and margin', 'float:left;margin:0 1em 0.5em 0'],
      ['dataview badge', 'background-color:#800020;color:white;padding:3px 5px'],
      ['italic text', 'font-style: italic'],
      ['callout colour as rgb()', '--callout-color: rgb(100, 220, 100)'],
      ['callout colour as hsl()', '--callout-color: hsl(210, 50%, 40%)'],
      ['callout colour as a variable', '--callout-color: var(--color-red)'],
      ['a negative em offset', 'top:-2.55em;margin-left:-0.1945em;margin-right:0.05em'],
      ['a negative em margin shorthand', 'margin:0 -0.02em'],
      ['the largest em size', 'width:999em;height:999.5em'],
      ['the largest px size', 'max-width:9999px;max-height:9999px'],
      ['a dashed border', 'border-right-style:dashed;border-bottom-style:dashed'],
      ['a solid top border', 'border-top-style:solid'],
      ['a border colour', 'border-color:#ff0000'],
      ['a KaTeX frame border', 'border:0.04em solid red'],
    ])('keeps %s', (_, style) => {
      const result = sanitizeRenderedHtml(`<div style="${style}">t</div>`);

      expect(result).toMatch(/^<div style="[^"]+">t<\/div>$/);
      expect(declarationsOf(styleOf(result))).toEqual(declarationsOf(style));
    });

    it('accepts a custom property as an allowed style key', () => {
      const result = sanitizeRenderedHtml('<div style="--callout-color: #448aff">t</div>');

      expect(result).toBe('<div style="--callout-color:#448aff">t</div>');
    });
  });

  describe('rejects URL and markup vectors', () => {
    it('removes a javascript: xlink:href on an SVG link', () => {
      const result = sanitizeRenderedHtml(
        '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>'
      );

      expect(result).not.toContain('javascript:');
      expect(result).toContain('<text>x</text>');
    });

    it('removes a javascript: href on <use>', () => {
      const result = sanitizeRenderedHtml('<svg><use href="javascript:alert(1)"></use></svg>');

      expect(result).not.toContain('javascript:');
    });

    it('removes a data:text/html link while keeping the text', () => {
      const result = sanitizeRenderedHtml(
        '<a href="data:text/html,<script>alert(1)</script>">click</a>'
      );

      expect(result).not.toContain('data:');
      expect(result).not.toContain('script');
      expect(result).toContain('click');
    });

    it('removes a javascript: candidate from srcset', () => {
      const result = sanitizeRenderedHtml(
        '<img src="/a.png" srcset="javascript:alert(1) 1x, /b.png 2x">'
      );

      expect(result).not.toContain('javascript:');
      expect(result).toContain('src="/a.png"');
    });

    it('removes a scheme obfuscated with a character reference', () => {
      const result = sanitizeRenderedHtml('<a href="java&#9;script:alert(1)">click</a>');

      expect(result).not.toMatch(/java\s*script/i);
      expect(result).toContain('click');
    });

    it('keeps an inline data:image/png source', () => {
      const result = sanitizeRenderedHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="">');

      expect(result).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    });

    it('drops <desc> so nested HTML in an SVG cannot reach the parser as HTML', () => {
      const result = sanitizeRenderedHtml(
        '<svg><desc><img src=x onerror=alert(1)></desc><circle r="1"></circle></svg>'
      );

      expect(result).not.toContain('<desc');
      expect(result).not.toContain('onerror');
      expect(result).toContain('<circle r="1">');
    });
  });

  describe('preserves the trusted markup emitted by the renderers', () => {
    it('keeps callout structure, custom color property and icon data attribute', () => {
      const callout =
        '<div class="callout" data-callout="note" style="--callout-color: #448aff">' +
        '<span class="callout-icon material-symbols-outlined" data-icon="pencil" aria-hidden="true">pencil</span>' +
        '<p>body</p></div>';

      const result = sanitizeRenderedHtml(callout);

      expect(result).toContain('class="callout"');
      expect(result).toContain('data-callout="note"');
      expect(result).toContain('style="--callout-color:#448aff"');
      expect(result).toContain('data-icon="pencil"');
    });

    it('keeps a foldable callout expanded by preserving the details open attribute', () => {
      const foldable =
        '<details class="callout" data-callout="danger" data-callout-fold="open" open>' +
        '<summary class="callout-title"><span class="callout-label">Expandable Error</span></summary>' +
        '<div class="callout-content"><p>Error details.</p></div></details>';

      const result = sanitizeRenderedHtml(foldable);

      expect(result).toContain('data-callout-fold="open"');
      expect(result).toContain('<details class="callout"');
      expect(result).toContain(' open');
    });

    it('keeps a collapsed foldable callout closed', () => {
      const collapsed =
        '<details class="callout" data-callout="note" data-callout-fold="closed">' +
        '<summary class="callout-title"><span class="callout-label">Collapsed</span></summary>' +
        '<div class="callout-content"><p>body</p></div></details>';

      const result = sanitizeRenderedHtml(collapsed);

      expect(result).toContain('data-callout-fold="closed"');
      expect(result).not.toContain(' open>');
    });

    it('keeps the leaflet placeholder and its JSON data attribute', () => {
      const leaflet =
        '<div class="leaflet-map-placeholder" data-leaflet-map-id="m1" ' +
        `data-leaflet-block='{"id":"m1","lat":48.85,"long":2.35}'></div>`;

      const result = sanitizeRenderedHtml(leaflet);

      expect(result).toContain('class="leaflet-map-placeholder"');
      expect(result).toContain('data-leaflet-map-id="m1"');
      expect(result).toContain('data-leaflet-block');
      // The JSON payload must remain parseable once the browser decodes entities.
      const match = result.match(/data-leaflet-block="([^"]*)"/);
      expect(match).not.toBeNull();
      const decoded = (match as RegExpMatchArray)[1].replace(/&quot;/g, '"');
      expect(() => JSON.parse(decoded)).not.toThrow();
    });

    it('keeps resolved and unresolved wikilink markup', () => {
      const wikilinks =
        '<a class="wikilink" data-wikilink="Target" href="/target">Target</a>' +
        '<span class="wikilink wikilink-unresolved" role="link" aria-disabled="true" ' +
        'tabindex="0" data-tooltip="missing" data-wikilink="Ghost">Ghost</span>';

      const result = sanitizeRenderedHtml(wikilinks);

      expect(result).toContain('class="wikilink"');
      expect(result).toContain('data-wikilink="Target"');
      expect(result).toContain('href="/target"');
      expect(result).toContain('wikilink-unresolved');
      expect(result).toContain('data-tooltip="missing"');
      expect(result).toContain('aria-disabled="true"');
    });

    it('keeps footnote references and fragment links', () => {
      const footnote =
        '<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">[1]</a></sup>' +
        '<section class="footnotes" role="doc-endnotes"><ol class="footnotes-list">' +
        '<li id="fn-1" class="footnote-item"><p>note</p></li></ol></section>';

      const result = sanitizeRenderedHtml(footnote);

      expect(result).toContain('class="footnote-ref"');
      expect(result).toContain('href="#fn-1"');
      expect(result).toContain('id="fn-1"');
      expect(result).toContain('role="doc-endnotes"');
    });

    it('keeps figures with alignment styles and lazy images', () => {
      const figure =
        '<figure class="align-left" style="width: 200px"><img src="/img/a.png" alt="" loading="lazy"></figure>';

      const result = sanitizeRenderedHtml(figure);

      expect(result).toContain('class="align-left"');
      expect(result).toContain('style="width:200px"');
      expect(result).toContain('loading="lazy"');
      expect(result).toContain('src="/img/a.png"');
    });

    it('keeps task-list checkboxes', () => {
      const task = '<li><input type="checkbox" checked disabled> done</li>';

      const result = sanitizeRenderedHtml(task);

      expect(result).toContain('type="checkbox"');
      expect(result).toContain('checked');
      expect(result).toContain('disabled');
    });

    it('keeps KaTeX HTML and MathML output', () => {
      const katex =
        '<span class="katex"><span class="katex-mathml">' +
        '<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow>' +
        '<annotation encoding="application/x-tex">x</annotation></semantics></math></span>' +
        '<span class="katex-html" aria-hidden="true"><span class="base"><span class="mord mathnormal">x</span></span></span></span>';

      const result = sanitizeRenderedHtml(katex);

      expect(result).toContain('class="katex"');
      expect(result).toContain('<math');
      expect(result).toContain('<annotation encoding="application/x-tex">');
      expect(result).toContain('<mi>x</mi>');
      expect(result).toContain('class="katex-html"');
    });

    it('keeps block-anchor id attributes', () => {
      const result = sanitizeRenderedHtml('<p id="^my-block">anchored</p>');

      expect(result).toContain('id="^my-block"');
    });

    it('keeps inline SVG tags in official case and lower-cases attributes', () => {
      const result = sanitizeRenderedHtml(
        '<svg viewBox="0 0 10 10"><linearGradient id="g"></linearGradient></svg>'
      );

      expect(result).toContain('<svg viewbox="0 0 10 10">');
      expect(result).toContain('<linearGradient id="g">');
    });

    it('restores official SVG tag case from upper-case author HTML', () => {
      const result = sanitizeRenderedHtml(
        '<SVG><LINEARGRADIENT GradientUnits="u"></LINEARGRADIENT></SVG>'
      );

      expect(result).toContain('<linearGradient gradientunits="u">');
    });
  });

  describe('handles author HTML written in upper or mixed case', () => {
    it('keeps an upper-case div', () => {
      const result = sanitizeRenderedHtml('<DIV class="a">t</DIV>');

      expect(result).toBe('<div class="a">t</div>');
    });

    it('keeps a mixed-case details with its open attribute', () => {
      const result = sanitizeRenderedHtml('<Details open><summary>s</summary>b</Details>');

      expect(result).toBe('<details open><summary>s</summary>b</details>');
    });

    it('keeps an upper-case img with its src', () => {
      const result = sanitizeRenderedHtml('<IMG SRC="https://x.example/y.png">');

      expect(result).toBe('<img src="https://x.example/y.png" />');
    });

    it('drops an upper-case script and its content', () => {
      const result = sanitizeRenderedHtml('<SCRIPT>alert(1)</SCRIPT>');

      expect(result.toLowerCase()).not.toContain('script');
      expect(result).not.toContain('alert(1)');
    });

    it('strips an upper-case event handler', () => {
      const result = sanitizeRenderedHtml('<IMG SRC=x ONERROR=alert(1)>');

      expect(result.toLowerCase()).not.toContain('onerror');
      expect(result).not.toContain('alert(1)');
    });
  });
});
