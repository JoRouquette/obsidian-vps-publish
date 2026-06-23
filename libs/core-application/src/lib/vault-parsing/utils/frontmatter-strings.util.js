"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFrontmatterStrings = extractFrontmatterStrings;
/**
 * Extract all string values from a nested frontmatter object and keep their property paths.
 */
function extractFrontmatterStrings(source, currentPath = '') {
    const results = [];
    const visit = (value, path) => {
        if (value === null || value === undefined)
            return;
        if (typeof value === 'string') {
            results.push({ path, value });
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                const nextPath = path ? `${path}[${index}]` : `[${index}]`;
                visit(item, nextPath);
            });
            return;
        }
        if (typeof value === 'object') {
            Object.entries(value).forEach(([key, val]) => {
                const nextPath = path ? `${path}.${key}` : key;
                visit(val, nextPath);
            });
        }
    };
    visit(source, currentPath);
    return results;
}
