import { type LoggerPort, type Manifest, type ManifestAsset, type Session } from '@core-domain';

import { type CommandHandler } from '../../common/command-handler';
import { type IdGeneratorPort } from '../../ports/id-generator.port';
import { type ManifestPort } from '../../publishing/ports/manifest-storage.port';
import { type CreateSessionCommand } from '../commands/create-session.command';
import { type CreateSessionResult } from '../commands/create-session.result';
import { type SessionRepository } from '../ports/session.repository';

export class CreateSessionHandler implements CommandHandler<
  CreateSessionCommand,
  CreateSessionResult
> {
  private readonly logger?: LoggerPort;

  constructor(
    private readonly idGenerator: IdGeneratorPort,
    private readonly sessionRepository: SessionRepository,
    private readonly manifestStorage?: ManifestPort,
    logger?: LoggerPort
  ) {
    this.logger = logger?.child({ scope: 'sessions', operation: 'createSession' });
  }

  async handle(command: CreateSessionCommand): Promise<CreateSessionResult> {
    const startTime = Date.now();
    const sessionId = this.idGenerator.generateId();
    const logger = this.logger?.child({ sessionId });

    const now = new Date();

    const session: Session = {
      id: sessionId,
      notesPlanned: command.notesPlanned,
      assetsPlanned: command.assetsPlanned,
      notesProcessed: 0,
      assetsProcessed: 0,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      customIndexConfigs: command.customIndexConfigs,
      ignoredTags: command.ignoredTags,
      folderDisplayNames: command.folderDisplayNames,
      pipelineSignature: command.pipelineSignature, // PHASE 7: Store for later injection into manifest
    };

    await this.sessionRepository.create(session);

    // Load existing manifest to extract hashes for client-side deduplication
    let existingAssetHashes: string[] | undefined;
    let existingNoteHashes: Record<string, string> | undefined;
    let pipelineChanged: boolean | undefined;

    if (this.manifestStorage) {
      try {
        const manifest: Manifest | null = await this.manifestStorage.load();
        if (manifest) {
          // Extract asset hashes
          if (manifest.assets && manifest.assets.length > 0) {
            existingAssetHashes = manifest.assets
              .map((asset: ManifestAsset) => asset.hash)
              .filter((hash: string | undefined): hash is string => !!hash);
            logger?.debug('Loaded existing asset hashes for deduplication', {
              count: existingAssetHashes?.length ?? 0,
            });
          }

          // Compare pipeline signatures
          if (command.pipelineSignature && manifest.pipelineSignature) {
            const versionChanged =
              command.pipelineSignature.version !== manifest.pipelineSignature.version;
            const settingsChanged =
              command.pipelineSignature.renderSettingsHash !==
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
          } else if (command.pipelineSignature || manifest.pipelineSignature) {
            // One side has signature, the other doesn't => changed
            pipelineChanged = true;
            logger?.info('⚠️ Pipeline signature missing on one side, marking as changed', {
              hasCommandSignature: !!command.pipelineSignature,
              hasManifestSignature: !!manifest.pipelineSignature,
            });
          }

          // Extract note hashes only if pipeline unchanged
          if (pipelineChanged === false && manifest.pages && manifest.pages.length > 0) {
            existingNoteHashes = {};
            let hashCount = 0;
            for (const page of manifest.pages) {
              if (page.sourceHash && page.route) {
                existingNoteHashes[page.route] = page.sourceHash;
                hashCount++;
              }
            }
            logger?.info('✅ Loaded existing note hashes for deduplication', {
              totalPages: manifest.pages.length,
              pagesWithHash: hashCount,
            });
          } else if (pipelineChanged) {
            logger?.info('🔄 Pipeline changed, skipping note hash extraction (full re-render)');
          }
        }
      } catch (err) {
        // Manifest doesn't exist yet or can't be loaded - that's fine
        logger?.debug('No existing manifest found (first publish)', { error: err });
      }
    }

    const duration = Date.now() - startTime;
    logger?.info('Session created successfully', {
      sessionId,
      status: session.status,
      notesPlanned: session.notesPlanned,
      assetsPlanned: session.assetsPlanned,
      existingAssetHashesCount: existingAssetHashes?.length ?? 0,
      existingNoteHashesCount: existingNoteHashes ? Object.keys(existingNoteHashes).length : 0,
      pipelineChanged: pipelineChanged ?? 'unknown',
      durationMs: duration,
    });

    return {
      sessionId,
      success: true,
      existingAssetHashes,
      existingNoteHashes,
      pipelineChanged,
    };
  }
}
