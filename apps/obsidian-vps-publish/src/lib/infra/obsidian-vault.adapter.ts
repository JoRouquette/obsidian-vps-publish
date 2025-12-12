import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { FolderConfig } from '@core-domain/entities/folder-config';
import { type GuidGeneratorPort } from '@core-domain/ports/guid-generator-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { VaultPort } from '@core-domain/ports/vault-port';
import { type App, type TAbstractFile, TFile, TFolder } from 'obsidian';

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
          const rawContent = await this.app.vault.read(node);
          const cache = this.app.metadataCache.getFileCache(node);
          const frontmatter: Record<string, unknown> =
            (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

          // Strip YAML frontmatter from content before sending to backend
          // Frontmatter is already parsed into the 'frontmatter' field
          const content = this.stripFrontmatter(rawContent);

          result.push({
            noteId: this.guidGenerator.generateGuid(),
            title: node.basename,
            vaultPath: node.path,
            relativePath: this.computeRelative(node.path, rootPath),
            content,
            frontmatter: { flat: frontmatter, nested: {}, tags: [] },
            folderConfig: cfg,
          });
          this.logger.debug('Collected note', {
            path: node.path,
            originalLength: rawContent.length,
            strippedLength: content.length,
          });
        }
      };

      this.logger.debug('Starting note collection', { rootPath });
      await walk(root);
      this.logger.debug('Finished note collection for folder', {
        rootPath,
      });
    }

    this.logger.debug('Total notes collected', { count: result.length });
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

  /**
   * Strips YAML frontmatter from markdown content.
   * Matches frontmatter anywhere in the content (not just at the start),
   * since Obsidian may place it after headers.
   */
  private stripFrontmatter(content: string): string {
    // Use multiline flag to match ^--- at any line start
    const fmRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/m;
    if (fmRegex.test(content)) {
      const stripped = content.replace(fmRegex, '');
      this.logger.debug('Stripped YAML frontmatter from content (plugin-side)', {
        originalLength: content.length,
        strippedLength: stripped.length,
      });
      return stripped;
    }
    this.logger.debug('No YAML frontmatter found in content to strip (plugin-side)');
    return content;
  }
}
