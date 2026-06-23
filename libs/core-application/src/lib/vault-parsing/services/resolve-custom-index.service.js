"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveCustomIndexService = void 0;
/**
 * Service responsible for resolving and including custom index content
 * at the beginning of folder indices.
 *
 * This service:
 * 1. Identifies if a folder has a custom index configured
 * 2. Reads the custom index file from the vault
 * 3. Parses it through the same pipeline as regular notes
 * 4. Includes the content at the beginning of the folder's index
 */
class ResolveCustomIndexService {
    constructor(customIndexConfigs, vaultPort, logger) {
        this.customIndexConfigs = customIndexConfigs;
        this.vaultPort = vaultPort;
        this.logger = logger;
    }
    /**
     * Processes publishable notes to include custom index content.
     * This should be called after all other parsing/rendering steps.
     */
    process(notes) {
        this.logger.debug('Resolving custom indexes', {
            totalNotes: notes.length,
            configuredIndexes: this.customIndexConfigs.length,
        });
        // For now, we'll return notes unchanged
        // The actual implementation will be done when we integrate with manifest generation
        // This service will be used to fetch index content that will be prepended to folder indexes
        return notes;
    }
    /**
     * Gets the custom index configuration for a specific folder path.
     */
    getIndexForFolder(folderPath) {
        const normalized = this.normalizeFolderPath(folderPath);
        return this.customIndexConfigs.find((config) => this.normalizeFolderPath(config.folderPath) === normalized && !config.isRootIndex);
    }
    /**
     * Gets the custom index configuration for the VPS root.
     */
    getRootIndex() {
        return this.customIndexConfigs.find((config) => config.isRootIndex || config.folderPath === '');
    }
    /**
     * Gets all custom index configurations.
     */
    getAllIndexes() {
        return this.customIndexConfigs;
    }
    /**
     * Reads and returns the content of a custom index file.
     * This content should be parsed through the same pipeline as regular notes.
     */
    async getIndexContent(indexConfig) {
        try {
            this.logger.debug('Reading custom index file', {
                indexId: indexConfig.id,
                filePath: indexConfig.indexFilePath,
            });
            const content = await this.vaultPort.readFile(indexConfig.indexFilePath);
            return content;
        }
        catch (error) {
            this.logger.error('Failed to read custom index file', {
                indexId: indexConfig.id,
                filePath: indexConfig.indexFilePath,
                error,
            });
            return null;
        }
    }
    /**
     * Normalizes a folder path for comparison.
     */
    normalizeFolderPath(path) {
        if (!path || path === '')
            return '';
        // Remove leading/trailing slashes and normalize separators
        return path.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
    }
}
exports.ResolveCustomIndexService = ResolveCustomIndexService;
