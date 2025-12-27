import type { LoggerPort } from '@core-domain/ports/logger-port';

/**
 * Publishing Trace Service
 *
 * Centralized service for tracing publishing operations with correlation IDs.
 * Measures duration of each step and logs structured data for performance analysis.
 *
 * Each publishing run gets a unique uploadRunId (UUID) that is propagated
 * through all logs and steps for easy correlation.
 */
export class PublishingTraceService {
  private readonly uploadRunId: string;
  private readonly logger: LoggerPort;
  private readonly timers = new Map<string, number>();
  private readonly durations = new Map<string, number>();

  constructor(uploadRunId: string, logger: LoggerPort) {
    this.uploadRunId = uploadRunId;
    this.logger = logger.child({ uploadRunId });
  }

  /**
   * Get the upload run ID for this trace
   */
  getUploadRunId(): string {
    return this.uploadRunId;
  }

  /**
   * Start timing a step
   */
  startStep(stepName: string, metadata?: Record<string, unknown>): void {
    this.timers.set(stepName, performance.now());
    this.logger.debug(`▶️ Step started: ${stepName}`, {
      uploadRunId: this.uploadRunId,
      step: stepName,
      ...metadata,
    });
  }

  /**
   * End timing a step and log duration
   */
  endStep(stepName: string, metadata?: Record<string, unknown>): number {
    const startTime = this.timers.get(stepName);
    if (startTime === undefined) {
      this.logger.warn(`Step ${stepName} was never started`, {
        uploadRunId: this.uploadRunId,
      });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.durations.set(stepName, duration);
    this.timers.delete(stepName);

    this.logger.debug(`⏹️ Step completed: ${stepName}`, {
      uploadRunId: this.uploadRunId,
      step: stepName,
      durationMs: duration.toFixed(2),
      ...metadata,
    });

    return duration;
  }

  /**
   * Log a checkpoint within a step
   */
  checkpoint(stepName: string, checkpointName: string, metadata?: Record<string, unknown>): void {
    const startTime = this.timers.get(stepName);
    const elapsed = startTime !== undefined ? performance.now() - startTime : 0;

    this.logger.debug(`📍 Checkpoint: ${stepName} → ${checkpointName}`, {
      uploadRunId: this.uploadRunId,
      step: stepName,
      checkpoint: checkpointName,
      elapsedMs: elapsed.toFixed(2),
      ...metadata,
    });
  }

  /**
   * Get all recorded durations
   */
  getDurations(): Map<string, number> {
    return new Map(this.durations);
  }

  /**
   * Get summary of all steps with durations
   */
  getSummary(): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════',
      '📊 PUBLISHING TRACE SUMMARY',
      `Upload Run ID: ${this.uploadRunId}`,
      '═══════════════════════════════════════════════════',
    ];

    const sortedSteps = Array.from(this.durations.entries()).sort(
      ([, durationA], [, durationB]) => durationB - durationA
    );

    let totalDuration = 0;
    for (const [step, duration] of sortedSteps) {
      totalDuration += duration;
      const durationSec = (duration / 1000).toFixed(2);
      lines.push(`  ${step.padEnd(30)} ${durationSec.padStart(8)}s`);
    }

    lines.push('───────────────────────────────────────────────────');
    lines.push(`  ${'TOTAL'.padEnd(30)} ${(totalDuration / 1000).toFixed(2).padStart(8)}s`);
    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Get structured data for programmatic use
   */
  getStructuredData(): PublishingTraceData {
    const steps: StepTrace[] = [];
    let totalDuration = 0;

    for (const [step, duration] of this.durations.entries()) {
      totalDuration += duration;
      steps.push({
        name: step,
        durationMs: duration,
        durationSec: duration / 1000,
      });
    }

    return {
      uploadRunId: this.uploadRunId,
      steps,
      totalDurationMs: totalDuration,
      totalDurationSec: totalDuration / 1000,
    };
  }
}

export interface StepTrace {
  name: string;
  durationMs: number;
  durationSec: number;
}

export interface PublishingTraceData {
  uploadRunId: string;
  steps: StepTrace[];
  totalDurationMs: number;
  totalDurationSec: number;
}
