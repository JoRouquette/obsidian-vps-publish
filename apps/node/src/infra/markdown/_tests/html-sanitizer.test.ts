import { sanitizeRenderedHtml } from '../html-sanitizer';

describe('sanitizeRenderedHtml', () => {
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

  describe('preserves the trusted markup emitted by the renderers', () => {
    it('keeps callout structure, custom color property and icon data attribute', () => {
      const callout =
        '<div class="callout" data-callout="note" style="--callout-color: #448aff">' +
        '<span class="callout-icon material-symbols-outlined" data-icon="pencil" aria-hidden="true">pencil</span>' +
        '<p>body</p></div>';

      const result = sanitizeRenderedHtml(callout);

      expect(result).toContain('class="callout"');
      expect(result).toContain('data-callout="note"');
      expect(result).toContain('--callout-color: #448aff');
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
      expect(result).toContain('style="width: 200px"');
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
