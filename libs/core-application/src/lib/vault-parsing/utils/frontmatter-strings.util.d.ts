export interface FrontmatterStringEntry {
    path: string;
    value: string;
}
/**
 * Extract all string values from a nested frontmatter object and keep their property paths.
 */
export declare function extractFrontmatterStrings(source: unknown, currentPath?: string): FrontmatterStringEntry[];
//# sourceMappingURL=frontmatter-strings.util.d.ts.map