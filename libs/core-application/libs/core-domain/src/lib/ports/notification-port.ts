/**
 * Type de notification
 */
export enum NotificationType {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Données d'une notification
 */
export interface NotificationData {
  /** Type de notification */
  type: NotificationType;
  /** Message principal */
  message: string;
  /** Message détaillé (optionnel) */
  details?: string;
  /** Durée d'affichage en ms (0 = persistant) */
  duration?: number;
}

/**
 * Port pour envoyer des notifications à l'utilisateur
 * Implementation spécifique à la plateforme (Obsidian Notice, console, toast, etc.)
 */
export interface NotificationPort {
  /**
   * Affiche une notification à l'utilisateur
   * @param data Données de la notification
   */
  notify(data: NotificationData): void;

  /**
   * Affiche une notification d'information
   * @param message Message à afficher
   * @param duration Durée d'affichage (ms), 0 = persistant
   */
  info(message: string, duration?: number): void;

  /**
   * Affiche une notification de succès
   * @param message Message à afficher
   * @param duration Durée d'affichage (ms), 0 = persistant
   */
  success(message: string, duration?: number): void;

  /**
   * Affiche une notification d'avertissement
   * @param message Message à afficher
   * @param duration Durée d'affichage (ms), 0 = persistant
   */
  warning(message: string, duration?: number): void;

  /**
   * Affiche une notification d'erreur
   * @param message Message principal
   * @param details Détails de l'erreur (optionnel)
   * @param duration Durée d'affichage (ms), 0 = persistant
   */
  error(message: string, details?: string, duration?: number): void;
}
