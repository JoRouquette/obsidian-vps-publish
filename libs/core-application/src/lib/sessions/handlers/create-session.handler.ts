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
    };

    await this.sessionRepository.create(session);

    // Load existing manifest to extract asset hashes for client-side deduplication
    let existingAssetHashes: string[] | undefined;
    if (this.manifestStorage) {
      try {
        const manifest: Manifest | null = await this.manifestStorage.load();
        if (manifest?.assets && manifest.assets.length > 0) {
          existingAssetHashes = manifest.assets
            .map((asset: ManifestAsset) => asset.hash)
            .filter((hash: string | undefined): hash is string => !!hash);
          logger?.debug('Loaded existing asset hashes for deduplication', {
            count: existingAssetHashes?.length ?? 0,
          });
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
      durationMs: duration,
    });

    return {
      sessionId,
      success: true,
      existingAssetHashes,
    };
  }
}
