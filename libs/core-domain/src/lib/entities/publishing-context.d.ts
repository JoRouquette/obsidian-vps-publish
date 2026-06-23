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
export declare class DefaultPublishingContext implements PublishingContext {
    readonly sessionId: string;
    readonly resolvedAssetsCache: Map<string, ResolvedAssetFile>;
    readonly parsedContentCache: Map<string, string>;
    readonly routingCache: Map<string, string>;
    readonly metadata: Map<string, unknown>;
    constructor(sessionId: string);
    clear(): void;
    getCacheStats(): {
        resolvedAssets: number;
        parsedContent: number;
        routing: number;
        metadata: number;
    };
}
//# sourceMappingURL=publishing-context.d.ts.map