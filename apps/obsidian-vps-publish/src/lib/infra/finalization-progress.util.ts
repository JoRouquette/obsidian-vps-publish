import { type FinalizationPhase } from '@core-domain';
import { ProgressStepId } from '@core-domain/entities/progress-step';

import type { Translations } from '../../i18n/locales';
import { type StepProgressManagerAdapter } from './step-progress-manager.adapter';

export interface FinalizationProgressUpdate {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  phase?: FinalizationPhase;
}

export function applyFinalizationProgressUpdate(
  stepProgressManager: StepProgressManagerAdapter,
  translations: Translations,
  update: FinalizationProgressUpdate
): void {
  stepProgressManager.setStepProgress(
    ProgressStepId.FINALIZE_SESSION,
    clampProgress(update.progress),
    100,
    getFinalizationPhaseLabel(translations, update.phase, update.status)
  );
}

export function getFinalizationPhaseLabel(
  translations: Translations,
  phase: FinalizationPhase | undefined,
  status: FinalizationProgressUpdate['status']
): string {
  const phaseLabels = translations.plugin.progress.finalizeSession.phases;

  switch (phase) {
    case 'queued':
      return phaseLabels.queued;
    case 'rebuilding_notes':
      return phaseLabels.rebuildingNotes;
    case 'rendering_html':
      return phaseLabels.renderingHtml;
    case 'promoting_content':
      return phaseLabels.promotingContent;
    case 'rebuilding_indexes':
      return phaseLabels.rebuildingIndexes;
    case 'validating_links':
      return phaseLabels.validatingLinks;
    case 'completing_publication':
      return phaseLabels.completingPublication;
    case 'completed':
      return phaseLabels.completed;
    case 'failed':
      return phaseLabels.failed;
    default:
      return status === 'failed'
        ? phaseLabels.failed
        : translations.plugin.progress.finalizeSession.label;
  }
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
