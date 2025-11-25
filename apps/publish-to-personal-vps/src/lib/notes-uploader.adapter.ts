import { DomainFrontmatter, FolderConfig } from '@core-domain/publish';
import { HttpResponseHandler } from '@core-application/publish/handler/http-response.handler';
import { requestUrl, RequestUrlResponse } from 'obsidian';
import type { PublishableNote } from '@core-domain/publish/PublishableNote';
import type { UploaderPort } from '@core-domain/publish/uploader-port';
import type { VpsConfig } from '@core-domain/publish/VpsConfig';
import type { LoggerPort } from '@core-domain/publish/ports/logger-port';

type ApiNote = {
  id: string;
  title: string;
  slug: string;
  route: string;
  relativePath?: string;
  vaultPath: string;
  markdown: string;
  frontmatter: {
    tags: string[];
  } & DomainFrontmatter;
  publishedAt: string;
};

export class NotesUploaderAdapter implements UploaderPort {
  private readonly _logger: LoggerPort;
  private readonly _handleResponse: HttpResponseHandler<RequestUrlResponse>;

  constructor(
    private readonly vpsConfig: VpsConfig,
    handleResponse: HttpResponseHandler<RequestUrlResponse>,
    logger: LoggerPort
  ) {
    this._logger = logger;
    this._handleResponse = handleResponse;
  }

  async upload(notes: PublishableNote[]): Promise<boolean> {
    if (!Array.isArray(notes) || notes.length === 0) {
      this._logger.info('No notes to upload.');
      return false;
    }

    const vps = (notes[0] as any).vpsConfig ?? this.vpsConfig;
    const apiKeyPlain = vps.apiKey;

    const apiNotes: ApiNote[] = notes.map((note) =>
      this.buildApiNote(
        note,
        this._logger.child({ method: 'upload', noteId: note.noteId })
      )
    );

    const body = { notes: apiNotes };

    this._logger.info(
      `Uploading ${apiNotes.length} notes to VPS at ${vps.url}`
    );

    const url = vps.url.replace(/\/$/, '') + '/api/upload';

    try {
      const response = await requestUrl({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyPlain,
        },
        body: JSON.stringify(body),
        throw: false,
      });

      const result = await this._handleResponse.handleResponseAsync({
        response,
        url,
      });

      if (result.isError) {
        this._logger.error(
          `Failed to upload notes: ${result.text}`,
          result.error
        );
        return false;
      }

      this._logger.info('Successfully uploaded notes to VPS');
      this._logger.debug('Upload response:', result);

      return true;
    } catch (error: any) {
      this._logger.error(`Exception during upload: `, error);
      return false;
    }
  }

  // #region: private helpers

  private buildApiNote(note: PublishableNote, logger: LoggerPort): ApiNote {
    const title = this.extractFileNameWithoutExt(note.vaultPath);

    const slug = this.slugify(title);

    const route = this.buildFileRoute(
      note.folderConfig,
      note,
      slug,
      logger.child({ method: 'buildApiNote', noteId: note.noteId })
    );

    const nowIso = new Date().toISOString();

    logger.debug(
      `Building ApiNote for noteId=${note.noteId}, slug=${slug}, route=${route}`
    );

    const built: ApiNote = {
      id: note.noteId,
      title: title,
      slug: slug,
      route: route,
      relativePath: note.relativePath,
      vaultPath: note.vaultPath,
      markdown: note.content,
      frontmatter: {
        ...note.frontmatter,
        tags: (note.frontmatter.flat.tags || []) as string[],
      },
      publishedAt: nowIso,
    };
    logger.debug('Built ApiNote:', built);

    return built;
  }

  private extractFileNameWithoutExt(path: string): string {
    const last = path.split('/').pop() ?? path;
    const result = last.replace(/\.[^/.]+$/, '');
    this._logger.debug('Extracted file name without extension:', result);
    return result;
    // "Arakišib — .../Angle mort.md" -> "Angle mort"
  }

  private slugify(value: string): string {
    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
    this._logger.debug(`Slugified value: ${value} -> ${slug}`);
    return slug;
  }

  private buildFileRoute(
    folderConfig: FolderConfig,
    note: PublishableNote,
    slug: string,
    logger: LoggerPort
  ): string {
    const baseRouteClean = folderConfig.routeBase?.replace(/\/$/, '') ?? '';
    logger.debug(
      `Base route clean: ${baseRouteClean} from ${folderConfig.routeBase}`
    );

    const cleanVaultFolder = folderConfig.vaultFolder
      .replace(/^\//, '')
      .replace(/\/$/, '');
    logger.debug(
      `Clean vault folder: ${cleanVaultFolder} from ${folderConfig.vaultFolder}`
    );

    const cleanVaultRoute = note.vaultPath
      .replace(/^\//, '')
      .split('/')
      .splice(0, -1)
      .join('/');
    logger.debug(
      `Clean vault route: ${cleanVaultRoute} from ${note.vaultPath}`
    );

    const relativePathFromFolder = cleanVaultFolder
      ? cleanVaultRoute.replace(new RegExp(`^${cleanVaultFolder}`), '')
      : cleanVaultRoute;
    logger.debug(
      `Relative path from folder: ${relativePathFromFolder} (cleanVaultFolder=${cleanVaultFolder}, cleanVaultRoute=${cleanVaultRoute})`
    );

    const route = `${baseRouteClean}/${relativePathFromFolder}/${slug}`.replace(
      /\/+/g,
      '/'
    );

    logger.debug(`Built file route: ${route}`);

    return route;
  }
}
