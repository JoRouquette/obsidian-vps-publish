import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { FolderConfig } from '@core-domain/entities/folder-config';
import type { RouteNode, RouteTreeConfig } from '@core-domain/entities/route-node';
import type { CancellationPort } from '@core-domain/ports/cancellation-port';
import { type GuidGeneratorPort } from '@core-domain/ports/guid-generator-port';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import type { VaultPort } from '@core-domain/ports/vault-port';
import { type App, type TAbstractFile, TFile, TFolder } from 'obsidian';

/**
 * Yield to event loop helper
 */
async function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class ObsidianVaultAdapter implements VaultPort<CollectedNote[]> {
  private readonly logger: LoggerPort;
  private readonly customIndexFiles: Set<string> = new Set();

  constructor(
    private readonly app: App,
    private readonly guidGenerator: GuidGeneratorPort,
    logger: LoggerPort,
    private readonly customRootIndexFile?: string
  ) {
    this.logger = logger;
    this.logger.debug('ObsidianVaultAdapter initialized', { customRootIndexFile });

    // Add root index to exclusion list
    if (customRootIndexFile) {
      this.customIndexFiles.add(this.normalizePath(customRootIndexFile));
    }
  }

  async collectFromFolder(
    params: { folderConfig: FolderConfig[] },
    cancellation?: CancellationPort
  ): Promise<CollectedNote[]> {
    const { folderConfig } = params;
    const result: CollectedNote[] = [];

    // Check for cancellation before starting
    cancellation?.throwIfCancelled();

    // Build list of custom index files (for special handling, not exclusion)
    for (const cfg of folderConfig) {
      if (cfg.customIndexFile) {
        this.customIndexFiles.add(this.normalizePath(cfg.customIndexFile));
      }
    }

    if (this.customIndexFiles.size > 0) {
      this.logger.debug('Custom index files detected for special handling', {
        count: this.customIndexFiles.size,
        files: Array.from(this.customIndexFiles),
      });
    }

    // Collect custom root index file first (if configured)
    if (this.customRootIndexFile) {
      cancellation?.throwIfCancelled();

      const rootIndexFile = this.app.vault.getAbstractFileByPath(this.customRootIndexFile);
      if (rootIndexFile && rootIndexFile instanceof TFile) {
        this.logger.debug('Collecting custom root index file', { path: this.customRootIndexFile });
        const rawContent = await this.app.vault.read(rootIndexFile);
        const cache = this.app.metadataCache.getFileCache(rootIndexFile);
        const frontmatter: Record<string, unknown> =
          (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

        const content = this.stripFrontmatter(rawContent);

        result.push({
          noteId: this.guidGenerator.generateGuid(),
          title: rootIndexFile.basename,
          vaultPath: rootIndexFile.path,
          relativePath: rootIndexFile.path, // Root file has no relative path
          content,
          frontmatter: { flat: frontmatter, nested: {}, tags: [] },
          folderConfig: {
            id: 'root-index',
            vpsId: '', // Will be filled by plugin main
            vaultFolder: '',
            routeBase: '/',
            ignoredCleanupRuleIds: [],
          },
        });

        this.logger.debug('Collected custom root index file', {
          path: rootIndexFile.path,
          originalLength: rawContent.length,
          strippedLength: content.length,
        });
      } else {
        this.logger.warn('Custom root index file not found in vault', {
          customRootIndexFile: this.customRootIndexFile,
        });
      }
    }

    for (const cfg of folderConfig) {
      const rootPath = cfg.vaultFolder?.trim();
      if (!rootPath) {
        this.logger.warn('No rootPath specified in FolderConfig', { folderCfg: cfg });
        continue;
      }

      cancellation?.throwIfCancelled();

      const root = this.app.vault.getAbstractFileByPath(rootPath);
      if (!root) {
        this.logger.warn('Root folder not found in vault', { rootPath });
        continue;
      }

      let fileCount = 0;
      const walk = async (node: TAbstractFile) => {
        // Check for cancellation periodically
        cancellation?.throwIfCancelled();

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

          // Yield to event loop every 10 files to keep UI responsive
          fileCount++;
          if (fileCount % 10 === 0) {
            await yieldToEventLoop();
          }
        }
      };

      this.logger.debug('Starting note collection', { rootPath });
      await walk(root);
      this.logger.debug('Finished note collection for folder', {
        rootPath,
      });

      // Collect custom index file for this folder (if configured and not already collected)
      if (cfg.customIndexFile) {
        cancellation?.throwIfCancelled();

        const customIndexPath = this.normalizePath(cfg.customIndexFile);
        const alreadyCollected = result.some((note) => note.vaultPath === customIndexPath);

        if (!alreadyCollected) {
          const customIndexFile = this.app.vault.getAbstractFileByPath(customIndexPath);
          if (customIndexFile && customIndexFile instanceof TFile) {
            this.logger.debug('Collecting custom index file for folder (outside vaultFolder)', {
              folderPath: rootPath,
              customIndexPath,
            });
            const rawContent = await this.app.vault.read(customIndexFile);
            const cache = this.app.metadataCache.getFileCache(customIndexFile);
            const frontmatter: Record<string, unknown> =
              (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

            const content = this.stripFrontmatter(rawContent);

            result.push({
              noteId: this.guidGenerator.generateGuid(),
              title: customIndexFile.basename,
              vaultPath: customIndexFile.path,
              relativePath: this.computeRelative(customIndexFile.path, rootPath),
              content,
              frontmatter: { flat: frontmatter, nested: {}, tags: [] },
              folderConfig: cfg,
            });

            this.logger.debug('Collected custom index file', {
              path: customIndexFile.path,
              originalLength: rawContent.length,
              strippedLength: content.length,
            });
          } else {
            this.logger.warn('Custom index file not found in vault', {
              folderPath: rootPath,
              customIndexFile: cfg.customIndexFile,
            });
          }
        } else {
          this.logger.debug('Custom index file already collected from vaultFolder', {
            customIndexPath,
          });
        }
      }

      // Collect additional files for this folder (if configured and not already collected)
      // These files are marked for "root-of-route" treatment via a special marker in relativePath
      if (cfg.additionalFiles && cfg.additionalFiles.length > 0) {
        cancellation?.throwIfCancelled();

        for (const additionalFilePath of cfg.additionalFiles) {
          const normalizedPath = this.normalizePath(additionalFilePath);
          const alreadyCollected = result.some((note) => note.vaultPath === normalizedPath);

          if (alreadyCollected) {
            this.logger.debug('Additional file already collected (skipping duplicate)', {
              folderId: cfg.id,
              filePath: normalizedPath,
            });
            continue;
          }

          const additionalFile = this.app.vault.getAbstractFileByPath(normalizedPath);
          if (additionalFile && additionalFile instanceof TFile) {
            this.logger.debug('Collecting additional file for folder', {
              folderId: cfg.id,
              filePath: normalizedPath,
            });

            const rawContent = await this.app.vault.read(additionalFile);
            const cache = this.app.metadataCache.getFileCache(additionalFile);
            const frontmatter: Record<string, unknown> =
              (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

            const content = this.stripFrontmatter(rawContent);

            // Mark this note as an "additional file" by using a special relativePath
            // This will be detected by routing service to force root-of-route treatment
            result.push({
              noteId: this.guidGenerator.generateGuid(),
              title: additionalFile.basename,
              vaultPath: additionalFile.path,
              // Special marker: prefix with __additional__ to signal root-of-route treatment
              relativePath: `__additional__/${additionalFile.basename}`,
              content,
              frontmatter: { flat: frontmatter, nested: {}, tags: [] },
              folderConfig: cfg,
            });

            this.logger.debug('Collected additional file', {
              path: additionalFile.path,
              originalLength: rawContent.length,
              strippedLength: content.length,
            });
          } else {
            this.logger.warn('Additional file not found in vault (ignoring)', {
              folderId: cfg.id,
              filePath: normalizedPath,
            });
          }
        }
      }
    }

    this.logger.debug('Total notes collected', { count: result.length });
    return result;
  }

  /**
   * Collects notes from a route tree configuration (new route-first approach).
   * Supports both folder-based nodes and pure route nodes (without vaultFolder).
   */
  async collectFromRouteTree(
    params: { routeTree: RouteTreeConfig; vpsId: string },
    cancellation?: CancellationPort
  ): Promise<CollectedNote[]> {
    const { routeTree, vpsId } = params;
    const result: CollectedNote[] = [];

    cancellation?.throwIfCancelled();

    this.logger.debug('Starting route tree collection', {
      rootCount: routeTree.roots.length,
      vpsId,
    });

    // Collect custom root index file first (if configured)
    if (this.customRootIndexFile) {
      cancellation?.throwIfCancelled();

      const rootIndexFile = this.app.vault.getAbstractFileByPath(this.customRootIndexFile);
      if (rootIndexFile && rootIndexFile instanceof TFile) {
        this.logger.debug('Collecting custom root index file', { path: this.customRootIndexFile });
        const rawContent = await this.app.vault.read(rootIndexFile);
        const cache = this.app.metadataCache.getFileCache(rootIndexFile);
        const frontmatter: Record<string, unknown> =
          (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

        const content = this.stripFrontmatter(rawContent);

        result.push({
          noteId: this.guidGenerator.generateGuid(),
          title: rootIndexFile.basename,
          vaultPath: rootIndexFile.path,
          relativePath: rootIndexFile.path,
          content,
          frontmatter: { flat: frontmatter, nested: {}, tags: [] },
          folderConfig: {
            id: 'root-index',
            vpsId,
            vaultFolder: '',
            routeBase: '/',
            ignoredCleanupRuleIds: [],
          },
        });

        this.logger.debug('Collected custom root index file', {
          path: rootIndexFile.path,
        });
      }
    }

    // Traverse each root node recursively
    for (const rootNode of routeTree.roots) {
      await this.traverseRouteNode(rootNode, '', vpsId, result, cancellation);
    }

    this.logger.debug('Total notes collected from route tree', { count: result.length });
    return result;
  }

  /**
   * Recursively traverses a route node and its children.
   * @param node Current route node
   * @param parentRoutePath Accumulated route path from parent nodes
   * @param vpsId VPS identifier
   * @param result Array to accumulate collected notes
   * @param cancellation Cancellation token
   */
  private async traverseRouteNode(
    node: RouteNode,
    parentRoutePath: string,
    vpsId: string,
    result: CollectedNote[],
    cancellation?: CancellationPort
  ): Promise<void> {
    cancellation?.throwIfCancelled();

    // Build current route path
    const currentRoutePath = parentRoutePath
      ? `${parentRoutePath}/${node.segment}`
      : `/${node.segment}`;

    this.logger.debug('Traversing route node', {
      segment: node.segment,
      routePath: currentRoutePath,
      hasFolder: !!node.vaultFolder,
      hasFlattenTree: node.flattenTree,
    });

    // Create a FolderConfig-like object for compatibility with existing code
    const folderConfig: FolderConfig = {
      id: node.id,
      vpsId,
      vaultFolder: node.vaultFolder || '',
      routeBase: currentRoutePath,
      customIndexFile: node.customIndexFile,
      additionalFiles: node.additionalFiles,
      flattenTree: node.flattenTree,
      ignoredCleanupRuleIds: node.ignoredCleanupRuleIds || [],
    };

    // If node has a vaultFolder, collect notes from it
    if (node.vaultFolder) {
      const rootPath = node.vaultFolder.trim();
      const root = this.app.vault.getAbstractFileByPath(rootPath);

      if (!root) {
        this.logger.warn('Vault folder not found for route node', {
          routePath: currentRoutePath,
          vaultFolder: rootPath,
        });
      } else {
        // Collect notes from this folder
        let fileCount = 0;
        const walk = async (fileNode: TAbstractFile) => {
          cancellation?.throwIfCancelled();

          if (fileNode instanceof TFolder) {
            for (const child of fileNode.children) {
              await walk(child);
            }
          } else if (fileNode instanceof TFile) {
            if ((fileNode.extension || '').toLowerCase() !== 'md') {
              return;
            }

            const rawContent = await this.app.vault.read(fileNode);
            const cache = this.app.metadataCache.getFileCache(fileNode);
            const frontmatter: Record<string, unknown> =
              (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

            const content = this.stripFrontmatter(rawContent);

            result.push({
              noteId: this.guidGenerator.generateGuid(),
              title: fileNode.basename,
              vaultPath: fileNode.path,
              relativePath: this.computeRelative(fileNode.path, rootPath),
              content,
              frontmatter: { flat: frontmatter, nested: {}, tags: [] },
              folderConfig,
            });

            fileCount++;
            if (fileCount % 10 === 0) {
              await yieldToEventLoop();
            }
          }
        };

        await walk(root);
        this.logger.debug('Collected notes from route node folder', {
          routePath: currentRoutePath,
          fileCount,
        });
      }

      // Collect custom index file if configured and not already collected
      if (node.customIndexFile) {
        const customIndexPath = this.normalizePath(node.customIndexFile);
        const alreadyCollected = result.some((note) => note.vaultPath === customIndexPath);

        if (!alreadyCollected) {
          const customIndexFile = this.app.vault.getAbstractFileByPath(customIndexPath);
          if (customIndexFile && customIndexFile instanceof TFile) {
            const rawContent = await this.app.vault.read(customIndexFile);
            const cache = this.app.metadataCache.getFileCache(customIndexFile);
            const frontmatter: Record<string, unknown> =
              (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

            const content = this.stripFrontmatter(rawContent);

            result.push({
              noteId: this.guidGenerator.generateGuid(),
              title: customIndexFile.basename,
              vaultPath: customIndexFile.path,
              relativePath: this.computeRelative(customIndexFile.path, rootPath),
              content,
              frontmatter: { flat: frontmatter, nested: {}, tags: [] },
              folderConfig,
            });

            this.logger.debug('Collected custom index file for route node', {
              routePath: currentRoutePath,
              customIndexPath,
            });
          }
        }
      }

      // Collect additional files if configured
      if (node.additionalFiles && node.additionalFiles.length > 0) {
        for (const additionalFilePath of node.additionalFiles) {
          const normalizedPath = this.normalizePath(additionalFilePath);
          const alreadyCollected = result.some((note) => note.vaultPath === normalizedPath);

          if (alreadyCollected) {
            continue;
          }

          const additionalFile = this.app.vault.getAbstractFileByPath(normalizedPath);
          if (additionalFile && additionalFile instanceof TFile) {
            const rawContent = await this.app.vault.read(additionalFile);
            const cache = this.app.metadataCache.getFileCache(additionalFile);
            const frontmatter: Record<string, unknown> =
              (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

            const content = this.stripFrontmatter(rawContent);

            result.push({
              noteId: this.guidGenerator.generateGuid(),
              title: additionalFile.basename,
              vaultPath: additionalFile.path,
              relativePath: `__additional__/${additionalFile.basename}`,
              content,
              frontmatter: { flat: frontmatter, nested: {}, tags: [] },
              folderConfig,
            });

            this.logger.debug('Collected additional file for route node', {
              routePath: currentRoutePath,
              filePath: normalizedPath,
            });
          }
        }
      }
    } else {
      // Pure route node (no vaultFolder)
      // Still collect customIndexFile and additionalFiles if present
      this.logger.debug('Processing pure route node (no vaultFolder)', {
        routePath: currentRoutePath,
        hasCustomIndex: !!node.customIndexFile,
        hasAdditionalFiles: (node.additionalFiles?.length || 0) > 0,
      });

      // Collect custom index file
      if (node.customIndexFile) {
        const customIndexPath = this.normalizePath(node.customIndexFile);
        const customIndexFile = this.app.vault.getAbstractFileByPath(customIndexPath);

        if (customIndexFile && customIndexFile instanceof TFile) {
          const rawContent = await this.app.vault.read(customIndexFile);
          const cache = this.app.metadataCache.getFileCache(customIndexFile);
          const frontmatter: Record<string, unknown> =
            (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

          const content = this.stripFrontmatter(rawContent);

          result.push({
            noteId: this.guidGenerator.generateGuid(),
            title: customIndexFile.basename,
            vaultPath: customIndexFile.path,
            relativePath: customIndexFile.path, // Pure route uses absolute path
            content,
            frontmatter: { flat: frontmatter, nested: {}, tags: [] },
            folderConfig,
          });

          this.logger.debug('Collected custom index for pure route node', {
            routePath: currentRoutePath,
            customIndexPath,
          });
        }
      }

      // Collect additional files
      if (node.additionalFiles && node.additionalFiles.length > 0) {
        for (const additionalFilePath of node.additionalFiles) {
          const normalizedPath = this.normalizePath(additionalFilePath);
          const additionalFile = this.app.vault.getAbstractFileByPath(normalizedPath);

          if (additionalFile && additionalFile instanceof TFile) {
            const rawContent = await this.app.vault.read(additionalFile);
            const cache = this.app.metadataCache.getFileCache(additionalFile);
            const frontmatter: Record<string, unknown> =
              (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};

            const content = this.stripFrontmatter(rawContent);

            result.push({
              noteId: this.guidGenerator.generateGuid(),
              title: additionalFile.basename,
              vaultPath: additionalFile.path,
              relativePath: `__additional__/${additionalFile.basename}`,
              content,
              frontmatter: { flat: frontmatter, nested: {}, tags: [] },
              folderConfig,
            });

            this.logger.debug('Collected additional file for pure route node', {
              routePath: currentRoutePath,
              filePath: normalizedPath,
            });
          }
        }
      }
    }

    // Recursively traverse children
    if (node.children && node.children.length > 0) {
      for (const childNode of node.children) {
        await this.traverseRouteNode(childNode, currentRoutePath, vpsId, result, cancellation);
      }
    }
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
   * Normalizes a file path for comparison (removes leading/trailing slashes).
   */
  private normalizePath(path: string): string {
    return path.replace(/^\/+|\/+$/g, '');
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
