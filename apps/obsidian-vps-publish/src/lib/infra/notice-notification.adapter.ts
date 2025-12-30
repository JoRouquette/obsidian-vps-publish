import type { NotificationData, NotificationPort } from '@core-domain/ports/notification-port';
import { NotificationType } from '@core-domain/ports/notification-port';
import { Notice } from 'obsidian';

import { debounce } from '../utils/throttle.util';
import type { UiPressureMonitorAdapter } from './ui-pressure-monitor.adapter';

interface PendingNotice {
  type: NotificationType;
  messages: string[];
  details?: string;
}

/**
 * Adapter pour envoyer des notifications via l'API Notice d'Obsidian
 * Avec coalescence pour éviter le spam de notices similaires
 */
export class NoticeNotificationAdapter implements NotificationPort {
  private readonly defaultDuration: Record<NotificationType, number> = {
    INFO: 4000,
    SUCCESS: 4000,
    WARNING: 6000,
    ERROR: 0, // Persistant pour les erreurs
  };

  private pendingNotices = new Map<NotificationType, PendingNotice>();
  private readonly flushDebounced: () => void;

  constructor(
    private readonly uiMonitor?: UiPressureMonitorAdapter,
    private readonly coalesceMs: number = 300 // Coalesce notices within 300ms
  ) {
    // Debounced flush: waits for silence before showing grouped notices
    this.flushDebounced = debounce(() => {
      this.flushPendingNotices();
    }, coalesceMs);
  }

  notify(data: NotificationData): void {
    // Record notice creation for UI pressure monitoring
    this.uiMonitor?.recordNoticeCreated();

    // Errors and warnings: show immediately (critical)
    if (data.type === NotificationType.ERROR || data.type === NotificationType.WARNING) {
      this.showNoticeImmediately(data);
      return;
    }

    // Info and success: coalesce to reduce spam
    this.addToPending(data);
    this.flushDebounced();
  }

  private addToPending(data: NotificationData): void {
    const existing = this.pendingNotices.get(data.type);

    if (existing) {
      // Append message to existing pending notice
      existing.messages.push(data.message);
      if (data.details) {
        existing.details = existing.details ? `${existing.details}\n${data.details}` : data.details;
      }
    } else {
      // Create new pending notice
      this.pendingNotices.set(data.type, {
        type: data.type,
        messages: [data.message],
        details: data.details,
      });
    }
  }

  private flushPendingNotices(): void {
    for (const [type, pending] of this.pendingNotices.entries()) {
      if (pending.messages.length === 1) {
        // Single message: show as-is
        this.showNoticeImmediately({
          type,
          message: pending.messages[0],
          details: pending.details,
        });
      } else {
        // Multiple messages: group them
        const count = pending.messages.length;
        const firstMessage = pending.messages[0];
        const summary = `${firstMessage} (+${count - 1} more)`;

        this.showNoticeImmediately({
          type,
          message: summary,
          details: pending.details,
        });
      }
    }

    this.pendingNotices.clear();
  }

  private showNoticeImmediately(data: NotificationData): void {
    const duration = data.duration ?? this.defaultDuration[data.type];
    const message = data.details ? `${data.message}\n${data.details}` : data.message;

    // Obsidian Notice ne supporte pas de styling avancé, on préfixe selon le type
    const prefix = this.getPrefix(data.type);
    const fullMessage = prefix ? `${prefix} ${message}` : message;

    new Notice(fullMessage, duration);
  }

  info(message: string, duration?: number): void {
    this.notify({
      type: NotificationType.INFO,
      message,
      duration: duration ?? this.defaultDuration.INFO,
    });
  }

  success(message: string, duration?: number): void {
    this.notify({
      type: NotificationType.SUCCESS,
      message,
      duration: duration ?? this.defaultDuration.SUCCESS,
    });
  }

  warning(message: string, duration?: number): void {
    this.notify({
      type: NotificationType.WARNING,
      message,
      duration: duration ?? this.defaultDuration.WARNING,
    });
  }

  error(message: string, details?: string, duration?: number): void {
    this.notify({
      type: NotificationType.ERROR,
      message,
      details,
      duration: duration ?? this.defaultDuration.ERROR,
    });
  }

  private getPrefix(type: NotificationType): string {
    switch (type) {
      case 'SUCCESS':
        return '✅';
      case 'WARNING':
        return '⚠️';
      case 'ERROR':
        return '❌';
      case 'INFO':
      default:
        return '';
    }
  }
}
