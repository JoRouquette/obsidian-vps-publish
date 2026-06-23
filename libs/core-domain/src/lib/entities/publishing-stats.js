"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublishingStats = createPublishingStats;
exports.formatPublishingStats = formatPublishingStats;
exports.formatProgressStats = formatProgressStats;
/**
 * Factory pour créer des stats initiales
 */
function createPublishingStats() {
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
 * Simplified format: single line for quick scanning, details only if errors
 */
function formatPublishingStats(stats, t) {
    const hasErrors = stats.notesFailed > 0 || stats.assetsFailed > 0;
    // For simple success cases, use compact format
    if (!hasErrors) {
        const duration = stats.startedAt && stats.completedAt
            ? formatDuration(stats.completedAt.getTime() - stats.startedAt.getTime(), t)
            : '';
        const parts = [];
        parts.push(`✅ ${stats.notesUploaded} notes`);
        if (stats.assetsUploaded > 0) {
            parts.push(`${stats.assetsUploaded} assets`);
        }
        if (duration) {
            parts.push(`(${duration.replace('Completed in ', '').replace('Terminé en ', '')})`);
        }
        return parts.join(' • ');
    }
    // Detailed format only if errors
    const lines = [];
    lines.push(t?.summary ?? '📊 Publishing Summary');
    lines.push(t?.notesPublished.replace('{count}', stats.notesUploaded.toString()) ??
        `✅ ${stats.notesUploaded} notes published`);
    if (stats.notesFailed > 0) {
        lines.push(`❌ ${stats.notesFailed} note errors`);
    }
    if (stats.assetsUploaded > 0) {
        lines.push(`📎 ${stats.assetsUploaded} assets`);
    }
    if (stats.assetsFailed > 0) {
        lines.push(`❌ ${stats.assetsFailed} asset errors`);
    }
    if (stats.startedAt && stats.completedAt) {
        const durationMs = stats.completedAt.getTime() - stats.startedAt.getTime();
        lines.push(`⏱️ ${formatDuration(durationMs, t)}`);
    }
    return lines.join('\n');
}
/**
 * Format duration in human-readable format
 */
function formatDuration(ms, t) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
        return (t?.completedInSeconds.replace('{seconds}', seconds.toString()) ?? `Completed in ${seconds}s`);
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return (t?.completedInMinutes
        .replace('{minutes}', minutes.toString())
        .replace('{seconds}', remainingSeconds.toString()) ??
        `Completed in ${minutes}m ${remainingSeconds}s`);
}
/**
 * Formater les stats de progression en cours
 */
function formatProgressStats(stats, t) {
    const parts = [];
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
