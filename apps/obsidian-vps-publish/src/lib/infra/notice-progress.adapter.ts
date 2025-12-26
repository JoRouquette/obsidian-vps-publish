import type { ProgressPort } from '@core-domain/ports/progress-port';
import { Notice } from 'obsidian';

import { translate } from '../../i18n';
import type { Translations } from '../../i18n/locales';

/**
 * Progress adapter using HTML progress bar instead of text percentage.
 * Progress is step-weighted, not file-count based, to avoid revealing internal statistics.
 */
export class NoticeProgressAdapter implements ProgressPort {
  constructor(
    private readonly label = 'Publishing',
    private readonly translations?: Translations
  ) {}

  private notice: Notice | null = null;
  private progressBarFillEl: HTMLDivElement | null = null;
  private messageEl: HTMLSpanElement | null = null;
  private stepEl: HTMLSpanElement | null = null;
  private currentStep = '';
  private currentPercent = 0;
  private startTime: number | null = null;

  start(_total: number): void {
    this.startTime = Date.now();
    this.currentPercent = 0;
    this.currentStep = this.translations
      ? translate(this.translations, 'common.initializing')
      : 'Initializing...';

    // Create notice with Obsidian-style progress bar
    const container = document.createElement('div');
    container.className = 'vps-publish-progress-container';

    // Message
    const messageSpan = document.createElement('span');
    messageSpan.className = 'vps-publish-progress-message';
    messageSpan.textContent = this.label;
    this.messageEl = messageSpan;

    // Progress bar wrapper (Obsidian-style)
    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'progress-bar';

    const progressBarFill = document.createElement('div');
    progressBarFill.className = 'progress-bar-fill';
    progressBarFill.style.width = '0%';
    this.progressBarFillEl = progressBarFill;

    progressWrapper.appendChild(progressBarFill);

    // Step message
    const stepSpan = document.createElement('span');
    stepSpan.className = 'vps-publish-progress-step';
    stepSpan.textContent = this.currentStep;
    this.stepEl = stepSpan;

    container.appendChild(messageSpan);
    container.appendChild(progressWrapper);
    container.appendChild(stepSpan);

    this.notice = new Notice('', 0);
    // Replace notice content with our custom HTML
    const noticeEl = (this.notice as unknown as { noticeEl?: HTMLElement }).noticeEl;
    if (noticeEl) {
      noticeEl.empty();
      noticeEl.appendChild(container);
    }
  }

  advance(_step = 1): void {
    // Step parameter is ignored - we use step-based weights instead
    // Progress is updated via updateProgress(percent, stepMessage)
  }

  /**
   * Update progress with explicit percentage and step message.
   * This should be called by StepProgressManager, not used directly.
   */
  updateProgress(percent: number, stepMessage: string): void {
    this.currentPercent = Math.min(100, Math.max(0, percent));
    this.currentStep = stepMessage;

    if (this.progressBarFillEl) {
      this.progressBarFillEl.style.width = `${this.currentPercent}%`;
    }

    if (this.stepEl) {
      this.stepEl.textContent = this.currentStep;
    }
  }

  finish(): void {
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    const durationText = this.formatDuration(duration);

    // Close persistent notice
    const closableNotice = this.notice as (Notice & { hide?: () => void }) | null;
    closableNotice?.hide?.();
    this.notice = null;

    // Show completion message with duration (use i18n if available)
    const message = this.translations
      ? translate(this.translations, 'notice.publishingCompleted', {
          label: this.label,
          duration: durationText,
        })
      : `✅ ${this.label} completed in ${durationText}`;

    new Notice(message, 5000);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
}
