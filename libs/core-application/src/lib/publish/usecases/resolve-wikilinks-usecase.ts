import type { WikilinkRef } from '@core-domain/publish/WikilinkRef';
import type { ResolvedWikilink } from '@core-domain/publish/ResolvedWikilink';
import { LoggerPort } from '@core-domain/publish/ports/logger-port';

export interface NoteWikilinks {
  noteId: string;
  wikilinks: WikilinkRef[];
}

export interface WikilinkTargetDescriptor {
  noteId: string;
  href: string;
  linkableAliases: string[];
}

export interface ResolveWikilinksOutput {
  noteId: string;
  wikilinks: ResolvedWikilink[];
}

interface TargetMatchInfo {
  noteId: string;
  href: string;
}

/**
 * Normalisation d'une clé de résolution :
 * - trim,
 * - slashs Windows -> "/",
 * - suppression des slashs initiaux,
 * - lower-case.
 */
function normalizeKey(key: string): string {
  return key.trim().replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

export class ResolveWikilinksUseCase {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'ResolveWikilinksUseCase' });
  }

  execute(
    notes: NoteWikilinks[],
    targets: WikilinkTargetDescriptor[]
  ): ResolveWikilinksOutput[] {
    // 1) Construire une map alias normalisé -> cible
    const aliasMap = new Map<string, TargetMatchInfo>();

    for (const target of targets) {
      for (const alias of target.linkableAliases) {
        const key = normalizeKey(alias);
        if (!key) continue;

        if (!aliasMap.has(key)) {
          aliasMap.set(key, {
            noteId: target.noteId,
            href: target.href,
          });
        }
        // Si conflit (même alias pour plusieurs notes), on garde la première.
        // Si tu veux détecter ça, il faudra brancher un LoggingPort un jour.
      }
    }

    // 2) Résoudre les wikilinks pour chaque note
    const results: ResolveWikilinksOutput[] = [];

    for (const note of notes) {
      const resolvedForNote: ResolvedWikilink[] = [];

      for (const link of note.wikilinks) {
        const key = normalizeKey(link.path);
        const targetMatch = aliasMap.get(key);

        if (!targetMatch) {
          // Lien non résolu
          resolvedForNote.push({
            raw: link.raw,
            target: link.target,
            path: link.path,
            subpath: link.subpath,
            alias: link.alias,
            kind: link.kind,
            isResolved: false,
          });
          continue;
        }

        // Lien résolu
        const hrefWithFragment =
          link.subpath && link.subpath.length > 0
            ? `${targetMatch.href}#${link.subpath}`
            : targetMatch.href;

        resolvedForNote.push({
          raw: link.raw,
          target: link.target,
          path: link.path,
          subpath: link.subpath,
          alias: link.alias,
          kind: link.kind,
          isResolved: true,
          targetNoteId: targetMatch.noteId,
          href: hrefWithFragment,
        });
      }

      results.push({
        noteId: note.noteId,
        wikilinks: resolvedForNote,
      });
    }

    return results;
  }
}
