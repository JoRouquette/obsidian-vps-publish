import { IndexPort } from './IndexPort';
import { LoggerPort } from './LoggerPort';

export interface AssetsIndexPort extends IndexPort {
  save(params: unknown, logger?: LoggerPort): Promise<void>;

  rebuildIndex(params: unknown, logger?: LoggerPort): Promise<void>;
}
