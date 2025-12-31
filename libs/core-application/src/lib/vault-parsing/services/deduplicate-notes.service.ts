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
 * Metadata extracted from a note for deduplication purposes.
 */
interface NoteMetadata {
  note: PublishableNote;
  /** Final slug/name used for publication (from routing.slug) */
  slug: string;
  /** File size in bytes (based on content length as proxy) */
  sizeBytes: number;
  /** Stable identifier for deterministic sorting (vaultPath) */
  stableId: string;
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
export class DeduplicateNotesService {
  constructor(private readonly logger?: LoggerPort) {}

  /**
   * Deduplicate notes grouped by folder.
   * Each folder is processed independently.
   */
  process(notes: PublishableNote[]): PublishableNote[] {
    if (!notes || notes.length === 0) {
      return notes;
    }

    // Group notes by folder
    const notesByFolder = this.groupByFolder(notes);

    const allRetained: PublishableNote[] = [];
    let totalRemoved = 0;
    let totalRenamed = 0;

    // Process each folder independently
    for (const [folderId, folderNotes] of notesByFolder.entries()) {
      this.logger?.debug('Deduplicating notes for folder', {
        folderId,
        notesCount: folderNotes.length,
      });

      const result = this.deduplicateFolder(folderNotes);

      allRetained.push(...result.retained);
      totalRemoved += result.duplicatesRemoved;
      totalRenamed += result.renamed.length;

      if (result.duplicatesRemoved > 0) {
        this.logger?.debug('Removed strict duplicates in folder', {
          folderId,
          duplicatesRemoved: result.duplicatesRemoved,
        });
      }

      if (result.renamed.length > 0) {
        this.logger?.warn('Notes renamed due to slug collisions with different sizes', {
          folderId,
          renamedCount: result.renamed.length,
          details: result.renamed.map((r) => ({
            vaultPath: r.vaultPath,
            original: r.originalSlug,
            new: r.newSlug,
          })),
        });
      }
    }

    this.logger?.debug('Deduplication complete', {
      inputCount: notes.length,
      outputCount: allRetained.length,
      duplicatesRemoved: totalRemoved,
      notesRenamed: totalRenamed,
    });

    return allRetained;
  }

  /**
   * Group notes by folder ID for independent processing.
   */
  private groupByFolder(notes: PublishableNote[]): Map<string, PublishableNote[]> {
    const grouped = new Map<string, PublishableNote[]>();

    for (const note of notes) {
      const folderId = note.folderConfig.id;
      if (!grouped.has(folderId)) {
        grouped.set(folderId, []);
      }
      grouped.get(folderId)!.push(note);
    }

    return grouped;
  }

  /**
   * Deduplicate notes within a single folder.
   */
  private deduplicateFolder(notes: PublishableNote[]): DeduplicationResult {
    // Extract metadata for easier processing
    const metadata = notes.map((note) => this.extractMetadata(note));

    // Phase A: Group by slug
    const groupedBySlug = this.groupBySlug(metadata);

    const retained: PublishableNote[] = [];
    const renamed: DeduplicationResult['renamed'] = [];
    let duplicatesRemoved = 0;

    // Phase B: Process each slug group
    for (const [slug, group] of groupedBySlug.entries()) {
      if (group.length === 1) {
        // Single note → no deduplication needed
        retained.push(group[0].note);
        continue;
      }

      // Multiple notes with same slug → check sizes
      const uniqueSizes = new Set(group.map((m) => m.sizeBytes));

      if (uniqueSizes.size === 1) {
        // All sizes are equal → strict duplicates
        // Keep only the first (deterministic: sorted by stableId)
        const sorted = this.sortDeterministically(group);
        retained.push(sorted[0].note);
        duplicatesRemoved += group.length - 1;
      } else {
        // At least one size differs → keep all but rename non-canonical ones
        const sorted = this.sortDeterministically(group);

        // Canonical note (first in sorted order) keeps original slug
        retained.push(sorted[0].note);

        // Rename others with suffixes (1), (2), etc.
        for (let i = 1; i < sorted.length; i++) {
          const meta = sorted[i];
          const newSlug = this.addSuffixToSlug(slug, i);
          const renamedNote = this.cloneWithNewSlug(meta.note, newSlug);

          retained.push(renamedNote);
          renamed.push({
            noteId: meta.note.noteId,
            originalSlug: slug,
            newSlug,
            vaultPath: meta.stableId,
          });
        }
      }
    }

    return { retained, duplicatesRemoved, renamed };
  }

  /**
   * Extract metadata from a note for deduplication.
   */
  private extractMetadata(note: PublishableNote): NoteMetadata {
    return {
      note,
      slug: note.routing.slug,
      // Use content length as proxy for file size (deterministic)
      sizeBytes: note.content.length,
      stableId: note.vaultPath,
    };
  }

  /**
   * Group metadata by slug.
   */
  private groupBySlug(metadata: NoteMetadata[]): Map<string, NoteMetadata[]> {
    const grouped = new Map<string, NoteMetadata[]>();

    for (const meta of metadata) {
      if (!grouped.has(meta.slug)) {
        grouped.set(meta.slug, []);
      }
      grouped.get(meta.slug)!.push(meta);
    }

    return grouped;
  }

  /**
   * Sort notes deterministically:
   * 1. By size descending (largest first)
   * 2. By stableId ascending (vaultPath) for tie-breaking
   *
   * This ensures the "canonical" note is always the same for identical inputs.
   */
  private sortDeterministically(group: NoteMetadata[]): NoteMetadata[] {
    return [...group].sort((a, b) => {
      // First: largest size first
      if (a.sizeBytes !== b.sizeBytes) {
        return b.sizeBytes - a.sizeBytes;
      }
      // Tie-breaker: alphabetical by vaultPath
      return a.stableId.localeCompare(b.stableId);
    });
  }

  /**
   * Add suffix (n) to a slug, inserting before file extension if present.
   * Examples:
   * - "note" → "note (1)"
   * - "note.md" → "note (1).md"
   * - "my-page" → "my-page (1)"
   */
  private addSuffixToSlug(slug: string, index: number): string {
    const suffix = ` (${index})`;

    // Check if slug has a file extension
    const lastDotIndex = slug.lastIndexOf('.');

    if (lastDotIndex === -1 || lastDotIndex === 0) {
      // No extension or dot at start (hidden file) → append suffix
      return slug + suffix;
    }

    // Insert suffix before extension
    const nameWithoutExt = slug.slice(0, lastDotIndex);
    const ext = slug.slice(lastDotIndex);
    return nameWithoutExt + suffix + ext;
  }

  /**
   * Clone a note with a new slug (immutable update).
   * Updates routing.slug, routing.path, and routing.fullPath.
   */
  private cloneWithNewSlug(note: PublishableNote, newSlug: string): PublishableNote {
    // Rebuild paths with new slug
    const oldSlug = note.routing.slug;
    const newPath = note.routing.path.replace(oldSlug, newSlug);
    const newFullPath = note.routing.fullPath.replace(oldSlug, newSlug);

    return {
      ...note,
      routing: {
        ...note.routing,
        slug: newSlug,
        path: newPath,
        fullPath: newFullPath,
      },
    };
  }
}
