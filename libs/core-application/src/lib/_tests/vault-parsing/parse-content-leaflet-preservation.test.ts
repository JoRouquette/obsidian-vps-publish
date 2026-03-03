import { PublishableNote } from '@core-domain';

import { EvaluateIgnoreRulesHandler } from '../../vault-parsing/handler/evaluate-ignore-rules.handler';
import { ParseContentHandler } from '../../vault-parsing/handler/parse-content.handler';
import { NotesMapper } from '../../vault-parsing/mappers/notes.mapper';
import { DetectLeafletBlocksService } from '../../vault-parsing/services/detect-leaflet-blocks.service';
import { DetectWikilinksService } from '../../vault-parsing/services/detect-wikilinks.service';
import { NormalizeFrontmatterService } from '../../vault-parsing/services/normalize-frontmatter.service';
import type { RenderInlineDataviewService } from '../../vault-parsing/services/render-inline-dataview.service';
import { ResolveWikilinksService } from '../../vault-parsing/services/resolve-wikilinks.service';
import { NoopLogger } from '../helpers/fake-logger';

const logger = new NoopLogger();

// Minimal valid mocks for required services
const dummyHandler = new EvaluateIgnoreRulesHandler([], logger);
const dummyMapper = new NotesMapper();
class DummyRenderInlineDataviewService {
  process<T>(x: T): T {
    return x;
  }
  evaluateExpression() {
    return undefined;
  }
  extractPropertyPath() {
    return undefined;
  }
  normalizeToArray() {
    return [];
  }
  getValueFromFrontmatter() {
    return undefined;
  }
  renderValue() {
    return '';
  }
}

const makeDummyService = () =>
  ({ process: <T>(x: T) => x }) as unknown as {
    process: <T>(x: T) => T;
  };

const createMockNote = (content: string): PublishableNote => ({
  noteId: 'test-note',
  title: 'Test Note',
  content,
  vaultPath: 'Test/test-note.md',
  relativePath: 'test-note.md',
  frontmatter: { flat: {}, nested: {}, tags: [] },
  folderConfig: {
    id: 'test-folder',
    vpsId: 'test-vps',
    vaultFolder: 'Test',
    routeBase: '/',
    ignoredCleanupRuleIds: [],
  },
  routing: { slug: 'test-note', path: '', routeBase: '/', fullPath: '/test-note' },
  publishedAt: new Date(),
  eligibility: { isPublishable: true },
});

describe('ParseContentHandler/Leaflet preservation', () => {
  it('préserve le contenu du bloc leaflet même avec wikilinks/pièges', async () => {
    const leafletBlock = [
      'id: my-map',
      'lat: 50.5',
      'long: 30.5',
      'marker: default, 50.5, 30.5, [[Lien Interne]]',
      'tileserver: https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      'description: Ceci est un [[Lien]] qui ne doit PAS être remplacé',
    ].join('\n');
    const content = `Intro\n\n\u0060\u0060\u0060leaflet\n${leafletBlock}\n\u0060\u0060\u0060\n\nOutro`;
    const note = createMockNote(content);

    // Handler minimal : leafletBlocksDetector AVANT wikilinkResolver
    const handler = new ParseContentHandler(
      new NormalizeFrontmatterService(logger), // normalizeFrontmatterService
      dummyHandler, // evaluateIgnoreRulesHandler
      dummyMapper, // noteMapper
      new DummyRenderInlineDataviewService() as unknown as RenderInlineDataviewService, // inlineDataviewRenderer
      new DetectLeafletBlocksService(logger),
      makeDummyService() as any, // ensureTitleHeaderService
      makeDummyService() as any, // removeNoPublishingMarkerService
      makeDummyService() as any, // assetsDetector
      new ResolveWikilinksService(logger, new DetectWikilinksService(logger)),
      makeDummyService() as any, // computeRoutingService
      logger
    );

    const result = await handler.handle([note]);
    const processed = result[0].content;
    // The handler should detect leaflet blocks and preserve the original content
    // Leaflet blocks are extracted to leafletBlocks property, content is preserved
    expect(result[0].leafletBlocks).toBeDefined();
    expect(result[0].leafletBlocks).toHaveLength(1);
    expect(result[0].leafletBlocks![0].id).toBe('my-map');
    // Original wikilinks in leaflet block should be preserved
    expect(processed).toContain('[[Lien Interne]]');
  });
});
