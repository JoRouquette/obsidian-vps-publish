import type { KatexOptions } from 'katex';
import katex from 'katex';
import type MarkdownIt from 'markdown-it';

type InlineState = MarkdownIt.StateInline;
type BlockState = MarkdownIt.StateBlock;

function isValidDollarDelimiter(
  state: InlineState,
  pos: number
): {
  canOpen: boolean;
  canClose: boolean;
} {
  const prevChar = readCodePoint(state.src, pos - 1);
  const nextChar = pos + 1 <= state.posMax ? readCodePoint(state.src, pos + 1) : -1;

  let canOpen = true;
  let canClose = true;

  if (prevChar === 0x20 || prevChar === 0x09 || (nextChar >= 0x30 && nextChar <= 0x39)) {
    canClose = false;
  }

  if (nextChar === 0x20 || nextChar === 0x09) {
    canOpen = false;
  }

  return { canOpen, canClose };
}

function readCodePoint(value: string, index: number): number {
  if (index < 0) {
    return -1;
  }

  return value.codePointAt(index) ?? -1;
}

function appendPendingDollar(
  state: InlineState,
  silent: boolean,
  pending: string,
  nextPos: number
) {
  if (!silent) {
    state.pending += pending;
  }

  state.pos = nextPos;
  return true;
}

function findClosingInlineDollar(state: InlineState, start: number): number {
  let match = start;

  while ((match = state.src.indexOf('$', match)) !== -1) {
    let backslashPos = match - 1;
    while (state.src[backslashPos] === '\\') {
      backslashPos -= 1;
    }

    // Odd number of backslashes means the delimiter is not escaped.
    if ((match - backslashPos) % 2 === 1) {
      return match;
    }

    match += 1;
  }

  return -1;
}

function hasTrimmedContent(value: string): boolean {
  return value.trim().length > 0;
}

function mathInline(state: InlineState, silent: boolean): boolean {
  if (state.src[state.pos] !== '$') {
    return false;
  }

  const delimiter = isValidDollarDelimiter(state, state.pos);
  if (!delimiter.canOpen) {
    return appendPendingDollar(state, silent, '$', state.pos + 1);
  }

  const start = state.pos + 1;
  const match = findClosingInlineDollar(state, start);

  if (match === -1) {
    return appendPendingDollar(state, silent, '$', start);
  }

  if (match - start === 0) {
    return appendPendingDollar(state, silent, '$$', start + 1);
  }

  const closingDelimiter = isValidDollarDelimiter(state, match);
  if (!closingDelimiter.canClose) {
    return appendPendingDollar(state, silent, '$', start);
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
}

function mathBlock(state: BlockState, start: number, end: number, silent: boolean): boolean {
  let pos = state.bMarks[start] + state.tShift[start];
  let max = state.eMarks[start];

  if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') {
    return false;
  }

  pos += 2;
  let firstLine = state.src.slice(pos, max);
  let lastLine = '';
  let next = start;
  let found = false;

  if (silent) {
    return true;
  }

  const firstLineTrimmed = firstLine.trim();
  if (firstLineTrimmed.endsWith('$$')) {
    firstLine = firstLineTrimmed.slice(0, -2);
    found = true;
  }

  while (!found) {
    next += 1;

    if (next >= end) {
      break;
    }

    pos = state.bMarks[next] + state.tShift[next];
    max = state.eMarks[next];

    if (pos < max && state.tShift[next] < state.blkIndent) {
      break;
    }

    if (state.src.slice(pos, max).trim().endsWith('$$')) {
      const lastDelimiter = state.src.slice(0, max).lastIndexOf('$$');
      lastLine = state.src.slice(pos, lastDelimiter);
      found = true;
    }
  }

  state.line = next + 1;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  const firstLineContent = hasTrimmedContent(firstLine) ? `${firstLine}\n` : '';
  const lastLineContent = hasTrimmedContent(lastLine) ? lastLine : '';
  token.content =
    firstLineContent + state.getLines(start + 1, next, state.tShift[start], true) + lastLineContent;
  token.map = [start, state.line];
  token.markup = '$$';

  return true;
}

function renderMath(content: string, displayMode: boolean, options: KatexOptions): string {
  return (
    katex.renderToString(content, {
      throwOnError: false,
      trust: false,
      output: 'htmlAndMathml',
      ...options,
      displayMode,
    }) + (displayMode ? '\n' : '')
  );
}

export function registerKatexRenderer(md: MarkdownIt, options: KatexOptions = {}): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  md.block.ruler.after('blockquote', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });

  md.renderer.rules['math_inline'] = (tokens, idx) =>
    renderMath(tokens[idx].content, false, options);

  md.renderer.rules['math_block'] = (tokens, idx) => renderMath(tokens[idx].content, true, options);
}
