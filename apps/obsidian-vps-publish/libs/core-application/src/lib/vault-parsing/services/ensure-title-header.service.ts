import { type LoggerPort } from '@core-domain';
import { type PublishableNote } from '@core-domain/entities/publishable-note';

import { type BaseService } from '../../common/base-service';

/**
 * Service responsable de garantir qu'un header markdown correspondant au titre
 * de la note existe dans le contenu, juste après le frontmatter.
 *
 * Si le header existe déjà, ne fait rien.
 * Sinon, insère un header avec un niveau approprié calculé selon les headers existants.
 */
export class EnsureTitleHeaderService implements BaseService {
  constructor(private readonly logger?: LoggerPort) {}

  process(notes: PublishableNote[]): PublishableNote[] {
    this.logger?.debug('Ensuring title headers for notes', { notesCount: notes.length });

    return notes.map((note) => this.ensureTitleHeader(note));
  }

  private ensureTitleHeader(note: PublishableNote): PublishableNote {
    const title = note.title;

    // Si pas de titre déterminable, ne rien faire
    if (!title || title.trim() === '') {
      this.logger?.debug('Note has no title, skipping header insertion', {
        noteId: note.noteId,
      });
      return note;
    }

    // Analyser le contenu pour détecter les headers
    const content = note.content;
    const existingHeaders = this.extractHeaders(content);

    // Vérifier si un header contenant le titre existe déjà
    if (this.hasTitleHeader(existingHeaders, title)) {
      this.logger?.debug('Note already has a title header, skipping insertion', {
        noteId: note.noteId,
        title,
      });
      return note;
    }

    // Calculer le niveau du header à insérer
    const headerLevel = this.calculateHeaderLevel(existingHeaders);

    // Insérer le header
    const updatedContent = this.insertTitleHeader(content, title, headerLevel);

    this.logger?.debug('Inserted title header in note', {
      noteId: note.noteId,
      title,
      headerLevel,
    });

    return {
      ...note,
      content: updatedContent,
    };
  }

  /**
   * Extrait tous les headers markdown du contenu avec leur niveau et texte.
   */
  private extractHeaders(content: string): Array<{ level: number; text: string }> {
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    const headers: Array<{ level: number; text: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = headerRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      headers.push({ level, text });
    }

    return headers;
  }

  /**
   * Vérifie si un header correspondant au titre existe déjà.
   * Comparaison insensible à la casse et au markdown inline basique.
   */
  private hasTitleHeader(headers: Array<{ level: number; text: string }>, title: string): boolean {
    const normalizedTitle = this.normalizeHeaderText(title);

    return headers.some((header) => {
      const normalizedHeader = this.normalizeHeaderText(header.text);
      return normalizedHeader === normalizedTitle;
    });
  }

  /**
   * Normalise le texte d'un header pour comparaison :
   * - Trim
   * - Lowercase
   * - Suppression du markdown inline basique (*italique*, **gras**, etc.)
   */
  private normalizeHeaderText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\*\*(.+?)\*\*/g, '$1') // gras
      .replace(/\*(.+?)\*/g, '$1') // italique
      .replace(/_(.+?)_/g, '$1') // italique alternatif
      .replace(/`(.+?)`/g, '$1') // code inline
      .trim();
  }

  /**
   * Calcule le niveau de header à insérer selon les headers existants.
   *
   * Règles :
   * - Si aucun header : H1
   * - Si seulement H2+ : H1
   * - Si seulement H3+ : H2
   * - Sinon : max(1, niveauMin - 1)
   */
  private calculateHeaderLevel(headers: Array<{ level: number; text: string }>): number {
    if (headers.length === 0) {
      return 1; // Pas de header existant → H1
    }

    const minLevel = Math.min(...headers.map((h) => h.level));

    // Si le niveau min est déjà 1, on reste à 1
    if (minLevel === 1) {
      return 1;
    }

    // Sinon, on insère un niveau au-dessus du minimum
    return Math.max(1, minLevel - 1);
  }

  /**
   * Insère le header de titre au début du contenu (après une éventuelle ligne vide).
   */
  private insertTitleHeader(content: string, title: string, level: number): string {
    const headerMarkdown = '#'.repeat(level) + ' ' + title;

    // Supprimer les espaces blancs en début de contenu
    const trimmedContent = content.trimStart();

    // Insérer le header suivi d'une ligne vide, puis le contenu
    if (trimmedContent) {
      return `${headerMarkdown}\n\n${trimmedContent}`;
    }

    // Si le contenu est vide, juste le header
    return headerMarkdown + '\n';
  }
}
