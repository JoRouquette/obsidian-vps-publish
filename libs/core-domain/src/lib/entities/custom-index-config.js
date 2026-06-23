"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomIndexConfigInvariants = void 0;
/**
 * Domain invariants for custom index configuration.
 */
class CustomIndexConfigInvariants {
    /**
     * Validates that a folder path doesn't have duplicate index configurations.
     */
    static validateUniqueFolder(configs, folderPath, excludeId) {
        const duplicate = configs.find((config) => config.folderPath === folderPath && config.id !== excludeId);
        if (duplicate) {
            throw new Error(`Folder "${folderPath}" already has a custom index configured`);
        }
    }
    /**
     * Validates that an index file path exists and is a markdown file.
     */
    static validateIndexFilePath(indexFilePath) {
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
    static validateRootIndex(config) {
        if (config.isRootIndex && config.folderPath !== '') {
            throw new Error('Root index must have an empty folder path');
        }
    }
}
exports.CustomIndexConfigInvariants = CustomIndexConfigInvariants;
