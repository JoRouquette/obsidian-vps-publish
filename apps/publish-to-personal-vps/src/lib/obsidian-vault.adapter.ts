import type { CollectedNote } from '@core-domain/publish/CollectedNote';
import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { FolderConfig } from '@core-domain/publish/FolderConfig';
import type { LoggerPort } from '@core-domain/publish/ports/logger-port';
import type { VaultPort } from '@core-domain/publish/ports/vault-port';

export class ObsidianVaultAdapter implements VaultPort<CollectedNote[]> {
  private readonly logger: LoggerPort;

  constructor(private readonly app: App, logger: LoggerPort) {
    this.logger = logger;
    this.logger.debug('ObsidianVaultAdapter initialized');
  }

  async collectFromFolder(folderCfg: FolderConfig): Promise<CollectedNote[]> {
    const result: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, any>;
    }> = [];

    const rootPath = folderCfg.vaultFolder?.trim();
    if (!rootPath) {
      this.logger.warn('No rootPath specified in FolderConfig', { folderCfg });
      return result;
    }

    const root = this.app.vault.getAbstractFileByPath(rootPath);
    if (!root) {
      this.logger.warn('Root folder not found in vault', { rootPath });
      return result;
    }

    const walk = async (node: TAbstractFile) => {
      if (node instanceof TFolder) {
        this.logger.debug('Walking folder', { path: node.path });
        for (const child of node.children) {
          await walk(child);
        }
      } else if (node instanceof TFile) {
        if ((node.extension || '').toLowerCase() !== 'md') {
          this.logger.debug('Skipping non-markdown file', { path: node.path });
          return;
        }

        this.logger.debug('Reading file', { path: node.path });
        const content = await this.app.vault.read(node);
        const cache = this.app.metadataCache.getFileCache(node);
        const frontmatter: Record<string, any> =
          (cache?.frontmatter as any) ?? {};

        result.push({
          vaultPath: node.path,
          relativePath: this.computeRelative(node.path, rootPath),
          content,
          frontmatter,
        });
        this.logger.info('Collected note', { path: node.path });
      }
    };

    this.logger.info('Starting note collection', { rootPath });
    await walk(root);
    this.logger.info('Finished note collection', {
      count: result.length,
      rootPath,
    });

    return result;
  }

  private computeRelative(filePath: string, folderPath: string): string {
    if (!folderPath) return filePath;
    if (filePath.startsWith(folderPath)) {
      let rel = filePath.slice(folderPath.length);
      rel = rel.replace(/^\/+/, '');
      return rel.length > 0 ? rel : '';
    }
    return filePath;
  }
}
