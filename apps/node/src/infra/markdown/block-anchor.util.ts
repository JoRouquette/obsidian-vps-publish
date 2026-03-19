import { load } from 'cheerio';
import type { AnyNode, Comment, Element } from 'domhandler';

const BLOCK_ID_LINE_PATTERN = /^\^([A-Za-z0-9][A-Za-z0-9_-]*)$/;
const FENCED_CODE_PATTERN = /^ {0,3}(`{3,}|~{3,})/;
const INDENTED_CODE_PATTERN = /^(?: {4,}|\t+)/;

interface FenceState {
  char: '`' | '~';
  length: number;
}

function extractStandaloneBlockId(
  line: string,
  inFencedCode: boolean,
  isIndentedCode: boolean
): string | undefined {
  if (inFencedCode || isIndentedCode) {
    return undefined;
  }

  const trimmed = line.trim();
  const match = trimmed.match(BLOCK_ID_LINE_PATTERN);

  if (!match || match[1] === 'no-publishing') {
    return undefined;
  }

  return match[1];
}

function isStructuredBlockLine(line: string): boolean {
  return /^(?: {0,3}(?:[#>|-]|\d+\.|\|)|\s*\[!)/.test(line.trimStart());
}

function extractInlineBlockId(
  line: string,
  inFencedCode: boolean,
  isIndentedCode: boolean
): string | undefined {
  if (inFencedCode || isIndentedCode || isStructuredBlockLine(line)) {
    return undefined;
  }

  const match = line.match(/\s+\^([A-Za-z0-9][A-Za-z0-9_-]*)\s*$/);
  if (!match || match[1] === 'no-publishing') {
    return undefined;
  }

  return match[1];
}

function renderBlockIdComment(blockIdCommentPrefix: string, blockId: string): string {
  return `<!--${blockIdCommentPrefix}${blockId}-->`;
}

function isElementNode(node: AnyNode): node is Element {
  return node.type === 'tag';
}

function isCommentNode(node: AnyNode): node is Comment {
  return node.type === 'comment';
}

function findPreviousElementSibling(node: AnyNode): Element | undefined {
  let current = node.prev;

  while (current) {
    if (isElementNode(current)) {
      return current;
    }

    if (current.type === 'text' && current.data?.trim()) {
      return undefined;
    }

    current = current.prev;
  }

  return undefined;
}

export function prepareBlockAnchors(content: string, blockIdCommentPrefix: string): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const output: string[] = [];
  let activeFence: FenceState | null = null;

  for (const line of lines) {
    const inFencedCode = activeFence !== null;
    const isIndentedCode = activeFence === null && INDENTED_CODE_PATTERN.test(line);
    const fenceMatch = line.match(FENCED_CODE_PATTERN);
    const standaloneBlockId = extractStandaloneBlockId(line, inFencedCode, isIndentedCode);

    if (standaloneBlockId) {
      output.push(renderBlockIdComment(blockIdCommentPrefix, standaloneBlockId));
    } else {
      const inlineBlockId = extractInlineBlockId(line, inFencedCode, isIndentedCode);

      if (inlineBlockId) {
        output.push(line.replace(/\s+\^[A-Za-z0-9][A-Za-z0-9_-]*\s*$/, ''));
        output.push(renderBlockIdComment(blockIdCommentPrefix, inlineBlockId));
      } else {
        output.push(line);
      }
    }

    if (!fenceMatch) {
      continue;
    }

    const fence = fenceMatch[1];
    const fenceChar = fence[0] as '`' | '~';

    if (!activeFence) {
      activeFence = {
        char: fenceChar,
        length: fence.length,
      };
    } else if (activeFence.char === fenceChar && fence.length >= activeFence.length) {
      activeFence = null;
    }
  }

  return output.join(eol);
}

export function attachBlockAnchors(html: string, blockIdCommentPrefix: string): string {
  const $ = load(html);
  const body = $('body');

  body.contents().each((_, rawNode) => {
    const node = rawNode as AnyNode;
    if (!isCommentNode(node) || !node.data?.startsWith(blockIdCommentPrefix)) {
      return;
    }

    const blockId = node.data.slice(blockIdCommentPrefix.length).trim();
    const previousElement = findPreviousElementSibling(node);

    if (previousElement && blockId && !previousElement.attribs?.['id']) {
      $(previousElement).attr('id', `^${blockId}`);
    }

    $(rawNode).remove();
  });

  return body.html() ?? $.html();
}
