/**
 * Tests for the Cheerio-based Leaflet placeholder enrichment logic
 * in SessionFinalizerService.injectRenderedBlocks.
 *
 * These tests call the REAL private method on a real service instance
 * (constructed with null stubs for unused deps) so the test never
 * reimplements the algorithm — it exercises production code directly.
 */
import type { LoggerPort } from '@core-domain';
import { LogLevel } from '@core-domain';
import { load } from 'cheerio';

import { SessionFinalizerService } from '../infra/sessions/session-finalizer.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loadFragment = (html: string) =>
  (load as (...args: unknown[]) => ReturnType<typeof load>)(html, { decodeEntities: false }, false);

interface LogCall {
  level: 'warn' | 'info' | 'error' | 'debug';
  message: string;
  meta?: Record<string, unknown>;
}

function createFakeLogger(): LoggerPort & { calls: LogCall[] } {
  const calls: LogCall[] = [];
  let currentLevel: LogLevel = LogLevel.debug;
  const logger: LoggerPort & { calls: LogCall[] } = {
    calls,
    set level(l: LogLevel) {
      currentLevel = l;
    },
    get level(): LogLevel {
      return currentLevel;
    },
    child() {
      return logger;
    },
    debug(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'debug', message, meta });
    },
    info(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'info', message, meta });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'warn', message, meta });
    },
    error(message: string, meta?: Record<string, unknown>) {
      calls.push({ level: 'error', message, meta });
    },
  };
  return logger;
}

/**
 * Build a minimal SessionFinalizerService and return a bound reference
 * to its private `injectRenderedBlocks` method.
 *
 * The 6 constructor deps are unused by `injectRenderedBlocks` and are
 * stubbed with null — the method only uses its own arguments.
 */
function getEnrichFn(): (
  html: string,
  page: { leafletBlocks?: unknown[]; route?: string },
  log: LoggerPort
) => string {
  const service = new (SessionFinalizerService as any)(
    null, // notesStorage
    null, // stagingManager
    null, // markdownRenderer
    null, // contentStorage factory
    null, // manifestStorage factory
    null // sessionRepository
    // logger omitted → NullLogger
  ) as SessionFinalizerService;

  const fn = (service as any)['injectRenderedBlocks'].bind(service) as (
    html: string,
    page: { leafletBlocks?: unknown[]; route?: string },
    log: LoggerPort
  ) => string;

  return fn;
}

// ---------------------------------------------------------------------------
// Tests — all exercise the real SessionFinalizerService.injectRenderedBlocks
// ---------------------------------------------------------------------------

describe('SessionFinalizerService.injectRenderedBlocks (real method)', () => {
  const enrich = getEnrichFn();

  it('should enrich a single placeholder by data-leaflet-map-id', () => {
    const html = '<div class="leaflet-map-placeholder" data-leaflet-map-id="map-1"></div>';
    const page = {
      leafletBlocks: [{ id: 'map-1', lat: 48, long: 2 }],
      route: '/test',
    };

    const result = enrich(html, page, createFakeLogger());

    const $ = loadFragment(result);
    const el = $('[data-leaflet-map-id="map-1"]');
    expect(el.length).toBe(1);

    const blockData = JSON.parse(el.attr('data-leaflet-block') ?? '');
    expect(blockData.id).toBe('map-1');
    expect(blockData.lat).toBe(48);
  });

  it('should enrich multiple placeholders independently', () => {
    const html = [
      '<div data-leaflet-map-id="a"></div>',
      '<p>some text</p>',
      '<div data-leaflet-map-id="b"></div>',
    ].join('');

    const page = {
      leafletBlocks: [
        { id: 'a', lat: 10, long: 20 },
        { id: 'b', lat: 30, long: 40 },
      ],
    };

    const result = enrich(html, page, createFakeLogger());
    const $ = loadFragment(result);

    const blockA = JSON.parse($('[data-leaflet-map-id="a"]').attr('data-leaflet-block') ?? '');
    const blockB = JSON.parse($('[data-leaflet-map-id="b"]').attr('data-leaflet-block') ?? '');

    expect(blockA).toMatchObject({ id: 'a', lat: 10 });
    expect(blockB).toMatchObject({ id: 'b', lat: 30, long: 40 });
  });

  it('should not depend on exact HTML serialisation (extra attributes, whitespace)', () => {
    const html =
      '<div class="leaflet-map-placeholder custom-extra" style="margin:0" data-leaflet-map-id="map-x" data-extra="foo"></div>';
    const page = {
      leafletBlocks: [{ id: 'map-x', lat: 1, long: 2 }],
    };

    const result = enrich(html, page, createFakeLogger());
    const $ = loadFragment(result);
    const el = $('[data-leaflet-map-id="map-x"]');

    expect(el.attr('data-leaflet-block')).toBeDefined();
    // Original attributes preserved
    expect(el.attr('data-extra')).toBe('foo');
    expect(el.attr('style')).toBe('margin:0');
  });

  it('should warn when a placeholder has no matching block', () => {
    const html = '<div data-leaflet-map-id="orphan"></div>';
    const page = {
      leafletBlocks: [{ id: 'other', lat: 0, long: 0 }],
    };

    const logger = createFakeLogger();
    enrich(html, page, logger);

    const warns = logger.calls.filter((c) => c.level === 'warn');
    expect(warns.some((w) => w.message.includes('no matching block data'))).toBe(true);
  });

  it('should handle special characters in block data without breaking HTML', () => {
    const page = {
      leafletBlocks: [
        {
          id: 'special',
          description: 'Quotes: "hello" & <script>alert("xss")</script>',
          lat: 0,
          long: 0,
        },
      ],
    };
    const html = '<div data-leaflet-map-id="special"></div>';

    const result = enrich(html, page, createFakeLogger());

    // The result should be parseable and recoverable
    const $ = loadFragment(result);
    const raw = $('[data-leaflet-map-id="special"]').attr('data-leaflet-block');
    expect(raw).toBeDefined();

    const parsed = JSON.parse(raw ?? '');
    expect(parsed.id).toBe('special');
    expect(parsed.description).toContain('Quotes');
  });

  it('should not modify non-leaflet elements', () => {
    const html =
      '<div class="normal-content"><p>Hello</p></div><div data-leaflet-map-id="m"></div>';
    const page = {
      leafletBlocks: [{ id: 'm', lat: 0, long: 0 }],
    };

    const result = enrich(html, page, createFakeLogger());
    const $ = loadFragment(result);

    expect($('.normal-content p').text()).toBe('Hello');
    expect($('.normal-content').attr('data-leaflet-block')).toBeUndefined();
  });

  it('should return HTML unchanged when no leaflet blocks provided', () => {
    const html = '<div data-leaflet-map-id="m"></div>';

    const result = enrich(html, { leafletBlocks: [] }, createFakeLogger());
    expect(result).toBe(html);
  });

  it('should return HTML unchanged when leafletBlocks is undefined', () => {
    const html = '<div>content</div>';

    const result = enrich(html, {}, createFakeLogger());
    expect(result).toBe(html);
  });

  it('should warn on duplicate block ids', () => {
    const html = '<div data-leaflet-map-id="dup"></div><div data-leaflet-map-id="dup"></div>';
    const page = {
      leafletBlocks: [
        { id: 'dup', lat: 1, long: 2 },
        { id: 'dup', lat: 3, long: 4 },
      ],
      route: '/dup-test',
    };

    const logger = createFakeLogger();
    const result = enrich(html, page, logger);

    // Both placeholders should still be enriched (last-writer-wins for the block)
    const $ = loadFragment(result);
    const enriched = $('[data-leaflet-block]');
    expect(enriched.length).toBe(2);

    // A duplicate warning should have been logged
    const warns = logger.calls.filter((c) => c.level === 'warn');
    expect(warns.some((w) => w.message.includes('Duplicate'))).toBe(true);
  });

  it('should skip blocks without an id property', () => {
    const html = '<div data-leaflet-map-id="valid"></div>';
    const page = {
      leafletBlocks: [
        { lat: 0, long: 0 }, // no id
        { id: 'valid', lat: 10, long: 20 },
      ],
    };

    const result = enrich(html, page, createFakeLogger());
    const $ = loadFragment(result);

    const blockData = JSON.parse(
      $('[data-leaflet-map-id="valid"]').attr('data-leaflet-block') ?? ''
    );
    expect(blockData.id).toBe('valid');
  });

  it('should warn when no placeholder was enriched despite available blocks', () => {
    const html = '<div>no placeholders here</div>';
    const page = {
      leafletBlocks: [{ id: 'lonely', lat: 0, long: 0 }],
    };

    const logger = createFakeLogger();
    enrich(html, page, logger);

    const warns = logger.calls.filter((c) => c.level === 'warn');
    expect(warns.some((w) => w.message.includes('No Leaflet placeholder was enriched'))).toBe(true);
  });
});
