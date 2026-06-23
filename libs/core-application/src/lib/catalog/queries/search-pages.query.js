"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchPagesHandler = void 0;
class SearchPagesHandler {
    async handle(params) {
        const { manifest, query } = params;
        const normalized = query.trim().toLowerCase();
        if (!normalized)
            return manifest.pages;
        return manifest.pages.filter((p) => (p.title ?? '').toLowerCase().includes(normalized) ||
            (p.tags ?? []).some((t) => t.toLowerCase().includes(normalized)));
    }
}
exports.SearchPagesHandler = SearchPagesHandler;
