import { LoggerPort } from './LoggerPort';

export interface IndexPort {
  save(params: unknown, logger?: LoggerPort): Promise<void>;
  rebuildIndex(params: unknown, logger?: LoggerPort): Promise<void>;
}
