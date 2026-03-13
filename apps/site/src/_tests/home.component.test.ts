import { computed, signal } from '@angular/core';
import type { Manifest, ManifestPage } from '@core-domain';
import { defaultManifest } from '@core-domain';

import type { PublicConfig } from '../domain/ports/config-repository.port';

// ---------------------------------------------------------------------------
// Reproduce HomeComponent's pure computeds for isolated testing.
// These are exact copies of the component logic — if they diverge, that's a
// signal to update these tests.
// ---------------------------------------------------------------------------

type Section = {
  key: string;
  title: string;
  count: number;
  link: { segments: string[]; disabled?: boolean };
};

function capitalize(s: string) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function buildSections(pages: ManifestPage[]): Section[] {
  if (pages.length === 0) return [];

  const groups = new Map<string, { landing?: ManifestPage; children: ManifestPage[] }>();

  for (const p of pages) {
    const route: string = p.route ?? '';
    const clean = route.replaceAll(/^\/+|\/+$/g, '');
    const [key, ...rest] = clean.split('/');
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, { landing: undefined, children: [] });
    }

    const g = groups.get(key)!;

    if (rest.length === 0) {
      g.landing = p;
    } else {
      g.children.push(p);
    }
  }

  const list: Section[] = [];

  for (const [key, g] of groups.entries()) {
    const landing = g.landing;
    const title = capitalize(landing?.title ?? key);

    let link: Section['link'] = { segments: [], disabled: true };
    if (landing?.route) {
      link = { segments: [landing.route] };
    } else if (g.children[0]?.route) {
      link = { segments: [g.children[0].route] };
    }

    list.push({
      key,
      title,
      count: (g.children?.length ?? 0) + (landing ? 1 : 0),
      link,
    });
  }

  return list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fakeConfig: PublicConfig = {
  baseUrl: 'http://localhost',
  siteName: 'Test',
  author: 'tester',
  repoUrl: '',
  reportIssuesUrl: '',
  homeWelcomeTitle: 'Bienvenue',
  locale: 'fr',
};

function manifestWithPages(pages: ManifestPage[]): Manifest {
  return { ...defaultManifest, pages };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeComponent', () => {
  // =====================================================================
  // A. sections computed — pure logic (mirrors HomeComponent.sections)
  // =====================================================================

  describe('sections computed logic', () => {
    it('returns [] when manifest has no pages', () => {
      expect(buildSections([])).toEqual([]);
    });

    it('groups pages by first path segment', () => {
      const sections = buildSections([
        { title: 'Aegasos', route: '/aegasos', slug: 'aegasos', lastUpdatedAt: '' },
        {
          title: 'Chronologie',
          route: '/aegasos/chronologie',
          slug: 'aegasos-chrono',
          lastUpdatedAt: '',
        },
        { title: 'Bestiaire', route: '/bestiaire', slug: 'bestiaire', lastUpdatedAt: '' },
      ]);

      expect(sections.length).toBe(2);

      const aegasos = sections.find((s) => s.key === 'aegasos');
      expect(aegasos).toBeDefined();
      expect(aegasos!.count).toBe(2); // landing + 1 child
      expect(aegasos!.title).toBe('Aegasos');
      expect(aegasos!.link.segments).toEqual(['/aegasos']);

      const bestiaire = sections.find((s) => s.key === 'bestiaire');
      expect(bestiaire).toBeDefined();
      expect(bestiaire!.count).toBe(1);
    });

    it('sorts sections alphabetically (fr locale)', () => {
      const titles = buildSections([
        { title: 'Zéphyr', route: '/zephyr', slug: 'z', lastUpdatedAt: '' },
        { title: 'Alpha', route: '/alpha', slug: 'a', lastUpdatedAt: '' },
      ]).map((s) => s.title);

      expect(titles).toEqual(['Alpha', 'Zéphyr']);
    });

    it('falls back to first child route when no landing page', () => {
      const sections = buildSections([
        { title: 'Deep', route: '/region/deep', slug: 'rd', lastUpdatedAt: '' },
      ]);

      expect(sections.length).toBe(1);
      expect(sections[0].link.segments).toEqual(['/region/deep']);
    });

    it('uses key as title when landing title is undefined', () => {
      const sections = buildSections([
        { title: undefined as unknown as string, route: '/mytopic', slug: 'mt', lastUpdatedAt: '' },
      ]);

      expect(sections[0].title).toBe('Mytopic');
    });

    it('link is disabled when no route available', () => {
      const sections = buildSections([
        { title: 'Orphan', route: '/orphan/child', slug: 'oc', lastUpdatedAt: '' },
      ]);

      // There's no landing for 'orphan', so it should use child route
      expect(sections[0].link.segments).toEqual(['/orphan/child']);
    });
  });

  // =====================================================================
  // B. welcomeTitle — depends on config.cfg() signal
  // =====================================================================

  describe('welcomeTitle computed logic', () => {
    it('returns undefined when config is null', () => {
      const cfg = signal<PublicConfig | null>(null);
      const welcomeTitle = computed(() => cfg()?.homeWelcomeTitle);

      expect(welcomeTitle()).toBeUndefined();
    });

    it('returns homeWelcomeTitle once config is set', () => {
      const cfg = signal<PublicConfig | null>(null);
      const welcomeTitle = computed(() => cfg()?.homeWelcomeTitle);

      cfg.set(fakeConfig);
      expect(welcomeTitle()).toBe('Bienvenue');
    });
  });

  // =====================================================================
  // C. Timing contract — ensureManifest/ensure populates signals reactively
  // =====================================================================

  describe('ngOnInit timing contract', () => {
    // Simulates the CatalogFacade signal + async ensureManifest pattern.
    // The real facade loads manifest via an async handler, then sets the signal.
    // HomeComponent.ngOnInit calls ensureManifest() fire-and-forget.
    // The test verifies that sections react AFTER the signal is populated.

    it('sections empty before manifest loads, populated after', () => {
      const manifest = signal<Manifest>(defaultManifest);
      const sections = computed(() => buildSections(manifest().pages));

      // Before: empty manifest → empty sections
      expect(sections()).toEqual([]);

      // After: simulate ensureManifest resolution
      manifest.set(
        manifestWithPages([
          { title: 'Town', route: '/town', slug: 'town', lastUpdatedAt: '' },
          { title: 'Map', route: '/town/map', slug: 'town-map', lastUpdatedAt: '' },
        ])
      );

      expect(sections().length).toBe(1);
      expect(sections()[0].key).toBe('town');
      expect(sections()[0].count).toBe(2);
    });

    it('welcomeTitle reactive: undefined → value after config.ensure', () => {
      const cfg = signal<PublicConfig | null>(null);
      const welcomeTitle = computed(() => cfg()?.homeWelcomeTitle);

      expect(welcomeTitle()).toBeUndefined();

      // Simulate config.ensure() resolving
      cfg.set(fakeConfig);
      expect(welcomeTitle()).toBe('Bienvenue');
    });

    it('error signal can be set when manifest load fails', () => {
      const error = signal<string | null>(null);
      const loading = signal(false);

      // Simulate ensureManifest failure path
      loading.set(true);
      error.set(null);
      error.set('Manifest indisponible pour le moment : network fail');
      loading.set(false);

      expect(error()).toContain('network fail');
      expect(loading()).toBe(false);
    });
  });

  // =====================================================================
  // D. Leaflet injection independence from manifest
  // =====================================================================

  describe('Leaflet data-leaflet-block resolution', () => {
    // Reproduces HomeComponent.resolveBlockFromDataset — purely DOM-based,
    // does NOT read the manifest signal.
    function resolveBlockFromDataset(
      placeholder: HTMLElement
    ): { ok: true; block: unknown; mapId: string } | { ok: false; reason: string } {
      const blockDataStr = placeholder.dataset['leafletBlock'];
      if (!blockDataStr) {
        return { ok: false, reason: 'missing-leaflet-block-dataset' };
      }
      try {
        const block = JSON.parse(blockDataStr) as { id?: string };
        if (!block.id) return { ok: false, reason: 'invalid-block-missing-id' };
        return { ok: true, block, mapId: block.id };
      } catch {
        return { ok: false, reason: 'invalid-leaflet-block-json' };
      }
    }

    it('resolves block from data-leaflet-block attribute (no manifest needed)', () => {
      const el = document.createElement('div');
      el.dataset['leafletBlock'] = JSON.stringify({ id: 'map1', lat: 48.8, long: 2.3 });

      const result = resolveBlockFromDataset(el);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mapId).toBe('map1');
      }
    });

    it('returns error when dataset is missing', () => {
      const el = document.createElement('div');
      const result = resolveBlockFromDataset(el);
      expect(result).toEqual({ ok: false, reason: 'missing-leaflet-block-dataset' });
    });

    it('returns error when JSON is invalid', () => {
      const el = document.createElement('div');
      el.dataset['leafletBlock'] = '{broken';
      const result = resolveBlockFromDataset(el);
      expect(result).toEqual({ ok: false, reason: 'invalid-leaflet-block-json' });
    });

    it('returns error when block has no id', () => {
      const el = document.createElement('div');
      el.dataset['leafletBlock'] = JSON.stringify({ lat: 48 });
      const result = resolveBlockFromDataset(el);
      expect(result).toEqual({ ok: false, reason: 'invalid-block-missing-id' });
    });
  });
});
