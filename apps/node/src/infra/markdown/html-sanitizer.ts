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
 * - The `style` attribute is parsed and filtered: only the properties listed in
 *   `ALLOWED_STYLES` survive, each with a value pattern that has no room for
 *   `url(`, `expression(` or any other function but the colour ones. That keeps
 *   out layout takeovers (`position`, `z-index`, `inset`, `display`), remote
 *   fetches (`background:url(...)`) and legacy script hooks (`behavior`).
 *   The allowlist covers what the renderers emit (callout colour, figure and
 *   image sizing, centring, table alignment, KaTeX offsets and rules) and the
 *   presentational properties that author HTML and Dataview output use (colours,
 *   padding, font style).
 * - Lengths never use viewport units. Negative values are accepted only in `em`
 *   (two integer digits at most) and only where KaTeX needs them: `top`, `bottom`,
 *   `left`, `vertical-align` and the margins.
 * - Lengths are capped (three integer digits, four for `px` and `%`): `width:9999em` is refused.
 * - `position: relative` is emitted by KaTeX on large operators (`∑`, `∫`) next to
 *   a sub-0.01em `top`. It is dropped on purpose; the visual loss is negligible.
 *
 * Known limit: protection against interface overlays is PARTIAL. The `class` attribute is free
 * and the site and KaTeX stylesheets are loaded in the page, so an allowed `width`, `height`,
 * `top` or `left` can combine with a stylesheet rule that positions the element (for example
 * `.katex .rlap > .inner { position: absolute }`). The caps above bound the size and offsets
 * of such a box, they do not remove the risk. Dropping `position: relative` from KaTeX output
 * is one of the visible costs of this choice. `background-color` stays allowed because KaTeX
 * emits it for `\colorbox`.
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
// execution/embedding vector. `desc` is excluded too: it is an HTML integration
// point (nested HTML is parsed as HTML there) and nothing the renderers emit needs it.
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

// No viewport units (`vw`/`vh` would let author HTML cover the whole interface) and no negative
// length by default. Integer parts are capped (three digits, four for `px` and `%`) so a size
// cannot be stretched over the whole page (`width:9999em`); KaTeX never gets near these bounds.
const CSS_NUMBER_3 = String.raw`(?:\d{1,3}(?:\.\d+)?|\.\d+)`;
const CSS_NUMBER_4 = String.raw`(?:\d{1,4}(?:\.\d+)?|\.\d+)`;
const CSS_LENGTH = `(?:${CSS_NUMBER_4}(?:px|%)|${CSS_NUMBER_3}(?:em|rem|ex|ch|pt|cm|mm|in)?)`;
// KaTeX positions exponents, subscripts and accents with negative offsets, always in em. The
// bound (two integer digits) keeps an offset from throwing content far off its container.
const CSS_NEGATIVE_EM = String.raw`-(?:\d{1,2}(?:\.\d+)?|\.\d+)em`;
const CSS_SIGNED_LENGTH = `(?:${CSS_LENGTH}|${CSS_NEGATIVE_EM})`;
const CSS_LENGTH_OR_AUTO = `(?:${CSS_SIGNED_LENGTH}|auto)`;
const CSS_HEX_COLOR = String.raw`#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})`;
// Colour functions take digits, units, separators and `none`/`deg`-style words, never a nested call.
// The first character after `(` cannot be a space, so the leading `\s*` and the class that follows
// never compete for the same characters (no backtracking blow-up on a long unterminated value).
const CSS_COLOR_FUNCTION = String.raw`(?:rgb|rgba|hsl|hsla)\(\s*[0-9a-z.%,/+-][0-9a-z.%\s,/+-]*\)`;
const CSS_NAMED_COLOR = '[a-z]{3,30}';
const CSS_COLOR = `(?:${CSS_HEX_COLOR}|${CSS_COLOR_FUNCTION}|${CSS_NAMED_COLOR})`;

const COLOR_VALUE: RegExp[] = [new RegExp(`^${CSS_COLOR}$`, 'i')];
// KaTeX draws the frame of `\fcolorbox` as `border:0.04em solid red`: width, style, colour, in
// that order and nothing else.
const BORDER_VALUE: RegExp[] = [
  new RegExp(`^${CSS_LENGTH}\\s+(?:solid|dashed)\\s+${CSS_COLOR}$`, 'i'),
];
const LENGTH_BOX_VALUE: RegExp[] = [
  new RegExp(`^${CSS_LENGTH_OR_AUTO}(?:\\s+${CSS_LENGTH_OR_AUTO}){0,3}$`, 'i'),
];
// Padding never takes a negative value, unlike the margins.
const PADDING_VALUE: RegExp[] = [new RegExp(`^${CSS_LENGTH}(?:\\s+${CSS_LENGTH}){0,3}$`, 'i')];
const SIZE_VALUE: RegExp[] = [
  new RegExp(`^(?:${CSS_LENGTH}|auto|none|fit-content|min-content|max-content)$`, 'i'),
];
const LENGTH_VALUE: RegExp[] = [new RegExp(`^${CSS_LENGTH}$`, 'i')];
const SIGNED_LENGTH_VALUE: RegExp[] = [new RegExp(`^${CSS_SIGNED_LENGTH}$`, 'i')];
const SOLID_BORDER_STYLE: RegExp[] = [/^solid$/i];
// KaTeX draws `\hdashline` and `c:c` array separators with `dashed`.
const SOLID_OR_DASHED_BORDER_STYLE: RegExp[] = [/^(?:solid|dashed)$/i];

/**
 * Inline style properties that survive sanitization, with the values they accept.
 * Anything absent is dropped, so `position`, `z-index`, `inset`, `display`,
 * `background`, `behavior` and friends never reach the output.
 */
const ALLOWED_STYLES: NonNullable<sanitizeHtml.IOptions['allowedStyles']> = {
  '*': {
    // Emitted by the callout renderer; also accepts a reference to another custom property.
    '--callout-color': [...COLOR_VALUE, /^var\(\s*--[a-z0-9-]+\s*\)$/i],
    width: SIZE_VALUE,
    'max-width': SIZE_VALUE,
    height: SIZE_VALUE,
    'max-height': SIZE_VALUE,
    margin: LENGTH_BOX_VALUE,
    'margin-top': LENGTH_BOX_VALUE,
    'margin-right': LENGTH_BOX_VALUE,
    'margin-bottom': LENGTH_BOX_VALUE,
    'margin-left': LENGTH_BOX_VALUE,
    'margin-inline': LENGTH_BOX_VALUE,
    padding: PADDING_VALUE,
    'padding-top': PADDING_VALUE,
    'padding-right': PADDING_VALUE,
    'padding-bottom': PADDING_VALUE,
    'padding-left': PADDING_VALUE,
    // Offsets and boxes emitted by KaTeX for scripts, fractions, roots, accents, rules and
    // arrays. Without `position` they do nothing on a plain element, so they only matter next
    // to the KaTeX stylesheet's own positioned classes.
    top: SIGNED_LENGTH_VALUE,
    bottom: SIGNED_LENGTH_VALUE,
    left: SIGNED_LENGTH_VALUE,
    'vertical-align': SIGNED_LENGTH_VALUE,
    'min-width': LENGTH_VALUE,
    'border-width': LENGTH_VALUE,
    'border-top-width': LENGTH_VALUE,
    'border-right-width': LENGTH_VALUE,
    'border-bottom-width': LENGTH_VALUE,
    border: BORDER_VALUE,
    'border-color': COLOR_VALUE,
    'border-style': SOLID_BORDER_STYLE,
    'border-top-style': SOLID_OR_DASHED_BORDER_STYLE,
    'border-right-style': SOLID_OR_DASHED_BORDER_STYLE,
    'border-bottom-style': SOLID_OR_DASHED_BORDER_STYLE,
    'text-align': [/^(?:left|right|center|justify|start|end)$/i],
    float: [/^(?:left|right|none)$/i],
    clear: [/^(?:left|right|both|none)$/i],
    color: COLOR_VALUE,
    'background-color': COLOR_VALUE,
    'font-style': [/^(?:normal|italic|oblique)$/i],
    'font-weight': [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i],
    'text-decoration': [/^(?:none|underline|overline|line-through)$/i],
  },
};

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
    mspace: ['width', 'height', 'depth', 'linebreak', 'mathbackground'],
    mpadded: ['width', 'height', 'depth', 'lspace', 'voffset', 'mathbackground'],
    mfrac: ['linethickness', 'numalign', 'denomalign'],
    menclose: ['notation'],
    mtable: [
      'columnalign',
      'rowalign',
      'displaystyle',
      'rowspacing',
      'columnspacing',
      'columnlines',
      'rowlines',
    ],
    mover: ['accent'],
    munder: ['accentunder'],
    munderover: ['accent', 'accentunder'],
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
  // Parse `style` and keep only the declarations allowed by `ALLOWED_STYLES`.
  parseStyleAttributes: true,
  allowedStyles: ALLOWED_STYLES,
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
