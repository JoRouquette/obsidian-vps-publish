/**
 * Dataview Block Parser
 *
 * Robust line-by-line state machine for parsing Markdown fenced code blocks.
 *
 * WHY STATE MACHINE vs REGEX:
 * - Handles multiline blocks correctly
 * - No catastrophic backtracking
 * - Precise line/character tracking for debugging
 * - Easy to extend with additional features
 *
 * FENCED CODE BLOCKS (CommonMark, as rendered by Obsidian):
 * - Opening: 3+ backticks or 3+ tildes followed by language identifier on same line
 * - Content: anything between opening and closing
 * - Closing: a fence of the SAME character, at least as long as the opening one,
 *   alone on its line (surrounding whitespace allowed). A 3-backtick block closed by
 *   4 backticks is valid and must be detected, otherwise it is uploaded raw.
 *
 * DATAVIEW vs DATAVIEWJS:
 * - `dataview` (case-insensitive): DQL query language (LIST, TABLE, TASK, CALENDAR)
 * - `dataviewjs` (case-insensitive): JavaScript execution context
 * - Detection is EXACT: "dataviewjs" is NOT "dataview"
 *
 * ENCODING for HTML SAFETY:
 * - Raw content is base64-encoded before embedding in data attributes
 * - Prevents HTML injection, preserves whitespace, handles special characters
 */

import type {
  DataviewBlock,
  DataviewBlockKind,
  DataviewQueryType,
} from '@core-domain/dataview/dataview-block';

/**
 * Parser state machine states.
 */
type ParserState = 'OUTSIDE' | 'INSIDE_DATAVIEW';

/**
 * Opening fence of the block being parsed.
 */
interface Fence {
  char: '`' | '~';
  length: number;
}

/**
 * Opening line of a Dataview block.
 */
interface OpeningFenceMatch {
  langRaw: string;
  kind: DataviewBlockKind;
  fence: Fence;
}

/**
 * Temporary state during parsing.
 */
interface ParsingContext {
  state: ParserState;
  langRaw: string;
  kind: DataviewBlockKind | null;
  fence: Fence | null;
  contentLines: string[];
  startLine: number;
  startIndex: number;
  currentIndex: number;
}

/**
 * Parse all Dataview blocks from markdown content.
 *
 * @param content - Markdown source
 * @returns Array of detected Dataview blocks (empty if none found)
 */
export function parseDataviewBlocks(content: string): DataviewBlock[] {
  const blocks: DataviewBlock[] = [];
  const lines = content.split('\n');

  const ctx: ParsingContext = {
    state: 'OUTSIDE',
    langRaw: '',
    kind: null,
    fence: null,
    contentLines: [],
    startLine: 0,
    startIndex: 0,
    currentIndex: 0,
  };

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineStartIndex = ctx.currentIndex;

    if (ctx.state === 'OUTSIDE') {
      const opening = matchOpeningFence(line);
      if (opening) {
        ctx.state = 'INSIDE_DATAVIEW';
        ctx.langRaw = opening.langRaw;
        ctx.kind = opening.kind;
        ctx.fence = opening.fence;
        ctx.contentLines = [];
        ctx.startLine = lineNum + 1; // 1-based
        ctx.startIndex = lineStartIndex;
      }
    } else if (ctx.state === 'INSIDE_DATAVIEW') {
      if (isClosingFence(line, ctx.fence!)) {
        // Close block
        const endLine = lineNum + 1; // 1-based
        const endIndex = lineStartIndex + line.length;
        const contentRaw = ctx.contentLines.join('\n');

        const block = createBlock(
          ctx.kind!,
          ctx.langRaw,
          contentRaw,
          ctx.startLine,
          endLine,
          ctx.startIndex,
          endIndex
        );

        blocks.push(block);

        // Reset state
        ctx.state = 'OUTSIDE';
        ctx.kind = null;
        ctx.fence = null;
        ctx.contentLines = [];
      } else {
        ctx.contentLines.push(line);
      }
    }

    ctx.currentIndex = lineStartIndex + line.length + 1; // +1 for \n
  }

  return blocks;
}

/**
 * Match opening fence and detect Dataview block kind.
 *
 * @param line - Line to check
 * @returns langRaw, kind and opening fence, or null if not a Dataview fence
 */
function matchOpeningFence(line: string): OpeningFenceMatch | null {
  const trimmed = line.trim();

  // 3+ backticks or 3+ tildes, then the language identifier
  const match = /^(`{3,}|~{3,})(.*)$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const fenceRaw = match[1];
  const langRaw = match[2].trim();

  if (!langRaw) {
    return null;
  }

  const langLower = langRaw.toLowerCase();

  let kind: DataviewBlockKind;
  if (langLower === 'dataviewjs') {
    kind = 'js';
  } else if (langLower === 'dataview') {
    kind = 'query';
  } else {
    return null;
  }

  return {
    langRaw,
    kind,
    fence: { char: fenceRaw[0] === '~' ? '~' : '`', length: fenceRaw.length },
  };
}

/**
 * Check if line closes the current block.
 *
 * @param line - Line to check
 * @param opening - Fence that opened the block
 * @returns True if the line is only a fence of the same character, at least as long
 *          as the opening one (surrounding whitespace allowed)
 */
function isClosingFence(line: string, opening: Fence): boolean {
  const trimmed = line.trim();

  if (trimmed.length < opening.length) {
    return false;
  }

  for (const char of trimmed) {
    if (char !== opening.char) {
      return false;
    }
  }

  return true;
}

/**
 * Create a DataviewBlock from parsed data.
 */
function createBlock(
  kind: DataviewBlockKind,
  langRaw: string,
  contentRaw: string,
  startLine: number,
  endLine: number,
  startIndex: number,
  endIndex: number
): DataviewBlock {
  const base = {
    langRaw,
    contentRaw,
    startLine,
    endLine,
    startIndex,
    endIndex,
  };

  if (kind === 'query') {
    return {
      ...base,
      kind: 'query',
      queryType: detectQueryType(contentRaw),
    };
  } else {
    return {
      ...base,
      kind: 'js',
    };
  }
}

/**
 * Detect query type from content.
 *
 * Looks at first significant (non-empty, non-whitespace) line.
 *
 * @param content - Query content
 * @returns Detected query type
 */
function detectQueryType(content: string): DataviewQueryType {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) {
      continue; // Skip empty lines and comments
    }

    const firstWord = trimmed.split(/\s+/)[0].toUpperCase();

    switch (firstWord) {
      case 'LIST':
        return 'list';
      case 'TABLE':
        return 'table';
      case 'TASK':
        return 'task';
      case 'CALENDAR':
        return 'calendar';
      default:
        return 'unknown';
    }
  }

  return 'unknown';
}
