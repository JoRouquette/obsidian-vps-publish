"use strict";
/**
 * Session-scoped context for publishing operations
 * Provides caching and state management during a single publish session
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultPublishingContext = void 0;
/**
 * Default implementation of PublishingContext
 */
class DefaultPublishingContext {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.resolvedAssetsCache = new Map();
        this.parsedContentCache = new Map();
        this.routingCache = new Map();
        this.metadata = new Map();
    }
    clear() {
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
exports.DefaultPublishingContext = DefaultPublishingContext;
