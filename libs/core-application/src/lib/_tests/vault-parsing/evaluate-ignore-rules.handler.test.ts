import type { IgnoreRule } from '@core-domain/entities/ignore-rule';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { EvaluateIgnoreRulesHandler } from '../../vault-parsing/handler/evaluate-ignore-rules.handler';

class NoopLogger implements LoggerPort {
  private _level: any = 0;
  set level(level: any) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('EvaluateIgnoreRulesHandler', () => {
  const logger = new NoopLogger();

  const baseNote = {
    noteId: '1',
    title: 'N',
    vaultPath: 'v',
    relativePath: 'r',
    content: 'c',
    frontmatter: { flat: {}, nested: { publish: false }, tags: [] },
    folderConfig: { id: 'f', vaultFolder: 'Vault', routeBase: '/blog', vpsId: 'vps' },
    routing: { slug: '', path: '', routeBase: '', fullPath: '' },
    publishedAt: new Date(),
    eligibility: { isPublishable: true },
  } as PublishableNote;

  it('marks note as not publishable when rule matches ignoreIf', async () => {
    const rules: IgnoreRule[] = [{ property: 'publish', ignoreIf: false } as any];
    const handler = new EvaluateIgnoreRulesHandler(rules, logger);
    const [result] = await handler.handle([baseNote]);
    expect(result.eligibility.isPublishable).toBe(false);
    expect(result.eligibility.ignoredByRule?.property).toBe('publish');
  });

  it('keeps note publishable when rule does not match', async () => {
    const rules: IgnoreRule[] = [{ property: 'publish', ignoreIf: false } as any];
    const handler = new EvaluateIgnoreRulesHandler(rules, logger);
    const [result] = await handler.handle([
      {
        ...baseNote,
        frontmatter: { flat: {}, nested: { publish: true }, tags: [] },
      } as PublishableNote,
    ]);
    expect(result.eligibility.isPublishable).toBe(true);
  });
});
