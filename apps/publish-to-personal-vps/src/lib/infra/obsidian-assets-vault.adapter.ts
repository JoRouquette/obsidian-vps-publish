import { AssetRef } from '@core-domain/entities/asset-ref';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import { ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
import { AssetsVaultPort } from '@core-domain/ports/assets-vault-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { App, TFile } from 'obsidian';

export class ObsidianAssetsVaultAdapter implements AssetsVaultPort {
  private readonly _logger: LoggerPort;

  constructor(private readonly app: App, logger: LoggerPort) {
    this._logger = logger.child({ adapter: 'ObsidianAssetsVaultAdapter' });
    this._logger.debug('ObsidianAssetsVaultAdapter initialized');
  }

  async resolveAssetForNote(
    note: PublishableNote,
    asset: AssetRef,
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile | null> {
    const normalizedAssetsFolder = normalizeFolder(assetsFolder);

    this._logger.debug('Resolving asset for note', {
      noteVaultPath: note.vaultPath,
      asset,
      assetsFolder: normalizedAssetsFolder,
      enableVaultFallback,
    });

    // 1. Déterminer la cible textuelle
    const target = this.extractLinkTarget(asset);
    if (!target) {
      this._logger.warn('Unable to extract link target from asset', asset);
      return null;
    }

    const allFiles = this.app.vault.getFiles();

    this._logger.debug('Searching for asset target', {
      target,
      assetsFolder: normalizedAssetsFolder,
      note: note.vaultPath,
    });

    const baseName = target.split('/').pop() ?? target;

    // 2. Recherche prioritaire dans le dossier d’assets
    let file: TFile | undefined;

    if (normalizedAssetsFolder) {
      file = allFiles.find((f) => {
        if (!isUnderFolder(f.path, normalizedAssetsFolder)) return false;

        if (f.path.endsWith('/' + target) || f.path === target) return true;

        return f.name === baseName;
      });

      if (file) {
        this._logger.info('Asset found in assets folder', {
          filePath: file.path,
          assetsFolder: normalizedAssetsFolder,
        });
      } else {
        this._logger.debug(
          'Asset not found in assets folder, will try fallback if enabled',
          { target, assetsFolder: normalizedAssetsFolder }
        );
      }
    }

    // 3. Fallback : tout le vault
    if (!file && enableVaultFallback) {
      file = allFiles.find((f) => {
        if (f.path.endsWith('/' + target) || f.path === target) return true;
        return f.name === baseName;
      });

      if (file) {
        this._logger.info('Asset found in vault (fallback)', {
          filePath: file.path,
        });
      } else {
        this._logger.debug('Asset not found in vault during fallback', {
          target,
        });
      }
    }

    if (!file) {
      this._logger.warn('Asset not found in vault', {
        target,
        note: note.vaultPath,
      });
      return null;
    }

    // 4. Lecture binaire
    this._logger.debug('Reading binary content for asset', {
      filePath: file.path,
    });

    const content = await this.app.vault.readBinary(file);

    const relativeAssetPath = computeRelativeAssetPath(
      file.path,
      normalizedAssetsFolder
    );

    const resolved: ResolvedAssetFile = {
      vaultPath: file.path,
      fileName: file.name,
      relativeAssetPath,
      content,
      // on laisse mimeType undefined : l’uploader le déduira via l’extension
      mimeType: undefined,
    };

    this._logger.debug('Resolved asset file', { resolved });

    return resolved;
  }

  private extractLinkTarget(asset: AssetRef): string | null {
    this._logger.debug('Extracting link target from asset', { asset });
    const anyAsset = asset as any;

    if (typeof anyAsset.fileName === 'string' && anyAsset.fileName.trim()) {
      const v = anyAsset.fileName.trim();
      this._logger.debug('Link target found via fileName', { fileName: v });
      return v;
    }

    if (typeof anyAsset.target === 'string' && anyAsset.target.trim()) {
      const v = anyAsset.target.trim();
      this._logger.debug('Link target found via target', { target: v });
      return v;
    }

    if (typeof anyAsset.linkText === 'string' && anyAsset.linkText.trim()) {
      const v = anyAsset.linkText.trim();
      this._logger.debug('Link target found via linkText', { linkText: v });
      return v;
    }

    if (typeof anyAsset.raw === 'string') {
      const raw: string = anyAsset.raw;
      const match = raw.match(/!\[\[([^\]]+)\]\]/);
      const inner = (match ? match[1] : raw).trim();

      if (!inner) {
        this._logger.warn('No inner content found in raw asset', { raw });
        return null;
      }

      const firstPart = inner.split('|')[0].trim();
      this._logger.debug('Extracted link target from raw', { firstPart });
      return firstPart || null;
    }

    this._logger.warn('Unable to extract link target from asset', { asset });
    return null;
  }
}

// helpers identiques
function normalizeFolder(folder: string | null | undefined): string {
  if (!folder) return '';
  let f = folder.trim().replace(/\\/g, '/');
  if (f.startsWith('/')) f = f.slice(1);
  if (f.endsWith('/')) f = f.slice(0, -1);
  return f;
}

function isUnderFolder(path: string, folder: string): boolean {
  if (!folder) return false;
  const p = path.replace(/\\/g, '/');
  return p === folder || p.startsWith(folder + '/');
}

function computeRelativeAssetPath(
  filePath: string,
  normalizedAssetsFolder: string
): string {
  const p = filePath.replace(/\\/g, '/');
  if (!normalizedAssetsFolder) return p;

  if (p === normalizedAssetsFolder) return '';
  if (p.startsWith(normalizedAssetsFolder + '/')) {
    return p.slice(normalizedAssetsFolder.length + 1);
  }

  return p;
}
