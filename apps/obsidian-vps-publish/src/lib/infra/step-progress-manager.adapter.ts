import type { ProgressStepMetadata } from '@core-domain/entities/progress-step';
import {
  ProgressStep,
  ProgressStepId,
  ProgressStepStatus,
} from '@core-domain/entities/progress-step';
import type { NotificationPort } from '@core-domain/ports/notification-port';
import type { ProgressPort } from '@core-domain/ports/progress-port';
import type {
  ProgressStepCallback,
  StepProgressManagerPort,
} from '@core-domain/ports/step-progress-manager-port';

import type { NoticeProgressAdapter } from './notice-progress.adapter';

/**
 * Step weights for calculating global progress percentage.
 * These weights are NOT based on file counts to avoid revealing statistics.
 * Each step has a fixed weight representing its relative duration/importance.
 */
const STEP_WEIGHTS: Record<ProgressStepId, number> = {
  [ProgressStepId.PARSE_VAULT]: 25, // 25% - parsing and analysis
  [ProgressStepId.UPLOAD_NOTES]: 35, // 35% - uploading notes
  [ProgressStepId.UPLOAD_ASSETS]: 30, // 30% - uploading assets
  [ProgressStepId.FINALIZE_SESSION]: 10, // 10% - finalization
};

const TOTAL_WEIGHT = Object.values(STEP_WEIGHTS).reduce((sum, w) => sum + w, 0);

/**
 * Gestionnaire de progression par étapes avec notifications
 * Orchestre progress global + progress par étape + notifications
 * Uses step-based weights instead of file counts for progress calculation.
 * Progress updates are throttled to prevent excessive UI repaints.
 */
export class StepProgressManagerAdapter implements StepProgressManagerPort {
  private readonly steps = new Map<ProgressStepId, ProgressStepMetadata>();
  private readonly callbacks: ProgressStepCallback[] = [];
  private readonly stepTimings = new Map<ProgressStepId, number>();
  private lastProgressUpdateTime = 0;
  private readonly progressThrottleMs = 80; // Throttle progress updates to max every 80ms
  private pendingProgressUpdate = false;

  constructor(
    private readonly progressPort: ProgressPort | NoticeProgressAdapter,
    private readonly notificationPort: NotificationPort,
    private readonly messages: StepMessages
  ) {}

  startStep(stepId: ProgressStepId, label: string, total: number): ProgressStep {
    const metadata: ProgressStepMetadata = {
      id: stepId,
      label,
      status: ProgressStepStatus.IN_PROGRESS,
      total: Math.max(0, total),
      current: 0,
      startedAt: new Date().toISOString(),
    };

    this.steps.set(stepId, metadata);
    this.stepTimings.set(stepId, Date.now());

    // Notification de démarrage
    const startMsg = this.messages.getStartMessage(stepId);
    if (startMsg) {
      this.notificationPort.info(startMsg);
    }

    // Update progress bar
    this.updateProgressBar();

    // Émettre callback
    const step = new ProgressStep(metadata);
    this.emitUpdate(step);

    return step;
  }

  advanceStep(stepId: ProgressStepId, stepAmount = 1): void {
    const metadata = this.steps.get(stepId);
    if (!metadata) {
      throw new Error(`Step ${stepId} not found. Call startStep first.`);
    }

    if (metadata.status !== ProgressStepStatus.IN_PROGRESS) {
      // Ignore les avances si l'étape n'est plus en cours
      return;
    }

    metadata.current = Math.min(metadata.total, metadata.current + stepAmount);

    // Update progress bar with throttling to prevent excessive UI repaints
    this.updateProgressBarThrottled();

    // Émettre callback
    const step = new ProgressStep(metadata);
    this.emitUpdate(step);
  }

  completeStep(stepId: ProgressStepId): void {
    const metadata = this.steps.get(stepId);
    if (!metadata) {
      throw new Error(`Step ${stepId} not found. Call startStep first.`);
    }

    metadata.status = ProgressStepStatus.COMPLETED;
    metadata.completedAt = new Date().toISOString();
    metadata.current = metadata.total; // S'assurer que current = total

    // Calculate step duration
    const startTime = this.stepTimings.get(stepId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.stepTimings.set(stepId, duration);
    }

    // Notification de succès
    const successMsg = this.messages.getSuccessMessage(stepId);
    if (successMsg) {
      this.notificationPort.success(successMsg);
    }

    // Update progress bar immediately (no throttling for completion)
    this.updateProgressBar();
    this.lastProgressUpdateTime = Date.now();

    // Émettre callback
    const step = new ProgressStep(metadata);
    this.emitUpdate(step);
  }

  failStep(stepId: ProgressStepId, errorMessage: string): void {
    const metadata = this.steps.get(stepId);
    if (!metadata) {
      throw new Error(`Step ${stepId} not found. Call startStep first.`);
    }

    metadata.status = ProgressStepStatus.FAILED;
    metadata.completedAt = new Date().toISOString();
    metadata.errorMessage = errorMessage;

    // Notification d'erreur
    const errorMsg = this.messages.getErrorMessage(stepId);
    if (errorMsg) {
      this.notificationPort.error(errorMsg, errorMessage);
    }

    // Émettre callback
    const step = new ProgressStep(metadata);
    this.emitUpdate(step);
  }

  skipStep(stepId: ProgressStepId, reason?: string): void {
    const metadata = this.steps.get(stepId);
    if (!metadata) {
      throw new Error(`Step ${stepId} not found. Call startStep first.`);
    }

    metadata.status = ProgressStepStatus.SKIPPED;
    metadata.completedAt = new Date().toISOString();
    if (reason) {
      metadata.errorMessage = reason;
    }

    // Notification optionnelle
    const skipMsg = this.messages.getSkipMessage?.(stepId);
    if (skipMsg) {
      this.notificationPort.info(skipMsg);
    }

    // Update progress bar immediately (no throttling for skip)
    this.updateProgressBar();
    this.lastProgressUpdateTime = Date.now();

    // Émettre callback
    const step = new ProgressStep(metadata);
    this.emitUpdate(step);
  }

  getStep(stepId: ProgressStepId): ProgressStep | undefined {
    const metadata = this.steps.get(stepId);
    if (!metadata) return undefined;
    return new ProgressStep(metadata);
  }

  getAllSteps(): ProgressStep[] {
    return Array.from(this.steps.values()).map((meta) => new ProgressStep(meta));
  }

  getGlobalPercentage(): number {
    return this.calculateWeightedProgress();
  }

  getStepTimings(): Map<ProgressStepId, number> {
    return new Map(this.stepTimings);
  }

  reset(): void {
    this.steps.clear();
    this.stepTimings.clear();
  }

  onStepUpdate(callback: ProgressStepCallback): void {
    this.callbacks.push(callback);
  }

  private emitUpdate(step: ProgressStep): void {
    for (const callback of this.callbacks) {
      callback(step);
    }
  }

  /**
   * Calculate weighted progress based on step weights, not file counts.
   * This ensures progress doesn't reveal internal statistics.
   */
  private calculateWeightedProgress(): number {
    let completedWeight = 0;

    for (const [stepId, metadata] of this.steps.entries()) {
      const weight = STEP_WEIGHTS[stepId] || 0;

      if (
        metadata.status === ProgressStepStatus.COMPLETED ||
        metadata.status === ProgressStepStatus.SKIPPED
      ) {
        completedWeight += weight;
      } else if (metadata.status === ProgressStepStatus.IN_PROGRESS) {
        // Partial progress within step based on current/total
        const stepProgress = metadata.total > 0 ? metadata.current / metadata.total : 0;
        completedWeight += weight * stepProgress;
      }
      // PENDING and FAILED steps contribute 0
    }

    return Math.min(100, Math.floor((completedWeight / TOTAL_WEIGHT) * 100));
  }

  /**
   * Update the progress bar with throttling to prevent excessive UI repaints.
   * Ensures progress updates happen at most every 80ms.
   */
  private updateProgressBarThrottled(): void {
    const now = Date.now();
    const elapsed = now - this.lastProgressUpdateTime;

    if (elapsed >= this.progressThrottleMs) {
      // Enough time has passed, update immediately
      this.updateProgressBar();
      this.lastProgressUpdateTime = now;
      this.pendingProgressUpdate = false;
    } else if (!this.pendingProgressUpdate) {
      // Schedule a deferred update
      this.pendingProgressUpdate = true;
      const delay = this.progressThrottleMs - elapsed;
      setTimeout(() => {
        this.pendingProgressUpdate = false;
        this.updateProgressBar();
        this.lastProgressUpdateTime = Date.now();
      }, delay);
    }
    // Else: update already scheduled, skip
  }

  /**
   * Update the progress bar with current weighted percentage and step message.
   */
  private updateProgressBar(): void {
    const percent = this.calculateWeightedProgress();

    // Find current step in progress
    const currentStepMeta = Array.from(this.steps.values()).find(
      (meta) => meta.status === ProgressStepStatus.IN_PROGRESS
    );

    // Note: currentStepMeta should always exist when this is called from a step operation
    // If it doesn't, it indicates a logic error in the calling code
    const stepMessage = currentStepMeta?.label ?? 'Processing...';

    // If progressPort has updateProgress method (NoticeProgressAdapter), use it
    const progressAdapter = this.progressPort as NoticeProgressAdapter;
    if (progressAdapter && typeof progressAdapter.updateProgress === 'function') {
      progressAdapter.updateProgress(percent, stepMessage);
    }
  }
}

/**
 * Messages pour chaque étape (i18n)
 */
export interface StepMessages {
  getStartMessage(stepId: ProgressStepId): string | undefined;
  getSuccessMessage(stepId: ProgressStepId): string | undefined;
  getErrorMessage(stepId: ProgressStepId): string | undefined;
  getSkipMessage?(stepId: ProgressStepId): string | undefined;
}
