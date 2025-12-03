import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { NoteRoutingInfo } from '@core-domain/entities/note-routing-info';
import type { LoggerPort } from '@core-domain/ports/logger-port';
import { BaseService } from '../../common/base-service';

export class ComputeRoutingService implements BaseService {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'ComputeRoutingUseCase' });
  }

  process(notes: PublishableNote[]): PublishableNote[] {
    const routed = notes.map((note) => {
      this._logger.debug('Computing routing for note', {
        relativePath: note.relativePath,
        folderConfig: note.folderConfig,
      });

      const routeBase = this.normalizeRouteBase(note.folderConfig.routeBase || '');
      this._logger.debug('Normalized routeBase', {
        input: note.folderConfig.routeBase,
        normalized: routeBase,
      });

      const normalizedRel = this.normalizePath(note.relativePath);
      this._logger.debug('Normalized relative path', {
        input: note.relativePath,
        normalized: normalizedRel,
      });

      const segments = normalizedRel.split('/').filter(Boolean);
      this._logger.debug('Path segments', { segments });

      let routing: NoteRoutingInfo;

      if (segments.length === 0) {
        const slug = 'note';
        routing = {
          slug,
          path: '',
          routeBase,
          fullPath: routeBase ? `${routeBase}/${slug}` : `/${slug}`,
        };
        this._logger.info('Computed routing for root note', { routing });
      } else {
        const fileSegment = segments[segments.length - 1];
        const dirSegments = segments.slice(0, -1);

        const fileBase = fileSegment.replace(/\.[^/.]+$/, '');
        const slug = this.slugifySegment(fileBase);

        const sluggedDirs = dirSegments.map(this.slugifySegment).filter(Boolean);
        const path = sluggedDirs.join('/');

        const id = note.noteId;

        const parts = [routeBase || ''];
        if (path) {
          parts.push(path);
        }

        parts.push(slug);

        const fullPath = parts
          .filter(Boolean)
          .join('/')
          .replace(/\/{2,}/g, '/');

        routing = {
          slug,
          path,
          routeBase,
          fullPath,
        };
        this._logger.info('Computed routing for note', { routing });
      }

      return {
        ...note,
        routing,
      };
    });

    const routingById = new Map<string, NoteRoutingInfo>();
    for (const note of routed) {
      routingById.set(note.noteId, note.routing);
    }

    return routed.map((note) => {
      if (!note.resolvedWikilinks || note.resolvedWikilinks.length === 0) {
        return note;
      }

      const updatedLinks = note.resolvedWikilinks.map((link) => {
        if (link.targetNoteId && routingById.has(link.targetNoteId)) {
          return { ...link, href: routingById.get(link.targetNoteId)!.fullPath };
        }
        return link;
      });

      return { ...note, resolvedWikilinks: updatedLinks };
    });
  }

  private slugifySegment(segment: string): string {
    return segment
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '-');
  }

  private normalizeRouteBase(routeBase: string): string {
    if (!routeBase) return '';
    let r = routeBase.trim();
    if (!r.startsWith('/')) r = '/' + r;
    if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
    return r;
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  }
}
