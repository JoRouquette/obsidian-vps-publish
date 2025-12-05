import { type AssetRef } from '@core-domain/entities/asset-ref';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import { type ResolvedAssetFile } from '@core-domain/entities/resolved-asset-file';
import { type AssetsVaultPort } from '@core-domain/ports/assets-vault-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { type App, type TFile } from 'obsidian';

export class ObsidianAssetsVaultAdapter implements AssetsVaultPort {
  private readonly _logger: LoggerPort;

  constructor(
    private readonly app: App,
    logger: LoggerPort
  ) {
    this._logger = logger.child({ adapter: 'ObsidianAssetsVaultAdapter' });
    this._logger.debug('ObsidianAssetsVaultAdapter initialized');
  }

  async resolveAssetsFromNotes(
    notes: PublishableNote[],
    assetsFolder: string,
    enableVaultFallback: boolean
  ): Promise<ResolvedAssetFile[]> {
    const normalizedAssetsFolder = this.normalizeFolder(assetsFolder);
    const allFiles = this.app.vault.getFiles();
    const resolvedAssets: ResolvedAssetFile[] = [];

    for (const note of notes) {
      if (!note.assets || !Array.isArray(note.assets) || note.assets.length === 0) {
        this._logger.debug('No assets found in note', { noteVaultPath: note.vaultPath });
        continue;
      }

      for (const asset of note.assets) {
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
          continue;
        }

        const normalizedTarget = this.normalizeTarget(target);

        this._logger.debug('Searching for asset target', {
          target: normalizedTarget,
          assetsFolder: normalizedAssetsFolder,
          note: note.vaultPath,
        });

        const baseName = normalizedTarget.split('/').pop() ?? normalizedTarget;

        // 2. Recherche prioritaire dans le dossier d’assets
        let file: TFile | undefined;

        if (normalizedAssetsFolder) {
          file = allFiles.find((f) => {
            if (!this.isUnderFolder(f.path, normalizedAssetsFolder)) return false;

            if (f.path.endsWith('/' + normalizedTarget) || f.path === normalizedTarget) return true;

            return f.name === baseName;
          });

          if (file) {
            this._logger.info('Asset found in assets folder', {
              filePath: file.path,
              assetsFolder: normalizedAssetsFolder,
            });
          } else {
            this._logger.debug('Asset not found in assets folder, will try fallback if enabled', {
              target,
              assetsFolder: normalizedAssetsFolder,
            });
          }
        }

        // 3. Fallback : tout le vault
        if (!file && enableVaultFallback) {
          file = allFiles.find((f) => {
            if (f.path.endsWith('/' + normalizedTarget) || f.path === normalizedTarget) return true;
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
          continue;
        }

        // 4. Lecture binaire
        this._logger.debug('Reading binary content for asset', {
          filePath: file.path,
        });

        const content = await this.app.vault.readBinary(file);

        const relativeAssetPath =
          normalizedTarget || this.computeRelativeAssetPath(file.path, normalizedAssetsFolder);

        const resolved: ResolvedAssetFile = {
          vaultPath: file.path,
          fileName: file.name,
          relativeAssetPath,
          content,
          mimeType: undefined,
        };

        this._logger.debug('Resolved asset file', { resolved });

        resolvedAssets.push(resolved);
      }
    }

    return resolvedAssets;
  }

  private extractLinkTarget(asset: AssetRef): string | null {
    this._logger.debug('Extracting link target from asset', { asset });
    const assetWithExtras = asset as AssetRef & {
      fileName?: unknown;
      linkText?: unknown;
    };

    if (typeof assetWithExtras.fileName === 'string' && assetWithExtras.fileName.trim()) {
      const v = assetWithExtras.fileName.trim();
      this._logger.debug('Link target found via fileName', { fileName: v });
      return v;
    }

    if (typeof assetWithExtras.target === 'string' && assetWithExtras.target.trim()) {
      const v = assetWithExtras.target.trim();
      this._logger.debug('Link target found via target', { target: v });
      return v;
    }

    if (typeof assetWithExtras.linkText === 'string' && assetWithExtras.linkText.trim()) {
      const v = assetWithExtras.linkText.trim();
      this._logger.debug('Link target found via linkText', { linkText: v });
      return v;
    }

    if (typeof assetWithExtras.raw === 'string') {
      const raw: string = assetWithExtras.raw;
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

  // helpers identiques
  private normalizeFolder(folder: string | null | undefined): string {
    if (!folder) return '';
    let f = folder.trim().replace(/\\/g, '/');
    if (f.startsWith('/')) f = f.slice(1);
    if (f.endsWith('/')) f = f.slice(0, -1);
    return f;
  }

  private isUnderFolder(path: string, folder: string): boolean {
    if (!folder) return false;
    const p = path.replace(/\\/g, '/');
    return p === folder || p.startsWith(folder + '/');
  }

  private computeRelativeAssetPath(filePath: string, normalizedAssetsFolder: string): string {
    const p = filePath.replace(/\\/g, '/');
    if (!normalizedAssetsFolder) return p;

    if (p === normalizedAssetsFolder) return '';
    if (p.startsWith(normalizedAssetsFolder + '/')) {
      return p.slice(normalizedAssetsFolder.length + 1);
    }

    return p;
  }

  private normalizeTarget(target: string): string {
    if (!target) return '';
    let t = target.trim().replace(/\\/g, '/');
    t = t.replace(/^\.\/+/, '');
    t = t.replace(/^\/+/, '');
    return t;
  }
}
