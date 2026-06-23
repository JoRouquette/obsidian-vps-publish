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
export declare function createPublishingStats(): PublishingStats;
/**
 * Utilitaires pour formater les stats
 * Simplified format: single line for quick scanning, details only if errors
 */
export declare function formatPublishingStats(stats: PublishingStats, t?: {
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
    simpleSummary?: string;
}): string;
/**
 * Formater les stats de progression en cours
 */
export declare function formatProgressStats(stats: PublishingStats, t?: {
    notesBatch: string;
    assetsBatch: string;
}): string;
//# sourceMappingURL=publishing-stats.d.ts.map