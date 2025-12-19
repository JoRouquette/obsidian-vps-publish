/**
 * Configuration for custom index files per folder.
 * Allows defining a custom index file to be used at the beginning
 * of the generated index for a specific folder.
 */
export interface CustomIndexConfig {
  /**
   * Unique identifier for this index configuration.
   */
  id: string;

  /**
   * Target folder path in the vault.
   * Examples: "campagne/", "campagne/pnj/", "world/lore/"
   * Empty string "" represents the VPS root index.
   */
  folderPath: string;

  /**
   * Path to the index file in the vault.
   * This file will be collected, parsed, and included at the beginning
   * of the generated index for the folder.
   * Example: "campagne/_index.md"
   */
  indexFilePath: string;

  /**
   * Whether this index is for the VPS root (global index).
   * When true, folderPath should be "".
   */
  isRootIndex?: boolean;
}

/**
 * Domain invariants for custom index configuration.
 */
export class CustomIndexConfigInvariants {
  /**
   * Validates that a folder path doesn't have duplicate index configurations.
   */
  static validateUniqueFolder(
    configs: CustomIndexConfig[],
    folderPath: string,
    excludeId?: string
  ): void {
    const duplicate = configs.find(
      (config) => config.folderPath === folderPath && config.id !== excludeId
    );
    if (duplicate) {
      throw new Error(`Folder "${folderPath}" already has a custom index configured`);
    }
  }

  /**
   * Validates that an index file path exists and is a markdown file.
   */
  static validateIndexFilePath(indexFilePath: string): void {
    if (!indexFilePath || indexFilePath.trim() === '') {
      throw new Error('Index file path cannot be empty');
    }
    if (!indexFilePath.endsWith('.md')) {
      throw new Error('Index file must be a markdown file (.md)');
    }
  }

  /**
   * Validates root index configuration.
   */
  static validateRootIndex(config: CustomIndexConfig): void {
    if (config.isRootIndex && config.folderPath !== '') {
      throw new Error('Root index must have an empty folder path');
    }
  }
}
