import type { NotificationData, NotificationPort } from '@core-domain/ports/notification-port';
import { NotificationType } from '@core-domain/ports/notification-port';
import { Notice } from 'obsidian';

/**
 * Adapter pour envoyer des notifications via l'API Notice d'Obsidian
 */
export class NoticeNotificationAdapter implements NotificationPort {
  private readonly defaultDuration: Record<NotificationType, number> = {
    INFO: 4000,
    SUCCESS: 4000,
    WARNING: 6000,
    ERROR: 0, // Persistant pour les erreurs
  };

  notify(data: NotificationData): void {
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
