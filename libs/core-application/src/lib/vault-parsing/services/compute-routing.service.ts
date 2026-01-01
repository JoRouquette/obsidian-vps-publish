import type { NoteRoutingInfo } from '@core-domain/entities/note-routing-info';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { type BaseService } from '../../common/base-service';

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

      // Check if this is an additional file (marked with special prefix by vault adapter)
      const isAdditionalFile = normalizedRel.startsWith('__additional__/');

      const segments = normalizedRel.split('/').filter(Boolean);
      this._logger.debug('Path segments', { segments, isAdditionalFile });

      let routing: NoteRoutingInfo;

      if (segments.length === 0) {
        const slug = 'note';
        routing = {
          slug,
          path: '',
          routeBase,
          fullPath: routeBase ? `${routeBase}/${slug}` : `/${slug}`,
          folderDisplayName: note.folderConfig.displayName,
        };
        this._logger.debug('Computed routing for root note', { routing });
      } else {
        const fileSegment = segments[segments.length - 1];
        let dirSegments = segments.slice(0, -1);

        // If this is an additional file, strip the __additional__ marker and treat as root
        if (isAdditionalFile) {
          dirSegments = []; // Force root-of-route treatment
          this._logger.debug('Additional file detected, forcing root-of-route treatment', {
            originalPath: note.relativePath,
          });
        }

        const fileBase = fileSegment.replace(/\.[^/.]+$/, '');
        const slug = this.slugifySegment(fileBase);

        // If flattenTree is enabled, ignore directory segments (unless already stripped)
        const sluggedDirs =
          note.folderConfig.flattenTree || isAdditionalFile
            ? []
            : dirSegments.map(this.slugifySegment).filter(Boolean);

        const path = sluggedDirs.join('/');

        const parts = [routeBase || ''];
        if (path) {
          parts.push(path);
        }

        parts.push(slug);

        const fullPath = parts
          .filter(Boolean)
          .join('/')
          .replace(/\/{2,}/g, '/');

        // Only apply displayName to notes directly in vaultFolder (no intermediate folders)
        // OR if flattenTree/additionalFile (hierarchy is flattened, so displayName always applies)
        const shouldInheritDisplayName =
          dirSegments.length === 0 || note.folderConfig.flattenTree || isAdditionalFile;

        routing = {
          slug,
          path,
          routeBase,
          fullPath,
          folderDisplayName: shouldInheritDisplayName ? note.folderConfig.displayName : undefined,
        };
        this._logger.debug('Computed routing for note', {
          routing,
          flattenTree: note.folderConfig.flattenTree,
          isAdditionalFile,
        });
      }

      return {
        ...note,
        routing,
      };
    });

    // Detect slug collisions in flattened folders
    this.detectSlugCollisions(routed);

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
          const basePath = routingById.get(link.targetNoteId)!.fullPath;
          const href = link.subpath ? `${basePath}#${link.subpath}` : basePath;
          return { ...link, href };
        }
        return link;
      });

      return { ...note, resolvedWikilinks: updatedLinks };
    });
  }

  private slugifySegment(segment: string): string {
    const slugified = segment
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\s/g, '-');

    // If slugification resulted in an empty string (e.g., file name was only special characters),
    // generate a fallback slug
    return slugified || 'note';
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

  /**
   * Detects slug collisions in folders with flattenTree enabled.
   * When multiple notes in different subfolders have the same filename,
   * they will generate the same route, causing a collision.
   */
  private detectSlugCollisions(notes: PublishableNote[]): void {
    // Group notes by folder config ID and check for collisions within each flattened folder
    const flattenedFolders = new Map<string, PublishableNote[]>();

    for (const note of notes) {
      if (note.folderConfig.flattenTree) {
        const key = note.folderConfig.id;
        if (!flattenedFolders.has(key)) {
          flattenedFolders.set(key, []);
        }
        flattenedFolders.get(key)!.push(note);
      }
    }

    for (const [folderId, folderNotes] of flattenedFolders.entries()) {
      const routeMap = new Map<string, PublishableNote[]>();

      for (const note of folderNotes) {
        const route = note.routing.fullPath;
        if (!routeMap.has(route)) {
          routeMap.set(route, []);
        }
        routeMap.get(route)!.push(note);
      }

      // Check for collisions
      for (const [route, conflictingNotes] of routeMap.entries()) {
        if (conflictingNotes.length > 1) {
          const paths = conflictingNotes.map((n) => n.relativePath).join(', ');
          this._logger.error('Slug collision detected in flattened folder', {
            folderId,
            route,
            conflictingNotes: paths,
            count: conflictingNotes.length,
          });
          throw new Error(
            `Slug collision detected: ${conflictingNotes.length} notes map to the same route "${route}" in flattened folder. Conflicting files: ${paths}. Please rename one of the files or disable flattenTree for this folder.`
          );
        }
      }
    }
  }
}
