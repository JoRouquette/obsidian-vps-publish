/**
 * RouteNode - Represents a segment in the route tree (route-first model)
 *
 * A route node defines a URL segment (e.g., "/lore", "/lore/characters")
 * and can optionally be linked to a vault folder, have custom content, or both.
 *
 * This is the core entity of the BREAKING CHANGE: routes are now first-class
 * citizens, independent of vault folder structure.
 *
 * @example
 * // Pure route node (no vault folder)
 * {
 *   id: 'route-lore',
 *   segment: 'lore',
 *   vaultFolder: undefined,
 *   customIndexFile: 'indexes/lore-intro.md',
 *   additionalFiles: ['content/lore-overview.md'],
 *   children: [...]
 * }
 *
 * @example
 * // Route node with folder attachment
 * {
 *   id: 'route-characters',
 *   segment: 'characters',
 *   vaultFolder: 'World/Characters',
 *   flattenTree: true,
 *   children: []
 * }
 */
export interface RouteNode {
  /** Unique identifier for this route node */
  id: string;

  /**
   * URL segment for this route level
   * - For root: '' or '/' (normalized to '')
   * - For sub-routes: 'characters', 'lore', etc. (no leading/trailing slash)
   * - Must be URL-safe (will be slugified/validated)
   */
  segment: string;

  /**
   * Optional display name for this route/folder in navigation
   * Used in site navigation, breadcrumbs, and folder indexes
   * If not set, falls back to humanized segment (e.g., "api-docs" → "Api Docs")
   * @example "API Documentation" for segment "api-docs"
   * @example "Lore & Characters" for segment "lore"
   */
  displayName?: string;

  /**
   * Optional vault folder path to attach to this route
   * If present, all notes in this folder will be published under this route
   * If absent, this is a "pure route" (can still have customIndexFile and additionalFiles)
   */
  vaultFolder?: string;

  /**
   * Optional custom index file path (relative to vault root)
   * This file's content will be used as the index page for this route segment
   * Works for both pure routes and folder-attached routes
   */
  customIndexFile?: string;

  /**
   * Optional list of additional file paths (relative to vault root)
   * These files are published at the root of THIS route node,
   * regardless of their actual vault location
   */
  additionalFiles?: string[];

  /**
   * If true (and vaultFolder is set), flattens the folder tree:
   * all notes in subfolders are treated as direct children of this route,
   * and subfolder segments are removed from URL paths
   *
   * Only applicable when vaultFolder is set
   */
  flattenTree?: boolean;

  /**
   * IDs of cleanup rules (from parent VPS) to ignore for this route node
   * Opt-out from VPS-level cleanup rules
   * Default: empty array (no rules ignored)
   */
  ignoredCleanupRuleIds?: string[];

  /**
   * Child route nodes (sub-segments)
   * Example: '/lore' node can have children ['characters', 'locations']
   */
  children?: RouteNode[];
}

/**
 * Route tree configuration for a VPS
 * Replaces the old flat `folders: FolderConfig[]` array
 */
export interface RouteTreeConfig {
  /**
   * Root nodes of the route tree
   * Each root node represents a top-level route segment (e.g., '/blog', '/docs')
   */
  roots: RouteNode[];
}
