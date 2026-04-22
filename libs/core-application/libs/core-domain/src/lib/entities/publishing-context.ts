/**
 * Session-scoped context for publishing operations
 * Provides caching and state management during a single publish session
 */

import type { ResolvedAssetFile } from './resolved-asset-file';

export interface PublishingContext {
  /** Unique session identifier */
  readonly sessionId: string;

  /** Cache for resolved assets (keyed by vault path) */
  readonly resolvedAssetsCache: Map<string, ResolvedAssetFile>;

  /** Cache for parsed note content (keyed by note ID) */
  readonly parsedContentCache: Map<string, string>;

  /** Cache for computed routing (keyed by note ID) */
  readonly routingCache: Map<string, string>;

  /** Temporary metadata storage */
  readonly metadata: Map<string, unknown>;

  /**
   * Clear all caches (call at end of session)
   */
  clear(): void;

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    resolvedAssets: number;
    parsedContent: number;
    routing: number;
    metadata: number;
  };
}

/**
 * Default implementation of PublishingContext
 */
export class DefaultPublishingContext implements PublishingContext {
  public readonly resolvedAssetsCache = new Map<string, ResolvedAssetFile>();
  public readonly parsedContentCache = new Map<string, string>();
  public readonly routingCache = new Map<string, string>();
  public readonly metadata = new Map<string, unknown>();

  constructor(public readonly sessionId: string) {}

  clear(): void {
    this.resolvedAssetsCache.clear();
    this.parsedContentCache.clear();
    this.routingCache.clear();
    this.metadata.clear();
  }

  getCacheStats() {
    return {
      resolvedAssets: this.resolvedAssetsCache.size,
      parsedContent: this.parsedContentCache.size,
      routing: this.routingCache.size,
      metadata: this.metadata.size,
    };
  }
}
