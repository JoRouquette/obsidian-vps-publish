"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSessionHandler = void 0;
class CreateSessionHandler {
    constructor(idGenerator, sessionRepository, manifestStorage, logger) {
        this.idGenerator = idGenerator;
        this.sessionRepository = sessionRepository;
        this.manifestStorage = manifestStorage;
        this.logger = logger?.child({ scope: 'sessions', operation: 'createSession' });
    }
    async handle(command) {
        const startTime = Date.now();
        const sessionId = this.idGenerator.generateId();
        const logger = this.logger?.child({ sessionId });
        const deduplicationEnabled = command.deduplicationEnabled !== false;
        const now = new Date();
        const session = {
            id: sessionId,
            notesPlanned: command.notesPlanned,
            assetsPlanned: command.assetsPlanned,
            notesProcessed: 0,
            assetsProcessed: 0,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
            customIndexConfigs: command.customIndexConfigs,
            ignoreRules: command.ignoreRules,
            ignoredTags: command.ignoredTags,
            folderDisplayNames: command.folderDisplayNames,
            pipelineSignature: command.pipelineSignature, // PHASE 7: Store for later injection into manifest
            locale: command.locale, // Store locale for manifest generation
        };
        session.deduplicationEnabled =
            deduplicationEnabled;
        await this.sessionRepository.create(session);
        // Load existing manifest to extract hashes for client-side deduplication
        let existingAssetHashes;
        let existingSourceNoteHashesByVaultPath;
        let pipelineChanged;
        if (this.manifestStorage && deduplicationEnabled) {
            try {
                const manifest = await this.manifestStorage.load();
                if (manifest) {
                    // Extract asset hashes
                    if (manifest.assets && manifest.assets.length > 0) {
                        existingAssetHashes = manifest.assets
                            .map((asset) => asset.hash)
                            .filter((hash) => !!hash);
                        logger?.debug('Loaded existing asset hashes for deduplication', {
                            count: existingAssetHashes?.length ?? 0,
                        });
                    }
                    // Compare pipeline signatures
                    if (command.pipelineSignature && manifest.pipelineSignature) {
                        const versionChanged = command.pipelineSignature.version !== manifest.pipelineSignature.version;
                        const settingsChanged = command.pipelineSignature.renderSettingsHash !==
                            manifest.pipelineSignature.renderSettingsHash;
                        pipelineChanged = versionChanged || settingsChanged;
                        logger?.info('🔍 Pipeline signature comparison', {
                            currentVersion: command.pipelineSignature.version,
                            manifestVersion: manifest.pipelineSignature.version,
                            currentSettingsHash: command.pipelineSignature.renderSettingsHash,
                            manifestSettingsHash: manifest.pipelineSignature.renderSettingsHash,
                            versionChanged,
                            settingsChanged,
                            pipelineChanged,
                        });
                    }
                    else if (command.pipelineSignature || manifest.pipelineSignature) {
                        // One side has signature, the other doesn't => changed
                        pipelineChanged = true;
                        logger?.info('⚠️ Pipeline signature missing on one side, marking as changed', {
                            hasCommandSignature: !!command.pipelineSignature,
                            hasManifestSignature: !!manifest.pipelineSignature,
                        });
                    }
                    // Extract note hashes only if pipeline unchanged
                    if (pipelineChanged === false && manifest.pages && manifest.pages.length > 0) {
                        existingSourceNoteHashesByVaultPath = {};
                        let sourceHashCount = 0;
                        for (const page of manifest.pages) {
                            if (page.sourceHash && page.vaultPath) {
                                existingSourceNoteHashesByVaultPath[page.vaultPath] = page.sourceHash;
                                sourceHashCount++;
                            }
                        }
                        logger?.info('✅ Loaded existing note hashes for deduplication', {
                            totalPages: manifest.pages.length,
                            pagesWithVaultPathHash: sourceHashCount,
                        });
                    }
                    else if (pipelineChanged) {
                        logger?.info('🔄 Pipeline changed, skipping note hash extraction (full re-render)');
                    }
                }
            }
            catch (err) {
                // Manifest doesn't exist yet or can't be loaded - that's fine
                logger?.debug('No existing manifest found (first publish)', { error: err });
            }
        }
        else if (!deduplicationEnabled) {
            pipelineChanged = true;
            logger?.info('Deduplication disabled, skipping manifest hash extraction');
        }
        const duration = Date.now() - startTime;
        logger?.info('Session created successfully', {
            sessionId,
            status: session.status,
            notesPlanned: session.notesPlanned,
            assetsPlanned: session.assetsPlanned,
            existingAssetHashesCount: existingAssetHashes?.length ?? 0,
            existingSourceNoteHashesByVaultPathCount: existingSourceNoteHashesByVaultPath
                ? Object.keys(existingSourceNoteHashesByVaultPath).length
                : 0,
            pipelineChanged: pipelineChanged ?? 'unknown',
            deduplicationEnabled,
            durationMs: duration,
        });
        return {
            sessionId,
            success: true,
            deduplicationEnabled,
            existingAssetHashes,
            existingSourceNoteHashesByVaultPath,
            pipelineChanged,
        };
    }
}
exports.CreateSessionHandler = CreateSessionHandler;
