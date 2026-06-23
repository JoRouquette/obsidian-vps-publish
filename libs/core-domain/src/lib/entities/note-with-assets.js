"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNoteWithAssets = isNoteWithAssets;
exports.extractNoteWithAssets = extractNoteWithAssets;
exports.extractNotesWithAssets = extractNotesWithAssets;
function isNoteWithAssets(note) {
    return note.assets !== undefined;
}
function extractNoteWithAssets(note) {
    if (isNoteWithAssets(note)) {
        return note;
    }
    return null;
}
function extractNotesWithAssets(notes) {
    return notes.filter(isNoteWithAssets);
}
