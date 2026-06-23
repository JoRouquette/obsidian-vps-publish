/**
 * Normalize a string to camelCase suitable for object properties.
 * - Split on dashes, underscores, and spaces
 * - Lowercase all segments, then capitalize the first letter of subsequent ones
 * - Leave keys that are already camelCase untouched
 */
export declare function normalizePropertyKey(key: string): string;
/**
 * Convert a normalized property key to a human readable label.
 * Example: "effetSecondaire" -> "Effet secondaire"
 */
export declare function humanizePropertyKey(key: string): string;
export declare function toString(value: unknown): string;
//# sourceMappingURL=string.utils.d.ts.map