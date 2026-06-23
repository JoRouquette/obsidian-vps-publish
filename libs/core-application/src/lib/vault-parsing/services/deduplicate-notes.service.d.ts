import type { LoggerPort, PublishableNote } from '@core-domain';
/**
 * Result of the deduplication process.
 */
export interface DeduplicationResult {
    /** Notes retained after deduplication */
    retained: PublishableNote[];
    /** Number of strict duplicates removed (same name + same size) */
    duplicatesRemoved: number;
    /** Notes renamed with suffixes to avoid collisions (same name + different sizes) */
    renamed: Array<{
        noteId: string;
        originalSlug: string;
        newSlug: string;
        vaultPath: string;
    }>;
}
/**
 * Service responsible for deduplicating notes within each publication folder
 * BEFORE sending them to the API.
 *
 * Deduplication strategy:
 * - Phase A: Group notes by slug (final publication name)
 * - Phase B:
 *   - If all sizes in a group are equal → keep only one (strict duplicates)
 *   - If at least one size differs → keep all, but rename with suffixes (1), (2), etc.
 *
 * Renaming rules:
 * - The "canonical" note (largest size, or first if tie) keeps its original slug
 * - Other notes receive suffixes (1), (2), ... inserted before the file extension
 * - Example: "note.md" becomes "note (1).md", "note (2).md"
 * - Suffixes are assigned in deterministic order (sorted by size desc, then by vaultPath)
 *
 * IMPORTANT:
 * - No physical renaming in the vault; only the slug/path sent to the API is modified
 * - Deduplication is performed independently for each folder (folderConfig.id)
 * - Process is deterministic: same input always produces same output
 */
export declare class DeduplicateNotesService {
    private readonly logger?;
    constructor(logger?: LoggerPort | undefined);
    /**
     * Deduplicate notes grouped by folder.
     * Each folder is processed independently.
     */
    process(notes: PublishableNote[]): PublishableNote[];
    /**
     * Group notes by folder ID for independent processing.
     */
    private groupByFolder;
    /**
     * Deduplicate notes within a single folder.
     */
    private deduplicateFolder;
    /**
     * Extract metadata from a note for deduplication.
     */
    private extractMetadata;
    /**
     * Group metadata by slug.
     */
    private groupBySlug;
    /**
     * Sort notes deterministically:
     * 1. By size descending (largest first)
     * 2. By stableId ascending (vaultPath) for tie-breaking
     *
     * This ensures the "canonical" note is always the same for identical inputs.
     */
    private sortDeterministically;
    /**
     * Add suffix -n to a slug, inserting before file extension if present.
     * Examples:
     * - "note" → "note-1"
     * - "note.md" → "note-1.md"
     * - "my-page" → "my-page-1"
     */
    private addSuffixToSlug;
    /**
     * Clone a note with a new slug (immutable update).
     * Updates routing.slug, routing.path, and routing.fullPath.
     */
    private cloneWithNewSlug;
}
//# sourceMappingURL=deduplicate-notes.service.d.ts.map