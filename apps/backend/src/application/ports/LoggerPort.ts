export type LogMeta = Record<string, unknown>;

export interface LoggerPort {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;

  /**
   * Permet d’ajouter du contexte (module, use case, requestId, etc.)
   * sans repasser ce contexte partout manuellement.
   */
  child(context: LogMeta): LoggerPort;
}
