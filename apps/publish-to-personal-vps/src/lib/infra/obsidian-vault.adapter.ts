import type { CollectedNote } from '@core-domain/entities/collected-note';
import { App, TAbstractFile, TFile, TFolder } from 'obsidian';
import type { FolderConfig } from '@core-domain/entities/folder-config';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { VaultPort } from '@core-domain/ports/vault-port';
import { GuidGeneratorPort } from '@core-domain/ports/guid-generator-port';
import { VpsConfig } from '@core-domain';

export class ObsidianVaultAdapter implements VaultPort<CollectedNote[]> {
  private readonly logger: LoggerPort;

  constructor(
    private readonly app: App,
    private readonly guidGenerator: GuidGeneratorPort,
    logger: LoggerPort
  ) {
    this.logger = logger;
    this.logger.debug('ObsidianVaultAdapter initialized');
  }

  async collectFromFolder(params: { folderConfig: FolderConfig[] }): Promise<CollectedNote[]> {
    const { folderConfig } = params;
    const result: CollectedNote[] = [];

    for (const cfg of folderConfig) {
      const rootPath = cfg.vaultFolder?.trim();
      if (!rootPath) {
        this.logger.warn('No rootPath specified in FolderConfig', { folderCfg: cfg });
        continue;
      }

      const root = this.app.vault.getAbstractFileByPath(rootPath);
      if (!root) {
        this.logger.warn('Root folder not found in vault', { rootPath });
        continue;
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
          const frontmatter: Record<string, any> = (cache?.frontmatter as any) ?? {};

          result.push({
            noteId: this.guidGenerator.generateGuid(),
            title: node.basename,
            vaultPath: node.path,
            relativePath: this.computeRelative(node.path, rootPath),
            content,
            frontmatter: { flat: frontmatter, nested: {}, tags: [] },
            folderConfig: cfg,
          });
          this.logger.info('Collected note', { path: node.path });
        }
      };

      this.logger.info('Starting note collection', { rootPath });
      await walk(root);
      this.logger.info('Finished note collection for folder', {
        rootPath,
      });
    }

    this.logger.info('Total notes collected', { count: result.length });
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
