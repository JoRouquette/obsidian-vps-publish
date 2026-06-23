export declare class AssetValidationError extends Error {
    readonly fileName?: string | undefined;
    readonly reason?: "SIZE_EXCEEDED" | "MIME_MISMATCH" | "INVALID_CONTENT" | "UNKNOWN" | undefined;
    constructor(message: string, fileName?: string | undefined, reason?: "SIZE_EXCEEDED" | "MIME_MISMATCH" | "INVALID_CONTENT" | "UNKNOWN" | undefined);
}
//# sourceMappingURL=asset-validation.error.d.ts.map