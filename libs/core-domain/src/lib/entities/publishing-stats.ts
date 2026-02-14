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

  /** Notes dédupliquées (skipped car identiques à la production) */
  notesDeduplicated?: number;

  /** Assets dédupliqués (skipped car identiques à la production) */
  assetsDeduplicated?: number;

  /** Notes supprimées (présentes en production, absentes du vault) */
  notesDeleted?: number;
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
    notesDeduplicated: 0,
    assetsDeduplicated: 0,
    notesDeleted: 0,
  };
}

/**
 * Utilitaires pour formater les stats
 * Format stats WITHOUT revealing deductible counts (e.g., if we show analyzed + eligible, ignored is deductible)
 */
export function formatPublishingStats(
  stats: PublishingStats,
  t?: {
    summary: string;
    separator: string;
    contentPublished: string;
    notes: string;
    errors: string;
    assets: string;
    assetErrors: string;
    notesPublished: string;
    notesIgnored: string;
    completedInSeconds: string;
    completedInMinutes: string;
  }
): string {
  const lines: string[] = [];

  lines.push(t?.summary ?? '📊 Publishing Summary');
  lines.push(t?.separator ?? '─────────────────────');

  // Notes published
  lines.push(
    t?.notesPublished.replace('{count}', stats.notesUploaded.toString()) ??
      `✅ ${stats.notesUploaded} notes published`
  );

  // Notes ignored (if any)
  if (stats.notesIgnored > 0) {
    lines.push(
      t?.notesIgnored.replace('{count}', stats.notesIgnored.toString()) ??
        `ℹ️ ${stats.notesIgnored} notes excluded by ignore rules`
    );
  }

  // Errors
  if (stats.notesFailed > 0) {
    lines.push(
      `  • ${t?.errors.replace('{count}', stats.notesFailed.toString()) ?? `Errors: ${stats.notesFailed}`}`
    );
  }

  // Assets
  if (stats.assetsUploaded > 0 || stats.assetsPlanned > 0) {
    lines.push(``);
    lines.push(t?.contentPublished ?? '📝 Content Published:');
    lines.push(
      `  • ${t?.assets.replace('{count}', stats.assetsUploaded.toString()) ?? `Assets: ${stats.assetsUploaded}`}`
    );
    if (stats.assetsFailed > 0) {
      lines.push(
        `  • ${t?.assetErrors.replace('{count}', stats.assetsFailed.toString()) ?? `Asset errors: ${stats.assetsFailed}`}`
      );
    }
  }

  // Duration
  if (stats.startedAt && stats.completedAt) {
    const durationMs = stats.completedAt.getTime() - stats.startedAt.getTime();
    lines.push(``);
    lines.push(`⏱️ ${formatDuration(durationMs, t)}`);
  }

  return lines.join('\n');
}

/**
 * Format duration in human-readable format
 */
function formatDuration(
  ms: number,
  t?: { completedInSeconds: string; completedInMinutes: string }
): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return (
      t?.completedInSeconds.replace('{seconds}', seconds.toString()) ?? `Completed in ${seconds}s`
    );
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return (
    t?.completedInMinutes
      .replace('{minutes}', minutes.toString())
      .replace('{seconds}', remainingSeconds.toString()) ??
    `Completed in ${minutes}m ${remainingSeconds}s`
  );
}

/**
 * Formater les stats de progression en cours
 */
export function formatProgressStats(
  stats: PublishingStats,
  t?: { notesBatch: string; assetsBatch: string }
): string {
  const parts: string[] = [];

  if (stats.currentNotesBatch > 0 && stats.notesBatchCount > 0) {
    const msg = t?.notesBatch
      .replace('{current}', stats.currentNotesBatch.toString())
      .replace('{total}', stats.notesBatchCount.toString());
    parts.push(msg ?? `Notes batch ${stats.currentNotesBatch}/${stats.notesBatchCount}`);
  }

  if (stats.currentAssetsBatch > 0 && stats.assetsBatchCount > 0) {
    const msg = t?.assetsBatch
      .replace('{current}', stats.currentAssetsBatch.toString())
      .replace('{total}', stats.assetsBatchCount.toString());
    parts.push(msg ?? `Assets batch ${stats.currentAssetsBatch}/${stats.assetsBatchCount}`);
  }

  if (stats.notesUploaded > 0 && stats.notesEligible > 0) {
    parts.push(`${stats.notesUploaded}/${stats.notesEligible} notes`);
  }

  if (stats.assetsUploaded > 0 && stats.assetsPlanned > 0) {
    parts.push(`${stats.assetsUploaded}/${stats.assetsPlanned} assets`);
  }

  return parts.join(' | ');
}
