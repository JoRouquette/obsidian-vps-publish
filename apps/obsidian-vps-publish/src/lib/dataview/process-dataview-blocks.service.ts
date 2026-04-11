/**
 * Dataview Blocks Processor Service.
 *
 * Orchestrates the plugin-side serialization pipeline:
 * 1. Parse Dataview / DataviewJS code blocks
 * 2. Execute them via the Dataview plugin API
 * 3. Convert the result to the transport format used by publication
 * 4. Replace the original blocks in note content
 *
 * Serialization contract:
 * - `dataview` queries → Markdown with canonical wikilinks / embeds
 * - `dataviewjs` scripts → captured HTML (kept intentionally for rich layouts)
 *
 * Asset/link discovery still happens later in the shared parsing pipeline so both
 * flows converge before upload without duplicating routing logic here.
 */

import { DataviewToMarkdownConverter } from '@core-application/dataview/dataview-to-markdown.converter';
import type { DataviewBlock } from '@core-domain/dataview/dataview-block';
import type { CancellationPort } from '@core-domain/ports/cancellation-port';

import { parseDataviewBlocks } from './dataview-block.parser';
import type { DataviewExecutor } from './dataview-executor';

export interface ProcessedDataviewBlock {
  /** Original parsed block */
  readonly block: DataviewBlock;

  /** Replacement payload inserted into note content (Markdown or preserved HTML) */
  readonly markdown: string;

  /** Whether processing succeeded */
  readonly success: boolean;

  /** Error message if success=false */
  readonly error?: string;
}

export interface ProcessDataviewBlocksResult {
  /** Modified content with blocks replaced by Markdown */
  readonly content: string;

  /** All processed blocks (for debugging/metadata) */
  readonly processedBlocks: ProcessedDataviewBlock[];
}

/**
 * Yield to event loop helper
 */
async function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Process all Dataview blocks in markdown content.
 *
 * @param content - Original markdown content
 * @param executor - Optional Dataview executor (if Dataview plugin available)
 * @param filePath - Path of the note being processed (for Dataview context)
 * @param cancellation - Optional cancellation token
 * @returns Result with modified content and processed blocks
 */
export async function processDataviewBlocks(
  content: string,
  executor?: DataviewExecutor,
  filePath?: string,
  cancellation?: CancellationPort
): Promise<ProcessDataviewBlocksResult> {
  // Check for cancellation before starting
  cancellation?.throwIfCancelled();

  // Optional logger can be passed in future if needed
  const converter = new DataviewToMarkdownConverter();

  // Step 1: Parse all blocks
  const blocks = parseDataviewBlocks(content);

  if (blocks.length === 0) {
    return {
      content,
      processedBlocks: [],
    };
  }

  // Step 2: Execute and convert each block to Markdown (with periodic yields)
  const processedBlocks: ProcessedDataviewBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    cancellation?.throwIfCancelled();

    const block = blocks[i];
    const processed = await processBlock(block, executor, filePath || '', converter);
    processedBlocks.push(processed);

    // Yield every 3 blocks to keep UI responsive (more aggressive than before)
    if ((i + 1) % 3 === 0) {
      await yieldToEventLoop();
    }
  }

  // Step 3: Replace blocks in content (reverse order to preserve indices)
  let modifiedContent = content;

  // Sort blocks by startIndex descending (replace from end to start)
  const sortedBlocks = [...processedBlocks].sort((a, b) => b.block.startIndex - a.block.startIndex);

  for (const processed of sortedBlocks) {
    const { block, markdown } = processed;
    const before = modifiedContent.substring(0, block.startIndex);
    const after = modifiedContent.substring(block.endIndex);
    modifiedContent = before + markdown + after;
  }

  return {
    content: modifiedContent,
    processedBlocks,
  };
}

/**
 * Process a single block (execute and convert to Markdown).
 *
 * @param block - Parsed block
 * @param executor - Optional Dataview executor
 * @param filePath - Path of the note being processed
 * @param converter - Markdown converter
 * @param logger - Optional logger
 * @returns Processed result with transport content
 */
async function processBlock(
  block: DataviewBlock,
  executor: DataviewExecutor | undefined,
  filePath: string,
  converter: DataviewToMarkdownConverter
): Promise<ProcessedDataviewBlock> {
  // If no executor available, return error callout in Markdown
  if (!executor) {
    const errorMarkdown = `> [!warning] Dataview Plugin Required
> This ${block.kind === 'query' ? 'Dataview query' : 'DataviewJS script'} could not be rendered because the Dataview plugin is not enabled.
> Please install and enable the Dataview plugin in Obsidian.`;

    return {
      block,
      markdown: errorMarkdown,
      success: false,
      error: 'Dataview plugin not available',
    };
  }

  // Execute block using Dataview API
  try {
    const executionResult = await executor.executeBlock(block, filePath);

    if (!executionResult.success) {
      const errorMarkdown = `> [!warning] ${block.kind === 'query' ? 'Dataview Query' : 'DataviewJS'} Error
> ${executionResult.error || 'Execution failed'}`;

      return {
        block,
        markdown: errorMarkdown,
        success: false,
        error: executionResult.error,
      };
    }

    // Convert to Markdown
    let markdown: string;

    if (block.kind === 'query') {
      // Query result → Markdown
      const queryResult = executionResult as { success: boolean; data?: unknown; error?: string };
      markdown = converter.convertQueryToMarkdown(
        {
          successful: true,
          value: queryResult.data as { values?: unknown[]; headers?: string[] },
        },
        block.queryType
      );
    } else {
      // DataviewJS result → Markdown
      const jsResult = executionResult as {
        success: boolean;
        container?: HTMLElement;
        error?: string;
      };
      markdown = converter.convertJsToMarkdown({
        success: true,
        container: jsResult.container!,
      });
    }

    return {
      block,
      markdown,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const errorMarkdown = `> [!error] Unexpected Error
> ${errorMessage}`;

    return {
      block,
      markdown: errorMarkdown,
      success: false,
      error: errorMessage,
    };
  }
}
