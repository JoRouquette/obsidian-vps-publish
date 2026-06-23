import type { FolderConfig } from './folder-config';
import type { RouteTreeConfig } from './route-node';
/**
 * Migration utility: convert legacy FolderConfig[] to RouteTreeConfig
 *
 * BREAKING CHANGE: This function transforms the old "folder-first" model
 * into the new "route-first" model.
 *
 * Strategy:
 * - Each FolderConfig becomes a RouteNode
 * - routeBase is parsed into route segments to build tree structure
 * - IDs are preserved when possible for stability
 * - Folder properties (vaultFolder, flattenTree, etc.) are attached to nodes
 *
 * @param legacyFolders - Old FolderConfig[] array
 * @returns New RouteTreeConfig
 */
export declare function migrateLegacyFoldersToRouteTree(legacyFolders: FolderConfig[]): RouteTreeConfig;
/**
 * Reverse migration: convert RouteTreeConfig to FolderConfig[]
 * Useful for temporary backward compatibility or export
 *
 * @param routeTree - New RouteTreeConfig
 * @param vpsId - VPS ID to assign to generated FolderConfig items
 * @returns Legacy FolderConfig[]
 */
export declare function migrateRouteTreeToLegacyFolders(routeTree: RouteTreeConfig, vpsId: string): FolderConfig[];
/**
 * Apply custom indexes from VpsConfig.customIndexes to route tree
 * Migrates legacy customIndexes array to per-node customIndexFile
 *
 * @param routeTree - Route tree to update
 * @param customIndexes - Legacy custom indexes array from VpsConfig
 */
export declare function applyCustomIndexesToRouteTree(routeTree: RouteTreeConfig, customIndexes: {
    folderPath: string;
    indexFilePath: string;
}[]): void;
//# sourceMappingURL=route-node-migration.d.ts.map