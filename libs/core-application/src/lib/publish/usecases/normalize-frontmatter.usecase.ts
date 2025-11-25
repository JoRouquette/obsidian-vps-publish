import type { DomainFrontmatter } from '@core-domain/publish/DomainFrontmatter';
import { LoggerPort } from '@core-domain/publish/ports/logger-port';
import { normalizePropertyKey } from '@core-domain/publish/utils/string.utils';

export class NormalizeFrontmatterUseCase {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'NormalizeFrontmatterUseCase' });
    this._logger.debug('NormalizeFrontmatterUseCase initialized');
  }

  execute(input?: Record<string, unknown>): DomainFrontmatter {
    this._logger.debug('Normalizing frontmatter', { input });
    if (!input) {
      this._logger.error(
        'No frontmatter input provided, returning empty result'
      );
      return { flat: {}, nested: {} };
    }

    const flat: Record<string, unknown> = {};
    const nested: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      const normalizedKey = normalizePropertyKey(key);
      this._logger.debug('Processing frontmatter entry', {
        key,
        normalizedKey,
        value,
      });
      flat[normalizedKey] = value;
      if (normalizedKey.includes('.')) {
        this._logger.debug('Setting nested value', { normalizedKey, value });
        this.setNestedValue(nested, normalizedKey, value);
      } else {
        // Only assign if not already set by a dotted key or subkeys
        if (
          typeof nested[normalizedKey] === 'undefined' ||
          (nested[normalizedKey] &&
            typeof nested[normalizedKey] === 'object' &&
            Object.keys(nested[normalizedKey] as object).length === 0)
        ) {
          nested[normalizedKey] = value;
        }
      }
    }

    this._logger.debug('Frontmatter normalization result', { flat, nested });
    return { flat, nested };
  }

  private setNestedValue(
    target: Record<string, unknown>,
    path: string,
    value: unknown
  ): void {
    const segments = path.split('.').map(normalizePropertyKey);
    let current: any = target;

    for (let i = 0; i < segments.length; i++) {
      const key = segments[i];
      const isLast = i === segments.length - 1;

      if (isLast) {
        current[key] = value;
        return;
      }

      if (typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
  }
}
