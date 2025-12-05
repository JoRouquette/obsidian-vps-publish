export type LogMeta = Record<string, unknown>;

export interface LoggerPort {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;

  /**
   * Permet d’ajouter du contexte (module, use case, requestId, etc.)
   * sans repasser ce contexte partout manuellement.
   */
  child(context: LogMeta): LoggerPort;
}
