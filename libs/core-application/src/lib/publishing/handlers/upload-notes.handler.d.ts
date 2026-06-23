import { type LoggerPort, type NoteHashPort } from '@core-domain';
import { type CommandHandler } from '../../common/command-handler';
import type { MarkdownRendererPort } from '../../ports/markdown-renderer.port';
import { type UploadNotesCommand, type UploadNotesResult } from '../commands/upload-notes.command';
import { type ContentStoragePort } from '../ports/content-storage.port';
import type { ManifestPort } from '../ports/manifest-storage.port';
import type { SessionNotesStoragePort } from '../ports/session-notes-storage.port';
export interface PublishNotesOutput {
    published: number;
    errors: {
        noteId: string;
        message: string;
    }[];
}
type ContentStorageFactory = (sessionId: string) => ContentStoragePort;
type ManifestStorageFactory = (sessionId: string) => ManifestPort;
export declare class UploadNotesHandler implements CommandHandler<UploadNotesCommand, UploadNotesResult> {
    private readonly markdownRenderer;
    private readonly contentStorage;
    private readonly manifestStorage;
    private readonly notesStorage?;
    private readonly ignoredTags?;
    private readonly noteHashService?;
    private readonly logger?;
    constructor(markdownRenderer: MarkdownRendererPort, contentStorage: ContentStoragePort | ContentStorageFactory, manifestStorage: ManifestPort | ManifestStorageFactory, logger?: LoggerPort, notesStorage?: SessionNotesStoragePort | undefined, ignoredTags?: string[] | undefined, noteHashService?: NoteHashPort | undefined);
    handle(command: UploadNotesCommand): Promise<UploadNotesResult>;
    private normalizeUploadedNotes;
    private hasRouting;
    private hydrateSourcePackageNote;
    private buildRenderManifest;
    private buildManifestPage;
    private updateManifestForSession;
    private shouldRebuildIndexesAfterUpload;
    private buildHtmlPage;
    private renderFrontmatter;
    private hasRenderableFrontmatterValue;
    private resolveContentStorage;
    private resolveManifestStorage;
    private renderFrontmatterText;
    private renderFrontmatterAssetLink;
    private renderFrontmatterWikilink;
    private extractEmbedTarget;
    private buildAssetUrl;
    private escapeHtml;
    private escapeAttribute;
    /**
     * Extract SEO-related fields from note frontmatter.
     * Robust extraction: missing/invalid fields return undefined, never throws.
     */
    private extractSeoFields;
    private extractAliases;
    /**
     * Trim description to ~160 chars intelligently (at word boundary).
     */
    private trimDescription;
    /**
     * Resolve image path to public URL.
     */
    private resolveImagePath;
    /**
     * Parse various date formats to Date object.
     */
    private parseDate;
}
export {};
//# sourceMappingURL=upload-notes.handler.d.ts.map