import type { CustomIndexConfig } from './custom-index-config';
import type { FolderConfig } from './folder-config';
import type { IgnoreRule } from './ignore-rule';
import type { RouteTreeConfig } from './route-node';
import type { SanitizationRules, SanitizationRulesDefaults } from './sanitization-rules';
export interface VpsConfig {
    /** Unique identifier for this VPS */
    id: string;
    /** Display name - must be unique across all VPS */
    name: string;
    /** Base URL - must be unique across all VPS */
    baseUrl: string;
    /** API key for authentication */
    apiKey: string;
    /** Ignore rules at VPS level */
    ignoreRules: IgnoreRule[];
    /**
     * Content cleanup/sanitization rules at VPS level.
     * Can contain both default rules (with i18n keys) and custom user rules.
     */
    cleanupRules: (SanitizationRules | SanitizationRulesDefaults)[];
    /**
     * BREAKING CHANGE: Route tree configuration (new route-first model)
     * Replaces the old `folders` array
     *
     * If present, this takes precedence over `folders`
     * During migration, `folders` will be converted to `routeTree`
     */
    routeTree?: RouteTreeConfig;
    /**
     * @deprecated Legacy folder configuration (folder-first model)
     * Kept for backward compatibility during migration
     * Will be removed in a future version
     *
     * If `routeTree` is present, this field is ignored
     * On plugin load, this will be auto-migrated to `routeTree`
     */
    folders?: FolderConfig[];
    /**
     * Custom index configurations for folders.
     * Allows defining custom index files to be included at the beginning
     * of generated folder indices.
     */
    customIndexes?: CustomIndexConfig[];
    /**
     * Optional custom root index file path (relative to vault root).
     * This file's content will be used as the root index page (/).
     */
    customRootIndexFile?: string;
}
/**
 * Domain invariants for VPS configuration
 */
export declare class VpsConfigInvariants {
    static validateUniqueName(vpsConfigs: VpsConfig[], name: string, excludeId?: string): void;
    static validateUniqueUrl(vpsConfigs: VpsConfig[], baseUrl: string, excludeId?: string): void;
    static validateMinimumFolders(vps: VpsConfig): void;
    static validateMinimumVps(vpsConfigs: VpsConfig[]): void;
}
//# sourceMappingURL=vps-config.d.ts.map