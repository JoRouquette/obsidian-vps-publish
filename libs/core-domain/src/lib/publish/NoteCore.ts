import type { DomainFrontmatter } from './DomainFrontmatter';
import type { FolderConfig } from './FolderConfig';
import type { VpsConfig } from './VpsConfig';

/**
 * Noyau d'une note, commun à tous les usecases.
 * Rien d'optionnel ici.
 */

export interface NoteCore {
  /**
   * Identifiant interne de la note dans le pipeline.
   * Tu peux le baser sur vaultPath, un GUID, peu importe,
   * tant que c'est stable sur tout le workflow de publish.
   */
  noteId: string;

  /**
   * Titre de la note (frontmatter.title ou nom de fichier sans extension).
   */
  title: string;

  /**
   * Chemin complet dans le vault.
   * ex: "_Codex/Divinites/Tenebra.md"
   */
  vaultPath: string;

  /**
   * Chemin RELATIF au folder configuré, incluant le fichier.
   * ex: "divinites/Tenebra.md"
   *
   * ATTENTION : ici c'est le chemin "brut" renvoyé par VaultPort.
   * La version slugifiée sortira dans routing.path / routing.fullPath.
   */
  relativePath: string;

  /**
   * Contenu markdown de la note, après les transformations
   * éventuelles (sanitize, inline dataview, etc.) selon la place
   * de ce core dans le pipeline.
   */
  content: string;

  /**
   * Frontmatter normalisé (DomainFrontmatter), pas du YAML brut.
   */
  frontmatter: DomainFrontmatter;

  /**
   * Config du folder depuis lequel la note a été collectée.
   */
  folderConfig: FolderConfig;

  /**
   * Config du VPS cible pour cette note.
   */
  vpsConfig: VpsConfig;
}
