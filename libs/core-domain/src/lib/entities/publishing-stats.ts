/**
 * Statistiques de publication consolidées
 * Utilisées pour fournir un feedback détaillé à l'utilisateur
 */
export interface PublishingStats {
  /** Nombre total de notes analysées dans le vault */
  totalNotesAnalyzed: number;

  /** Nombre de notes éligibles à la publication (après filtrage) */
  notesEligible: number;

  /** Nombre de notes ignorées (règles d'exclusion) */
  notesIgnored: number;

  /** Nombre de notes effectivement uploadées */
  notesUploaded: number;

  /** Nombre de notes qui ont échoué l'upload */
  notesFailed: number;

  /** Nombre de notes trop volumineuses (skipped) */
  notesOversized: number;

  /** Nombre total d'assets planifiés */
  assetsPlanned: number;

  /** Nombre d'assets effectivement uploadés */
  assetsUploaded: number;

  /** Nombre d'assets qui ont échoué l'upload */
  assetsFailed: number;

  /** Nombre d'assets trop volumineux (skipped) */
  assetsOversized: number;

  /** Nombre de batchs de notes */
  notesBatchCount: number;

  /** Nombre de batchs d'assets */
  assetsBatchCount: number;

  /** Batch de notes en cours */
  currentNotesBatch: number;

  /** Batch d'assets en cours */
  currentAssetsBatch: number;

  /** Timestamp de début */
  startedAt?: Date;

  /** Timestamp de fin */
  completedAt?: Date;
}

/**
 * Factory pour créer des stats initiales
 */
export function createPublishingStats(): PublishingStats {
  return {
    totalNotesAnalyzed: 0,
    notesEligible: 0,
    notesIgnored: 0,
    notesUploaded: 0,
    notesFailed: 0,
    notesOversized: 0,
    assetsPlanned: 0,
    assetsUploaded: 0,
    assetsFailed: 0,
    assetsOversized: 0,
    notesBatchCount: 0,
    assetsBatchCount: 0,
    currentNotesBatch: 0,
    currentAssetsBatch: 0,
  };
}

/**
 * Utilitaires pour formater les stats
 */
export function formatPublishingStats(stats: PublishingStats): string {
  const lines: string[] = [];

  lines.push(`📊 Publishing Summary`);
  lines.push(`─────────────────────`);

  // Notes
  lines.push(`📝 Notes:`);
  lines.push(`  • Analyzed: ${stats.totalNotesAnalyzed}`);
  lines.push(`  • Eligible: ${stats.notesEligible}`);
  if (stats.notesIgnored > 0) {
    lines.push(`  • Ignored: ${stats.notesIgnored}`);
  }
  lines.push(`  • Uploaded: ${stats.notesUploaded}`);
  if (stats.notesOversized > 0) {
    lines.push(`  • Oversized (skipped): ${stats.notesOversized}`);
  }
  if (stats.notesFailed > 0) {
    lines.push(`  • Failed: ${stats.notesFailed}`);
  }

  // Assets
  if (stats.assetsPlanned > 0) {
    lines.push(``);
    lines.push(`🖼️ Assets:`);
    lines.push(`  • Planned: ${stats.assetsPlanned}`);
    lines.push(`  • Uploaded: ${stats.assetsUploaded}`);
    if (stats.assetsOversized > 0) {
      lines.push(`  • Oversized (skipped): ${stats.assetsOversized}`);
    }
    if (stats.assetsFailed > 0) {
      lines.push(`  • Failed: ${stats.assetsFailed}`);
    }
  }

  // Duration
  if (stats.startedAt && stats.completedAt) {
    const durationMs = stats.completedAt.getTime() - stats.startedAt.getTime();
    const durationSec = (durationMs / 1000).toFixed(1);
    lines.push(``);
    lines.push(`⏱️ Duration: ${durationSec}s`);
  }

  return lines.join('\n');
}

/**
 * Formater les stats de progression en cours
 */
export function formatProgressStats(stats: PublishingStats): string {
  const parts: string[] = [];

  if (stats.currentNotesBatch > 0 && stats.notesBatchCount > 0) {
    parts.push(`Notes batch ${stats.currentNotesBatch}/${stats.notesBatchCount}`);
  }

  if (stats.currentAssetsBatch > 0 && stats.assetsBatchCount > 0) {
    parts.push(`Assets batch ${stats.currentAssetsBatch}/${stats.assetsBatchCount}`);
  }

  if (stats.notesUploaded > 0 && stats.notesEligible > 0) {
    parts.push(`${stats.notesUploaded}/${stats.notesEligible} notes`);
  }

  if (stats.assetsUploaded > 0 && stats.assetsPlanned > 0) {
    parts.push(`${stats.assetsUploaded}/${stats.assetsPlanned} assets`);
  }

  return parts.join(' | ');
}
