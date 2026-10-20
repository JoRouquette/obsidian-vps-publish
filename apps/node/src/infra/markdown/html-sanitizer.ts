import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes the HTML produced by the markdown pipeline before it is stored and
 * served to the site. The published content originates from author-written
 * Obsidian notes rendered with `html: true`, so raw HTML can reach the browser
 * and is injected via `[innerHTML]` after the Angular sanitizer is bypassed.
 * This pass is the single point that strips executable markup at the source.
 *
 * Design notes:
 * - The allowlist is a superset of everything the trusted renderers emit
 *   (callouts, wikilinks, leaflet placeholders, footnotes, KaTeX, tables,
 *   task lists, figures) so no feature regresses.
 * - The `style` attribute is kept without a CSS property allowlist on purpose:
 *   callouts rely on the `--callout-color` custom property and figures on inline
 *   layout styles. The security guarantee comes from removing dangerous tags,
 *   attributes (event handlers) and URL schemes, not from CSS filtering; CSS is
 *   not an execution vector in modern browsers for author-controlled content.
 */

// `annotation-xml`, `mglyph` and `maction` are deliberately absent: they are HTML
// integration points known for mutation XSS, and KaTeX (with `trust: false`) never
// emits them.
const MATHML_TAGS: string[] = [
  'math',
  'semantics',
  'annotation',
  'mrow',
  'mi',
  'mo',
  'mn',
  'ms',
  'mtext',
  'mspace',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mover',
  'munder',
  'munderover',
  'mtable',
  'mtr',
  'mtd',
  'mlabeledtr',
  'mpadded',
  'mphantom',
  'menclose',
  'mstyle',
  'merror',
  'mmultiscripts',
  'mprescripts',
  'none',
  'mfenced',
];

// Inline SVG icons are a supported feature (e.g. DataviewJS views). Drawing and
// gradient elements are allowed; `foreignObject`, `script` and animation
// (SMIL) elements are intentionally excluded to avoid reintroducing an
// execution/embedding vector.
const SVG_TAGS: string[] = [
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'defs',
  'use',
  'symbol',
  'marker',
  'title',
  'desc',
  'text',
  'tspan',
  'textPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
];

const SVG_ATTRIBUTES: string[] = [
  'viewbox',
  'xmlns',
  'xmlns:xlink',
  'preserveaspectratio',
  'fill',
  'fill-rule',
  'fill-opacity',
  'clip-rule',
  'clip-path',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-miterlimit',
  'd',
  'points',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'transform',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'offset',
  'stop-color',
  'stop-opacity',
  'opacity',
  'pathlength',
  'marker-start',
  'marker-mid',
  'marker-end',
  'text-anchor',
  'vector-effect',
  'patternunits',
  'patterncontentunits',
  'href',
  'xlink:href',
];

const ALLOWED_TAGS: string[] = [
  'p',
  'div',
  'span',
  'section',
  'article',
  'blockquote',
  'pre',
  'code',
  'hr',
  'br',
  'wbr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'sub',
  'sup',
  'small',
  'abbr',
  'kbd',
  'samp',
  'cite',
  'q',
  'time',
  'a',
  'img',
  'figure',
  'figcaption',
  'picture',
  'source',
  'table',
  'caption',
  'colgroup',
  'col',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'input',
  'details',
  'summary',
  ...MATHML_TAGS,
  ...SVG_TAGS,
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  disallowedTagsMode: 'discard',
  allowedAttributes: {
    '*': [
      'class',
      'id',
      'style',
      'title',
      'role',
      'tabindex',
      'dir',
      'lang',
      'aria-*',
      'data-*',
      ...SVG_ATTRIBUTES,
    ],
    a: ['href', 'name', 'target', 'rel', 'download'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes'],
    source: ['src', 'srcset', 'type', 'media', 'sizes'],
    col: ['span', 'width'],
    colgroup: ['span'],
    td: ['colspan', 'rowspan', 'headers', 'align'],
    th: ['colspan', 'rowspan', 'headers', 'scope', 'align'],
    input: ['type', 'checked', 'disabled'],
    // `open` is what makes a foldable callout render expanded: the callout
    // renderer emits it alongside `data-callout-fold` whenever the fold is not
    // `closed`. It is a boolean presentation-state attribute with no URL and no
    // handler, so allowing it adds no execution vector.
    details: ['open'],
    ol: ['start', 'type', 'reversed'],
    time: ['datetime'],
    math: ['xmlns', 'display', 'mode'],
    annotation: ['encoding'],
    mo: [
      'stretchy',
      'fence',
      'separator',
      'lspace',
      'rspace',
      'largeop',
      'movablelimits',
      'accent',
      'minsize',
      'maxsize',
      'symmetric',
    ],
    mi: ['mathvariant'],
    mn: ['mathvariant'],
    mtext: ['mathvariant'],
    mstyle: ['scriptlevel', 'displaystyle', 'mathvariant', 'mathcolor', 'mathbackground'],
    mspace: ['width', 'height', 'depth', 'linebreak'],
    mpadded: ['width', 'height', 'depth', 'lspace', 'voffset'],
    mfrac: ['linethickness', 'numalign', 'denomalign'],
    menclose: ['notation'],
    mtable: ['columnalign', 'rowalign', 'displaystyle', 'rowspacing', 'columnspacing'],
    mover: ['accent'],
    mtd: ['columnalign', 'rowalign', 'columnspan', 'rowspan'],
    mtr: ['columnalign', 'rowalign'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: true,
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  // Scheme-check the SVG `xlink:href` too (defaults only cover href/src/cite).
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite', 'xlink:href'],
  // Keep the `style` attribute values untouched (see design notes above).
  parseStyleAttributes: false,
  // markdown-it copies author HTML verbatim, so names are normalised here. htmlparser2
  // then emits SVG tags in their official case (`linearGradient`), hence the camelCase
  // `SVG_TAGS` and lower-case attribute lists above.
  parser: {
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  },
};

export function sanitizeRenderedHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
