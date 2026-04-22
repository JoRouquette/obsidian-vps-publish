/**
 * Unified Dataview Block Domain Model
 *
 * Represents both `dataview` query blocks and `dataviewjs` script blocks
 * with a single, clean discriminated union.
 *
 * NO LEGACY COMPATIBILITY - This is a clean slate implementation.
 */

/**
 * Block kind discriminant.
 * - 'query': DQL query block (```dataview)
 * - 'js': JavaScript block (```dataviewjs)
 */
export type DataviewBlockKind = 'query' | 'js';

/**
 * Query type for DQL queries (detected from first significant line).
 */
export type DataviewQueryType = 'list' | 'table' | 'task' | 'calendar' | 'unknown';

// Legacy type aliases for backward compatibility
export type DataviewListQuery = unknown;
export type DataviewTableQuery = unknown;
export type DataviewQueryResult = { rows: Record<string, unknown>[] };
export type DataviewBlock_LEGACY = unknown;

/**
 * Base properties shared by all Dataview blocks.
 */
interface DataviewBlockBase {
  /** Original language marker (e.g., "dataview", "DataView", "dataviewjs") */
  readonly langRaw: string;

  /** Raw content between fences (without ``` lines) */
  readonly contentRaw: string;

  /** Start line number (1-based, for debugging) */
  readonly startLine: number;

  /** End line number (1-based, for debugging) */
  readonly endLine: number;

  /** Start character index in source (0-based) */
  readonly startIndex: number;

  /** End character index in source (0-based) */
  readonly endIndex: number;
}

/**
 * Dataview Query Block (```dataview).
 */
export interface DataviewQueryBlock extends DataviewBlockBase {
  readonly kind: 'query';

  /** Detected query type (LIST, TABLE, TASK, CALENDAR, or unknown) */
  readonly queryType: DataviewQueryType;
}

/**
 * Dataview JS Block (```dataviewjs).
 */
export interface DataviewJsBlock extends DataviewBlockBase {
  readonly kind: 'js';
}

/**
 * Unified Dataview Block (discriminated union).
 */
export type DataviewBlock = DataviewQueryBlock | DataviewJsBlock;

/**
 * Result of processing a Dataview block (after serialization/replacement).
 */
export interface ProcessedDataviewBlock {
  /** Original parsed block */
  readonly block: DataviewBlock;

  /** Replacement HTML (placeholder or rendered content) */
  readonly html: string;

  /** Whether processing succeeded */
  readonly success: boolean;

  /** Error message if success=false */
  readonly error?: string;
}

/**
 * Serialized Dataview Block for backend/frontend consumption.
 * This is the format stored in notes and sent over HTTP.
 */
export interface SerializedDataviewBlock {
  /** Unique identifier for this block */
  id: string;

  /** Block kind discriminator */
  kind: DataviewBlockKind;

  /** Legacy type field for backward compatibility (uppercase format) */
  type: 'LIST' | 'TABLE' | 'TASK' | 'CALENDAR' | 'DataviewJS';

  /** Query content (for query blocks) */
  query?: string;

  /** Rendered HTML (placeholder or executed result) */
  renderedHtml: string;

  /** Whether processing succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;
}
