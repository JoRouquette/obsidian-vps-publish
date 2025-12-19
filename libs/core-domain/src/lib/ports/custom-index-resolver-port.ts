import type { CustomIndexConfig } from '../entities/custom-index-config';

/**
 * Port for resolving custom index configurations.
 * Provides access to custom index mappings at the domain boundary.
 */
export interface CustomIndexResolverPort {
  /**
   * Gets the custom index configuration for a specific folder path.
   * @param folderPath - The vault folder path (e.g., "campagne/", "world/lore/")
   * @returns The custom index config if found, undefined otherwise
   */
  getIndexForFolder(folderPath: string): CustomIndexConfig | undefined;

  /**
   * Gets the custom index configuration for the VPS root.
   * @returns The root index config if configured, undefined otherwise
   */
  getRootIndex(): CustomIndexConfig | undefined;

  /**
   * Gets all custom index configurations.
   * @returns Array of all custom index configurations
   */
  getAllIndexes(): CustomIndexConfig[];
}
