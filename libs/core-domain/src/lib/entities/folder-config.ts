export interface FolderConfig {
  id: string;

  /** VPS ID this folder belongs to */
  vpsId: string;

  /** Vault folder path */
  vaultFolder: string;

  /** Route base for published content */
  routeBase: string;

  /**
   * IDs of cleanup rules (from parent VPS) to ignore for this folder
   * These are opt-out from VPS-level cleanup rules
   */
  ignoredCleanupRuleIds: string[];
}
