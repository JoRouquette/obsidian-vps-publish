"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildUploadSessionNotes = buildUploadSessionNotes;
function buildUploadSessionNotes(notes) {
    return notes.map((note) => {
        const { noteId, title, vaultPath, relativePath, content, frontmatter, folderConfig } = note;
        return {
            noteId,
            title,
            vaultPath,
            relativePath,
            content,
            frontmatter,
            folderConfig,
            publishedAt: note.publishedAt,
            eligibility: note.eligibility,
            assets: note.assets,
            leafletBlocks: note.leafletBlocks,
        };
    });
}
