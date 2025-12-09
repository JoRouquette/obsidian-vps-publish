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

/**
 * Gestionnaire de progression par étapes avec notifications
 * Orchestre progress global + progress par étape + notifications
 */
export class StepProgressManagerAdapter implements StepProgressManagerPort {
  private readonly steps = new Map<ProgressStepId, ProgressStepMetadata>();
  private readonly callbacks: ProgressStepCallback[] = [];

  constructor(
    private readonly progressPort: ProgressPort,
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

    // Notification de démarrage
    const startMsg = this.messages.getStartMessage(stepId);
    if (startMsg) {
      this.notificationPort.info(startMsg);
    }

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

    // Mettre à jour le progress global
    this.progressPort.advance(stepAmount);

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

    // Notification de succès
    const successMsg = this.messages.getSuccessMessage(stepId);
    if (successMsg) {
      this.notificationPort.success(successMsg);
    }

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

    // Avancer le progress global du total de cette étape
    this.progressPort.advance(metadata.total);

    // Notification optionnelle
    const skipMsg = this.messages.getSkipMessage?.(stepId);
    if (skipMsg) {
      this.notificationPort.info(skipMsg);
    }

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
    const allSteps = this.getAllSteps();
    if (allSteps.length === 0) return 0;

    const totalWeight = allSteps.reduce((sum, step) => sum + step.total, 0);
    if (totalWeight === 0) return 100;

    const currentWeight = allSteps.reduce((sum, step) => sum + step.current, 0);
    return Math.floor((currentWeight / totalWeight) * 100);
  }

  reset(): void {
    this.steps.clear();
  }

  onStepUpdate(callback: ProgressStepCallback): void {
    this.callbacks.push(callback);
  }

  private emitUpdate(step: ProgressStep): void {
    for (const callback of this.callbacks) {
      callback(step);
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
