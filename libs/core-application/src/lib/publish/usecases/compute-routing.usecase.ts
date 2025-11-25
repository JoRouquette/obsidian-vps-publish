import type { PublishableNote } from '@core-domain/publish/PublishableNote';
import type { NoteRoutingInfo } from '@core-domain/publish/NoteRoutingInfo';
import type { LoggerPort } from '@core-domain/publish/ports/logger-port';

function slugifySegment(segment: string): string {
  return segment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '-');
}

function normalizeRouteBase(routeBase: string): string {
  if (!routeBase) return '';
  let r = routeBase.trim();
  if (!r.startsWith('/')) r = '/' + r;
  if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
  return r;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export class ComputeRoutingUseCase {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'ComputeRoutingUseCase' });
  }

  execute(note: PublishableNote): PublishableNote {
    this._logger.debug('Computing routing for note', {
      relativePath: note.relativePath,
      folderConfig: note.folderConfig,
    });

    const routeBase = normalizeRouteBase(note.folderConfig.routeBase || '');
    this._logger.debug('Normalized routeBase', {
      input: note.folderConfig.routeBase,
      normalized: routeBase,
    });

    const normalizedRel = normalizePath(note.relativePath);
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
        id: slug,
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
      const slug = slugifySegment(fileBase);

      const sluggedDirs = dirSegments.map(slugifySegment).filter(Boolean);
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
        id,
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
  }
}
