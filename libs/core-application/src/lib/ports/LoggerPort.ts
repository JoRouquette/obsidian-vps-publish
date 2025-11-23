export type LogMeta = Record<string, unknown>;

export interface LoggerPort {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;

  /**
   * Permet d’ajouter du contexte (module, use case, requestId, etc.)
   * sans repasser ce contexte partout manuellement.
   */
  child(context: LogMeta): LoggerPort;
}
