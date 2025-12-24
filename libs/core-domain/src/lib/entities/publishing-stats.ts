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

  /** Nombre total d'assets planifiés */
  assetsPlanned: number;

  /** Nombre d'assets effectivement uploadés */
  assetsUploaded: number;

  /** Nombre d'assets qui ont échoué l'upload */
  assetsFailed: number;

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
    assetsPlanned: 0,
    assetsUploaded: 0,
    assetsFailed: 0,
    notesBatchCount: 0,
    assetsBatchCount: 0,
    currentNotesBatch: 0,
    currentAssetsBatch: 0,
  };
}

/**
 * Utilitaires pour formater les stats
 * Format stats WITHOUT revealing deductible counts (e.g., if we show analyzed + eligible, ignored is deductible)
 */
export function formatPublishingStats(stats: PublishingStats): string {
  const lines: string[] = [];

  lines.push(`📊 Publishing Summary`);
  lines.push(`─────────────────────`);

  // Notes: only show uploaded count to avoid deducing ignored count
  lines.push(`📝 Content Published:`);
  lines.push(`  • Notes: ${stats.notesUploaded}`);
  if (stats.notesFailed > 0) {
    lines.push(`  • Errors: ${stats.notesFailed}`);
  }

  // Assets
  if (stats.assetsUploaded > 0 || stats.assetsPlanned > 0) {
    lines.push(`  • Assets: ${stats.assetsUploaded}`);
    if (stats.assetsFailed > 0) {
      lines.push(`  • Asset errors: ${stats.assetsFailed}`);
    }
  }

  // Exclusions notice (without count)
  if (stats.notesIgnored > 0) {
    lines.push(``);
    lines.push(`ℹ️ Some items were excluded based on your rules`);
  }

  // Duration
  if (stats.startedAt && stats.completedAt) {
    const durationMs = stats.completedAt.getTime() - stats.startedAt.getTime();
    lines.push(``);
    lines.push(`⏱️ ${formatDuration(durationMs)}`);
  }

  return lines.join('\n');
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `Completed in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `Completed in ${minutes}m ${remainingSeconds}s`;
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
