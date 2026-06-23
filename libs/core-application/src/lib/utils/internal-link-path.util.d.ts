export declare function stripMarkdownExtensionPreservingFragment(value: string): string;
export declare function splitInternalLinkTarget(value: string): {
    path: string;
    fragment?: string;
};
export declare function normalizeInternalLinkPath(value: string): string;
export declare function normalizeInternalLinkKey(value: string): string;
export declare function getInternalLinkBasename(value: string): string;
export declare function resolveRelativeInternalLinkPath(value: string, currentNoteRelativePath?: string): string;
//# sourceMappingURL=internal-link-path.util.d.ts.map