import type { CustomIndexConfig, LoggerPort } from '@core-domain';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { BaseService } from '../../common/base-service';
/**
 * Port for reading files from vault (subset of VaultPort)
 */
interface VaultReadPort {
    readFile(path: string): Promise<string>;
}
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
export declare class ResolveCustomIndexService implements BaseService {
    private readonly customIndexConfigs;
    private readonly vaultPort;
    private readonly logger;
    constructor(customIndexConfigs: CustomIndexConfig[], vaultPort: VaultReadPort, logger: LoggerPort);
    /**
     * Processes publishable notes to include custom index content.
     * This should be called after all other parsing/rendering steps.
     */
    process(notes: PublishableNote[]): PublishableNote[];
    /**
     * Gets the custom index configuration for a specific folder path.
     */
    getIndexForFolder(folderPath: string): CustomIndexConfig | undefined;
    /**
     * Gets the custom index configuration for the VPS root.
     */
    getRootIndex(): CustomIndexConfig | undefined;
    /**
     * Gets all custom index configurations.
     */
    getAllIndexes(): CustomIndexConfig[];
    /**
     * Reads and returns the content of a custom index file.
     * This content should be parsed through the same pipeline as regular notes.
     */
    getIndexContent(indexConfig: CustomIndexConfig): Promise<string | null>;
    /**
     * Normalizes a folder path for comparison.
     */
    private normalizeFolderPath;
}
export {};
//# sourceMappingURL=resolve-custom-index.service.d.ts.map