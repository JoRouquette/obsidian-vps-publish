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
 * FENCED CODE BLOCKS:
 * - Opening: ``` followed by language identifier on same line
 * - Content: anything between opening and closing
 * - Closing: ``` on its own line (may have trailing whitespace)
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
  DataviewJsBlock,
  DataviewQueryBlock,
  DataviewQueryType,
} from '@core-domain/dataview/dataview-block';

/**
 * Parser state machine states.
 */
type ParserState = 'OUTSIDE' | 'INSIDE_DATAVIEW';

/**
 * Temporary state during parsing.
 */
interface ParsingContext {
  state: ParserState;
  langRaw: string;
  kind: DataviewBlockKind | null;
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
        ctx.contentLines = [];
        ctx.startLine = lineNum + 1; // 1-based
        ctx.startIndex = lineStartIndex;
      }
    } else if (ctx.state === 'INSIDE_DATAVIEW') {
      if (isClosingFence(line)) {
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
 * @returns Match result with langRaw and kind, or null if not a Dataview fence
 */
function matchOpeningFence(line: string): { langRaw: string; kind: DataviewBlockKind } | null {
  const trimmed = line.trim();

  // Must start with ```
  if (!trimmed.startsWith('```')) {
    return null;
  }

  // Extract language identifier (everything after ```)
  const langRaw = trimmed.substring(3).trim();

  if (!langRaw) {
    return null;
  }

  const langLower = langRaw.toLowerCase();

  // CRITICAL: Check for "dataviewjs" BEFORE "dataview" to avoid false matches
  if (langLower === 'dataviewjs') {
    return { langRaw, kind: 'js' };
  }

  if (langLower === 'dataview') {
    return { langRaw, kind: 'query' };
  }

  return null;
}

/**
 * Check if line is a closing fence.
 *
 * @param line - Line to check
 * @returns True if line is ``` (possibly with trailing whitespace)
 */
function isClosingFence(line: string): boolean {
  return line.trim() === '```';
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
    } as DataviewQueryBlock;
  } else {
    return {
      ...base,
      kind: 'js',
    } as DataviewJsBlock;
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
