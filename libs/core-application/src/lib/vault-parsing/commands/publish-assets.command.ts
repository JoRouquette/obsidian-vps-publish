import type { AssetRef } from '@core-domain/entities/asset-ref';
import {
  extractNotesWithAssets,
  type NoteWithAssets,
} from '@core-domain/entities/note-with-assets';
import type { ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
import type { AssetsVaultPort } from '@core-domain/ports/assets-vault-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type { UploaderPort } from '@core-domain/ports/uploader-port';

import { CommandHandler } from '../../common/command-handler';

export type AssetPublishFailureReason = 'not-found' | 'upload-error' | 'resolve-error';

export interface AssetPublishFailure {
  noteId: string;
  asset: AssetRef;
  reason: AssetPublishFailureReason;
  error?: unknown;
}

export type AssetsPublicationResult =
  | {
      type: 'success';
      publishedAssetsCount: number;
      failures: AssetPublishFailure[];
    }
  | { type: 'noAssets' }
  | { type: 'error'; error: unknown };

export interface PublishAssetsCommand {
  notes: NoteWithAssets[] | Array<unknown>; // tolérant, on refiltre derrière
  assetsFolder: string;
  enableAssetsVaultFallback: boolean;
  progress?: ProgressPort;
}

export class PublishAssetsCommandHandler
  implements CommandHandler<PublishAssetsCommand, AssetsPublicationResult>
{
  private readonly _logger: LoggerPort;

  constructor(
    private readonly assetsVaultPort: AssetsVaultPort,
    private readonly assetsUploaderPort: UploaderPort,
    logger: LoggerPort
  ) {
    this._logger = logger.child({
      usecase: 'PublishAssetsToSiteUseCase',
    });
  }

  async handle(command: PublishAssetsCommand): Promise<AssetsPublicationResult> {
    const { notes, assetsFolder, enableAssetsVaultFallback, progress } = command;

    const notesWithAssets = extractNotesWithAssets(notes as any as NoteWithAssets[]);

    this._logger.info(
      `Starting asset publication for ${notesWithAssets.length} notes (assetsFolder=${assetsFolder}, enableAssetsVaultFallback=${enableAssetsVaultFallback})`
    );

    if (notesWithAssets.length === 0) {
      this._logger.info('No notes with assets found, nothing to publish.');
      return { type: 'noAssets' };
    }

    const failures: AssetPublishFailure[] = [];
    const resolvedEntries: Array<{
      noteId: string;
      asset: AssetRef;
      file: ResolvedAssetFile | null;
    }> = [];

    for (const note of notesWithAssets) {
      for (const asset of note.assets) {
        try {
          this._logger.debug(`Resolving asset for noteId ${note.noteId} asset: `, asset);

          const file = await this.assetsVaultPort.resolveAssetForNote(
            note,
            asset,
            assetsFolder,
            enableAssetsVaultFallback
          );

          resolvedEntries.push({ noteId: note.noteId, asset, file });

          this._logger.debug(`Resolved asset for noteId ${note.noteId} -> found=${!!file}`);
        } catch (error) {
          this._logger.warn(`Failed to resolve asset for noteId ${note.noteId}`, { asset, error });
          failures.push({
            noteId: note.noteId,
            asset,
            reason: 'resolve-error',
            error,
          });
        }
      }
    }

    for (const entry of resolvedEntries) {
      if (!entry.file) {
        failures.push({
          noteId: entry.noteId,
          asset: entry.asset,
          reason: 'not-found',
        });
      }
    }

    const uniqueByVaultPath = new Map<string, ResolvedAssetFile>();

    for (const entry of resolvedEntries) {
      if (!entry.file) continue;
      if (!uniqueByVaultPath.has(entry.file.vaultPath)) {
        uniqueByVaultPath.set(entry.file.vaultPath, entry.file);
      }
    }

    const uniqueAssets = Array.from(uniqueByVaultPath.values());

    if (uniqueAssets.length === 0) {
      this._logger.info(`No assets resolved to files. Failures count=${failures.length}`);
      return {
        type: 'success',
        publishedAssetsCount: 0,
        failures,
      };
    }

    progress?.start(uniqueAssets.length);
    this._logger.info(`Uploading ${uniqueAssets.length} unique asset file(s)...`);

    try {
      const success = await this.assetsUploaderPort.upload(uniqueAssets);

      if (!success) {
        this._logger.error('Assets uploader reported failure for the whole batch');
        progress?.finish();
        return {
          type: 'error',
          error: new Error('Assets uploader reported failure'),
        };
      }

      progress?.advance(uniqueAssets.length);
      progress?.finish();

      this._logger.info(
        `Asset publication finished: ${uniqueAssets.length} assets uploaded, ${failures.length} failure(s) during resolution`
      );

      return {
        type: 'success',
        publishedAssetsCount: uniqueAssets.length,
        failures,
      };
    } catch (error) {
      progress?.finish();
      this._logger.error('Unexpected error during asset publication: ', error);
      return { type: 'error', error };
    }
  }
}
