import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { PublishPluginSettings } from '@core-domain/entities/publish-plugin-settings';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import { LogLevel, type LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type { UploaderPort } from '@core-domain/ports/uploader-port';
import type { VaultPort } from '@core-domain/ports/vault-port';

import { CommandHandler } from '../../common/command-handler';

export type PublicationResult =
  | { type: 'success'; publishedCount: number; notes: PublishableNote[] }
  | { type: 'noConfig' }
  | { type: 'missingVpsConfig'; foldersWithoutVps: string[] }
  | { type: 'error'; error: unknown };

export interface PublishNotesCommand {
  settings: PublishPluginSettings;
  progress?: ProgressPort;
}

/**
 * Orchestrateur principal de composition de notes et d'envoi.
 */
export class PublishNotesCommandHandler
  implements CommandHandler<PublishNotesCommand, PublicationResult>
{
  constructor(
    private readonly vaultPort: VaultPort<CollectedNote[]>,
    private readonly uploaderPort: UploaderPort,
    private readonly markdownParserHandler: CommandHandler<any, any>,
    private readonly logger: LoggerPort
  ) {
    this.logger = logger.child({ usecase: 'PublishToSiteUseCase' }, LogLevel.debug);
    this.logger.debug('PublishToSiteUseCase initialized');
  }

  async handle(command: PublishNotesCommand): Promise<PublicationResult> {
    const { settings, progress } = command;
    this.logger.info('Starting publish-to-site execution');

    if (!settings?.vpsConfigs?.length || !settings?.folders?.length) {
      this.logger.warn('No VPS configs or folders found in settings');
      return { type: 'noConfig' };
    }

    const vpsById = new Map<string, any>();
    for (const vps of settings.vpsConfigs) {
      if (vps && vps.id) vpsById.set(vps.id, vps);
    }

    const missingVps: string[] = [];
    const collected: CollectedNote[] = [];

    for (const folder of settings.folders) {
      const vpsConfig = vpsById.get(folder.vpsId);
      if (!vpsConfig) {
        this.logger.warn('Missing VPS config for folder', {
          folderId: folder.id,
          vpsId: folder.vpsId,
        });
        missingVps.push(folder.id);
        continue;
      }

      this.logger.debug('Collecting notes from folder', { folderId: folder.id });
      collected.push(...(await this.vaultPort.collectFromFolder(folder)));
    }

    if (missingVps.length > 0) {
      this.logger.error('Some folders are missing VPS configs', {
        missingVps,
      });
      return { type: 'missingVpsConfig', foldersWithoutVps: missingVps };
    }

    if (collected.length === 0) {
      this.logger.info('No notes collected for publishing');
      progress?.start(0);
      progress?.finish();
      return { type: 'success', publishedCount: 0, notes: [] };
    }

    progress?.start(collected.length);
    this.logger.info('Collected notes', { count: collected.length });

    const publishable: PublishableNote[] = await this.markdownParserHandler.handle(collected);

    if (publishable.length === 0) {
      this.logger.info('No publishable notes after filtering');
      progress?.finish();
      return { type: 'success', publishedCount: 0, notes: [] };
    }

    const byVps = new Map<string, PublishableNote[]>();
    for (const note of publishable) {
      const key = note.vpsConfig.id;
      const bucket = byVps.get(key);
      if (!bucket) {
        byVps.set(key, [note]);
      } else {
        bucket.push(note);
      }
    }

    let publishedCount = 0;

    try {
      for (const [vpsId, notes] of byVps.entries()) {
        this.logger.info('Uploading notes to VPS', {
          vpsId,
          noteCount: notes.length,
        });
        const success = await this.uploaderPort.upload(notes);

        if (!success) {
          this.logger.error('Failed to upload notes to VPS', { vpsId });
          throw new Error(`Upload failed for VPS ID ${vpsId}`);
        }

        publishedCount += notes.length;
      }

      this.logger.info('Publishing completed successfully', {
        publishedCount,
      });
      progress?.finish();

      return { type: 'success', publishedCount, notes: publishable };
    } catch (error) {
      this.logger.error('Error during publishing', error);
      progress?.finish();
      return { type: 'error', error };
    }
  }

  private extractFileNameWithoutExt(path: string): string {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex === -1) {
      return fileName;
    }

    return fileName.substring(0, dotIndex);
  }
}
