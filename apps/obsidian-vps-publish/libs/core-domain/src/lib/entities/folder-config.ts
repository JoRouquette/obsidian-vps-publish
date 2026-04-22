export interface FolderConfig {
  id: string;

  /** VPS ID this folder belongs to */
  vpsId: string;

  /** Vault folder path */
  vaultFolder: string;

  /** Route base for published content */
  routeBase: string;

  /**
   * Optional display name for this folder/route in navigation
   * Propagated from RouteNode.displayName
   * Used in breadcrumbs, folder indexes, and site navigation
   * Falls back to humanized routeBase segment if not set
   */
  displayName?: string;

  /**
   * IDs of cleanup rules (from parent VPS) to ignore for this folder
   * These are opt-out from VPS-level cleanup rules
   */
  ignoredCleanupRuleIds: string[];

  /**
   * Optional custom index file path (relative to vault root)
   * This file's content will be prepended to the generated folder index
   */
  customIndexFile?: string;

  /**
   * If true, flattens the folder tree: all notes in subfolders are treated
   * as direct children of this folder, and subfolders are not visible in navigation.
   * Default: false (preserves subfolder structure).
   *
   * @remarks
   * - All notes under vaultFolder/** are published at routeBase/<slug>
   * - Subfolder segments are removed from URL paths
   * - Collision detection applies: notes with same filename in different subfolders
   *   will conflict and require explicit handling
   */
  flattenTree?: boolean;

  /**
   * Optional list of additional file paths (relative to vault root) to include
   * in this folder's published content.
   * These files are published at the root of this folder's routeBase,
   * regardless of their actual location in the vault.
   *
   * @remarks
   * - Files are deduplicated: if a file is already included via vaultFolder, it won't be added again
   * - Each file is treated as a note and processed through the same pipeline
   * - Final route: routeBase/<slug> (no subfolder segments, even if file is nested in vault)
   */
  additionalFiles?: string[];
}
