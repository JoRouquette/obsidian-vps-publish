import { ProgressStepId } from '@core-domain/entities/progress-step';

import type { PluginTranslations } from '../../i18n/locales';
import type { StepMessages } from './step-progress-manager.adapter';

/**
 * Factory pour créer les messages d'étapes à partir des traductions i18n
 */
export function createStepMessages(t: PluginTranslations): StepMessages {
  return {
    getStartMessage(stepId: ProgressStepId): string | undefined {
      switch (stepId) {
        case ProgressStepId.PARSE_VAULT:
          return t.progress.parseVault.start;
        case ProgressStepId.UPLOAD_NOTES:
          return t.progress.uploadNotes.start;
        case ProgressStepId.UPLOAD_ASSETS:
          return t.progress.uploadAssets.start;
        case ProgressStepId.FINALIZE_SESSION:
          return t.progress.finalizeSession.start;
        default:
          return undefined;
      }
    },

    getSuccessMessage(stepId: ProgressStepId): string | undefined {
      switch (stepId) {
        case ProgressStepId.PARSE_VAULT:
          return t.progress.parseVault.success;
        case ProgressStepId.UPLOAD_NOTES:
          return t.progress.uploadNotes.success;
        case ProgressStepId.UPLOAD_ASSETS:
          return t.progress.uploadAssets.success;
        case ProgressStepId.FINALIZE_SESSION:
          return t.progress.finalizeSession.success;
        default:
          return undefined;
      }
    },

    getErrorMessage(stepId: ProgressStepId): string | undefined {
      switch (stepId) {
        case ProgressStepId.PARSE_VAULT:
          return t.progress.parseVault.error;
        case ProgressStepId.UPLOAD_NOTES:
          return t.progress.uploadNotes.error;
        case ProgressStepId.UPLOAD_ASSETS:
          return t.progress.uploadAssets.error;
        case ProgressStepId.FINALIZE_SESSION:
          return t.progress.finalizeSession.error;
        default:
          return undefined;
      }
    },

    getSkipMessage(stepId: ProgressStepId): string | undefined {
      switch (stepId) {
        case ProgressStepId.UPLOAD_ASSETS:
          return t.progress.uploadAssets.skip;
        default:
          return undefined;
      }
    },
  };
}
