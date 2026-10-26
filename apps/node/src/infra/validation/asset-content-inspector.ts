import { TextDecoder } from 'node:util';

/**
 * Content checks for assets whose type is text-based (SVG, JSON, plain text, markdown).
 *
 * This is defence in depth, not the protection itself: what actually keeps an uploaded SVG
 * inert is the `sandbox` Content-Security-Policy applied to `/assets` responses
 * (`ASSET_SANDBOX_CSP`). The patterns below catch the usual active-content vectors early and
 * give the author a clear refusal, but a pattern list cannot be exhaustive for a format
 * browsers parse this leniently.
 */

// An optional namespace prefix (`<svg:script>`) does not stop a browser from running the element.
const NAMESPACE_PREFIX = String.raw`(?:[\w.-]+:)?`;
const SCRIPT_ELEMENT = new RegExp(String.raw`<\s*${NAMESPACE_PREFIX}script`, 'i');
const FOREIGN_OBJECT_ELEMENT = new RegExp(String.raw`<\s*${NAMESPACE_PREFIX}foreignObject`, 'i');
// Sticky: only ever matched at a known position, so no scan can restart from every offset.
const SVG_ROOT_ELEMENT = new RegExp(String.raw`<${NAMESPACE_PREFIX}svg(?=[\s/>])`, 'iy');
const LEADING_WHITESPACE = /\s*/y;
// A DTD can declare entities that expand into any of the markup refused below.
const DOCTYPE_OR_ENTITY_DECLARATION = /<!\s*(?:DOCTYPE|ENTITY)/i;
// Opening of any element, read at a '<'. The name is the part after an optional prefix.
const ELEMENT_START = new RegExp(String.raw`<\s*${NAMESPACE_PREFIX}([A-Za-z][\w-]*)`, 'y');
// SMIL elements able to rewrite an attribute (lower case, compared after lower-casing the name).
const SMIL_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  'set',
  'animate',
  'animatetransform',
  'animatemotion',
]);
// A SMIL tag longer than this is refused rather than scanned: no real animation comes close, and
// the bound keeps the scan linear on a file made of unterminated tags.
const MAX_SMIL_TAG_LENGTH = 4096;
const HREF_ANIMATION_TARGET = /attributeName\s*=\s*["']?\s*(?:xlink:)?href\b/i;
// An `on…=` attribute; `/` and quotes can stand in for the whitespace before it. Not anchored to
// a tag on purpose: a '>' inside an attribute value would otherwise hide what follows it.
const EVENT_HANDLER_ATTRIBUTE = /[\s/"']on[a-z]+\s*=/i;
const HREF_ATTRIBUTE = /(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const NUMERIC_ENTITY = /&#(?:x([0-9a-f]+)|(\d+));?/gi;
const NAMED_ENTITY = /&(Tab|NewLine|colon);/g;
const NAMED_ENTITY_VALUES: Readonly<Record<string, string>> = {
  Tab: '\t',
  NewLine: '\n',
  colon: ':',
};
const LAST_IGNORED_URL_CHAR_CODE = 0x20;

/**
 * Content checks for assets of a text-based type. Returns the reason the content is
 * refused, or undefined when it is acceptable (binary types are always undefined).
 */
export function findUnsafeContent(mimeType: string, content: Uint8Array): string | undefined {
  switch (mimeType) {
    case 'image/svg+xml':
      // A NUL byte betrays UTF-16, which browsers parse but the checks below cannot read.
      return content.indexOf(0) === -1
        ? findActiveSvgContent(decodeUtf8(content))
        : 'SVG is not UTF-8 text';
    case 'application/json':
      return isValidJson(decodeUtf8(content)) ? undefined : 'invalid JSON';
    case 'text/plain':
    case 'text/markdown':
      return content.indexOf(0) === -1 ? undefined : 'binary content (NUL byte) in a text file';
    default:
      return undefined;
  }
}

/**
 * True when the first element of the document is `<svg>` (or `<prefix:svg>`). The XML
 * declaration, processing instructions, comments and whitespace before it are skipped, so an
 * `<svg>` nested in another root or hidden in a comment does not count.
 */
export function hasSvgRootElement(content: Uint8Array): boolean {
  if (content.indexOf(0) !== -1) {
    return false;
  }
  const text = decodeUtf8(content);
  const rootStart = skipProlog(text);
  if (rootStart === undefined) {
    return false;
  }
  SVG_ROOT_ELEMENT.lastIndex = rootStart;
  return SVG_ROOT_ELEMENT.test(text);
}

/** Position of the first element, or undefined when a prolog item is left unterminated. */
function skipProlog(text: string): number | undefined {
  let position = 0;
  for (;;) {
    LEADING_WHITESPACE.lastIndex = position;
    LEADING_WHITESPACE.test(text);
    position = LEADING_WHITESPACE.lastIndex;

    const terminator = text.startsWith('<?', position)
      ? '?>'
      : text.startsWith('<!--', position)
        ? '-->'
        : undefined;
    if (terminator === undefined) {
      return position;
    }
    const end = text.indexOf(terminator, position + 2);
    if (end === -1) {
      return undefined;
    }
    position = end + terminator.length;
  }
}

function findActiveSvgContent(svg: string): string | undefined {
  if (DOCTYPE_OR_ENTITY_DECLARATION.test(svg)) {
    return 'SVG contains a DOCTYPE or ENTITY declaration';
  }
  if (SCRIPT_ELEMENT.test(svg)) {
    return 'SVG contains a script element';
  }
  if (FOREIGN_OBJECT_ELEMENT.test(svg)) {
    return 'SVG contains a foreignObject element';
  }
  if (EVENT_HANDLER_ATTRIBUTE.test(svg)) {
    return 'SVG contains an event handler attribute';
  }
  if (hasJavascriptHref(svg)) {
    return 'SVG contains a javascript: link';
  }
  return findUnsafeAnimation(svg);
}

function hasJavascriptHref(svg: string): boolean {
  for (const match of svg.matchAll(HREF_ATTRIBUTE)) {
    const value = decodeCharacterReferences(match[1] ?? match[2] ?? match[3] ?? '');
    if (withoutIgnoredUrlCharacters(value).toLowerCase().startsWith('javascript:')) {
      return true;
    }
  }
  return false;
}

// `<set attributeName="href" to="javascript:…">` writes the link after the static href check.
// Linear scan: each '<' is read once and a SMIL tag is consumed up to its closing '>' (quotes
// respected, so a '>' inside a value does not end it). An unterminated or oversized SMIL tag is
// refused on the spot, which is also what stops a crafted file from forcing repeated scans.
function findUnsafeAnimation(svg: string): string | undefined {
  let position = svg.indexOf('<');
  while (position !== -1) {
    ELEMENT_START.lastIndex = position;
    const start = ELEMENT_START.exec(svg);
    let next = position + 1;
    if (start !== null && SMIL_ELEMENT_NAMES.has(start[1].toLowerCase())) {
      const end = findTagEnd(svg, ELEMENT_START.lastIndex);
      if (end === undefined) {
        return 'SVG contains an unterminated or oversized animation tag';
      }
      if (HREF_ANIMATION_TARGET.test(decodeCharacterReferences(svg.slice(position, end)))) {
        return 'SVG animates a link target';
      }
      next = end;
    }
    position = svg.indexOf('<', next);
  }
  return undefined;
}

/** Index of the '>' closing the tag, or undefined when none is found within the length bound. */
function findTagEnd(svg: string, from: number): number | undefined {
  const limit = Math.min(svg.length, from + MAX_SMIL_TAG_LENGTH);
  let quote: string | undefined;
  for (let index = from; index < limit; index++) {
    const char = svg[index];
    if (quote !== undefined) {
      quote = char === quote ? undefined : quote;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      return index;
    }
  }
  return undefined;
}

// Browsers drop tabs, newlines and other C0 controls or spaces inside a URL scheme
// (`java\tscript:`).
function withoutIgnoredUrlCharacters(value: string): string {
  return Array.from(value)
    .filter((char) => (char.codePointAt(0) ?? 0) > LAST_IGNORED_URL_CHAR_CODE)
    .join('');
}

// Browsers decode character references in attribute values before resolving the URL
// (`&#106;avascript:`, `javascript&colon;`), so the scheme is checked on the decoded value.
function decodeCharacterReferences(value: string): string {
  return value
    .replace(NUMERIC_ENTITY, (_, hex: string | undefined, decimal: string | undefined) => {
      const codePoint = hex !== undefined ? parseInt(hex, 16) : parseInt(decimal ?? '', 10);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : '';
    })
    .replace(NAMED_ENTITY, (_, name: string) => NAMED_ENTITY_VALUES[name]);
}

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text.replace(/^﻿/, ''));
    return true;
  } catch {
    return false;
  }
}

function decodeUtf8(content: Uint8Array): string {
  return new TextDecoder('utf-8').decode(content);
}
