"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotesMapper = void 0;
class NotesMapper {
    map(note) {
        // Map all NoteCore fields directly
        const { noteId, title, vaultPath, relativePath, content, frontmatter, folderConfig } = note;
        // Provide default routing info (must be replaced with actual logic as needed)
        const routing = {
            slug: '',
            path: '',
            fullPath: note.vaultPath,
            routeBase: note.folderConfig.routeBase || '',
        };
        const eligibility = { isPublishable: false };
        const publishedAt = new Date();
        return {
            noteId,
            title,
            vaultPath,
            relativePath,
            content,
            frontmatter,
            folderConfig,
            routing,
            publishedAt,
            eligibility,
        };
    }
}
exports.NotesMapper = NotesMapper;
