import { ProgressStepId } from '@core-domain/entities/progress-step';

import { fr } from '../i18n/locales';
import { applyFinalizationProgressUpdate } from '../lib/infra/finalization-progress.util';
import { StepProgressManagerAdapter } from '../lib/infra/step-progress-manager.adapter';

describe('StepProgressManagerAdapter finalization phases', () => {
  it('updates the finalization step label and progress from backend phases', () => {
    jest.useFakeTimers();

    const updateProgress = jest.fn();
    const manager = new StepProgressManagerAdapter(
      { updateProgress } as any,
      {
        info: jest.fn(),
        success: jest.fn(),
        error: jest.fn(),
      } as any,
      {
        getStartMessage: () => undefined,
        getSuccessMessage: () => undefined,
        getErrorMessage: () => undefined,
      }
    );

    manager.startStep(ProgressStepId.FINALIZE_SESSION, 'Finalisation', 100);

    applyFinalizationProgressUpdate(manager, fr, {
      status: 'processing',
      progress: 45,
      phase: 'rendering_html',
    });

    expect(manager.getStep(ProgressStepId.FINALIZE_SESSION)?.toJSON()).toMatchObject({
      label: 'Rendu HTML',
      current: 45,
      total: 100,
    });
    expect(updateProgress).toHaveBeenLastCalledWith(expect.any(Number), 'Rendu HTML');

    applyFinalizationProgressUpdate(manager, fr, {
      status: 'processing',
      progress: 85,
      phase: 'rebuilding_indexes',
    });
    jest.advanceTimersByTime(100);

    expect(manager.getStep(ProgressStepId.FINALIZE_SESSION)?.toJSON()).toMatchObject({
      label: 'Reconstruction des index',
      current: 85,
      total: 100,
    });
    expect(updateProgress).toHaveBeenLastCalledWith(expect.any(Number), 'Reconstruction des index');

    jest.useRealTimers();
  });

  it('weights backend finalization as a substantial share of global publish progress', () => {
    const manager = new StepProgressManagerAdapter(
      { updateProgress: jest.fn() } as any,
      {
        info: jest.fn(),
        success: jest.fn(),
        error: jest.fn(),
      } as any,
      {
        getStartMessage: () => undefined,
        getSuccessMessage: () => undefined,
        getErrorMessage: () => undefined,
        getSkipMessage: () => undefined,
      }
    );

    manager.startStep(ProgressStepId.PARSE_VAULT, 'Analyse', 1);
    manager.completeStep(ProgressStepId.PARSE_VAULT);

    manager.startStep(ProgressStepId.UPLOAD_NOTES, 'Upload notes', 1);
    manager.completeStep(ProgressStepId.UPLOAD_NOTES);

    manager.startStep(ProgressStepId.UPLOAD_ASSETS, 'Upload assets', 1);
    manager.skipStep(ProgressStepId.UPLOAD_ASSETS);

    manager.startStep(ProgressStepId.FINALIZE_SESSION, 'Finalisation', 100);

    expect(manager.getGlobalPercentage()).toBe(55);

    applyFinalizationProgressUpdate(manager, fr, {
      status: 'processing',
      progress: 45,
      phase: 'rendering_html',
    });
    expect(manager.getGlobalPercentage()).toBe(75);

    applyFinalizationProgressUpdate(manager, fr, {
      status: 'processing',
      progress: 85,
      phase: 'rebuilding_indexes',
    });
    expect(manager.getGlobalPercentage()).toBe(93);

    manager.completeStep(ProgressStepId.FINALIZE_SESSION);
    expect(manager.getGlobalPercentage()).toBe(100);
  });
});
