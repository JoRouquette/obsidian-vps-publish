import type { CollectedNote } from '@core-domain/publish/CollectedNote';
import type { ContentSanitizer } from '@core-domain/publish/ContentSanitizer';
import type { FolderConfig } from '@core-domain/publish/FolderConfig';
import type { PublishableNote } from '@core-domain/publish/PublishableNote';
import type { PublishPluginSettings } from '@core-domain/publish/PublishPluginSettings';
import { DefaultContentSanitizer } from '../services/default-content-sanitizer';
import type { UploaderPort } from '@core-domain/publish/uploader-port';
import type { GuidGeneratorPort } from '@core-domain/publish/ports/guid-generator-port';
import { LogLevel, type LoggerPort } from '@core-domain/publish/ports/logger-port';
import type { ProgressPort } from '@core-domain/publish/ports/progress-port';
import type { VaultPort } from '@core-domain/publish/ports/vault-port';
import { ComputeRoutingUseCase } from './compute-routing.usecase';
import { DetectAssetsUseCase } from './detect-assets.usecase';
import { DetectWikilinksUseCase } from './detect-wikilinks.usecase';
import { EvaluateIgnoreRulesUseCase } from './evaluate-ignore-rules.usecase';
import { NormalizeFrontmatterUseCase } from './normalize-frontmatter.usecase';
import { RenderInlineDataviewUseCase } from './render-inline-dataview.usecase';
import { ResolveWikilinksUseCase } from './resolve-wikilinks-usecase';

export type PublicationResult =
  | { type: 'success'; publishedCount: number; notes: PublishableNote[] }
  | { type: 'noConfig' }
  | { type: 'missingVpsConfig'; foldersWithoutVps: string[] }
  | { type: 'error'; error: unknown };

/**
 * Orchestrateur principal de composition de notes et d'envoi.
 *
 * Par note :
 *  1. Normalize frontmatter -> DomainFrontmatter
 *  2. EvaluateIgnoreRules -> isPublishable
 *  3. Construction du NoteCore (PublishableNote "nu")
 *  4. Content pipeline :
 *      - RenderInlineDataviewUseCase
 *      - ContentSanitizer (SanitizeMarkdownUseCase)
 *  5. Note composition :
 *      - DetectAssetsUseCase
 *      - DetectWikilinksUseCase
 *      - ComputeRoutingUseCase
 *  6. Regroupement par VPS + upload
 *
 * La collecte physique des fichiers d'assets et la résolution effective
 * des wikilinks (ResolveWikilinksUseCase / CollectAssetsFileUseCase)
 * se font dans d'autres usecases de workflow sur la liste de notes publishable.
 */
export class PublishToSiteUseCase {
  private readonly normalizeFrontmatter: NormalizeFrontmatterUseCase;
  private readonly evaluateIgnoreRules: EvaluateIgnoreRulesUseCase;
  private readonly detectAssets: DetectAssetsUseCase;
  private readonly detectWikilinks: DetectWikilinksUseCase;
  private readonly resolveWikilinks: ResolveWikilinksUseCase;
  private readonly computeRouting: ComputeRoutingUseCase;
  private readonly renderInlineDataview: RenderInlineDataviewUseCase;

  constructor(
    private readonly vaultPort: VaultPort<CollectedNote[]>,
    private readonly uploaderPort: UploaderPort,
    private readonly guidGenerator: GuidGeneratorPort,
    private readonly logger: LoggerPort,
    private readonly contentSanitizer: ContentSanitizer = new DefaultContentSanitizer()
  ) {
    this.logger = logger.child(
      { usecase: 'PublishToSiteUseCase' },
      LogLevel.debug
    );
    this.logger.debug('PublishToSiteUseCase initialized');

    this.normalizeFrontmatter = new NormalizeFrontmatterUseCase(logger);
    this.evaluateIgnoreRules = new EvaluateIgnoreRulesUseCase(logger);
    this.detectAssets = new DetectAssetsUseCase(logger);
    this.detectWikilinks = new DetectWikilinksUseCase(logger);
    this.resolveWikilinks = new ResolveWikilinksUseCase(logger);
    this.computeRouting = new ComputeRoutingUseCase(logger);
    this.renderInlineDataview = new RenderInlineDataviewUseCase(logger);
  }

  async execute(
    settings: PublishPluginSettings,
    progress?: ProgressPort
  ): Promise<PublicationResult> {
    this.logger.info('Starting publish-to-site execution');

    if (!settings?.vpsConfigs?.length || !settings?.folders?.length) {
      this.logger.warn('No VPS configs or folders found in settings');
      return { type: 'noConfig' };
    }

    // Index VPS par id
    const vpsById = new Map<string, any>();
    for (const vps of settings.vpsConfigs) {
      if (vps && vps.id) vpsById.set(vps.id, vps);
    }

    const missingVps: string[] = [];
    const collected: Array<{
      vaultPath: string;
      relativePath: string;
      content: string;
      frontmatter: Record<string, unknown>;
      folder: FolderConfig;
      vpsConfig: any;
    }> = [];

    // Collecte brute
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

      this.logger.debug('Collecting notes from folder', {
        folderId: folder.id,
      });
      const notes = await this.vaultPort.collectFromFolder(folder);
      for (const n of notes) {
        collected.push({
          vaultPath: n.vaultPath,
          relativePath: n.relativePath,
          content: n.content,
          frontmatter: n.frontmatter ?? {},
          folder,
          vpsConfig,
        });
      }
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

    const publishable: PublishableNote[] = [];

    // Pipeline par note
    for (const raw of collected) {
      const notePipelineLogger = this.logger.child(
        { step: 'notePipeline', note: raw.vaultPath },
        this.logger.level
      );

      // normalize frontmatter
      const domainFrontmatter = this.normalizeFrontmatter.execute(
        raw.frontmatter
      );

      notePipelineLogger.debug('Normalized frontmatter', {
        vaultPath: raw.vaultPath,
        frontmatter: domainFrontmatter,
      });

      // ignore rules
      const eligibility = this.evaluateIgnoreRules.execute({
        frontmatter: domainFrontmatter,
        rules: settings.ignoreRules ?? null,
      });
      notePipelineLogger.debug('Ignore rules evaluation', {
        vaultPath: raw.vaultPath,
        eligibility,
      });

      if (!eligibility.isPublishable) {
        notePipelineLogger.debug('Note ignored by rules', {
          vaultPath: raw.vaultPath,
        });
        progress?.advance(1);
        continue;
      }

      // construire le noyau de note
      let note: PublishableNote = {
        noteId: this.guidGenerator.generateGuid(),
        title: this.extractFileNameWithoutExt(raw.vaultPath),
        vaultPath: raw.vaultPath,
        relativePath: raw.relativePath,
        content: raw.content,
        frontmatter: domainFrontmatter,
        folderConfig: raw.folder,
        vpsConfig: raw.vpsConfig,
      };

      // dataview inline
      note = this.renderInlineDataview.execute(note);

      // sanitize markdown
      note = this.contentSanitizer.sanitizeNote(note, raw.folder.sanitization);

      // assets
      note = this.detectAssets.execute(note);

      // wikilinks
      note = this.detectWikilinks.execute(note);

      // routing
      note = this.computeRouting.execute(note);

      notePipelineLogger.debug(`Note ${note.title} ready for publishing.`);
      notePipelineLogger.debug(JSON.stringify(note, null, 2));

      publishable.push(note);
      progress?.advance(1);
    }

    if (publishable.length === 0) {
      this.logger.info('No publishable notes after filtering');
      progress?.finish();
      return { type: 'success', publishedCount: 0, notes: [] };
    }

    // Regroupement par VPS et upload
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
