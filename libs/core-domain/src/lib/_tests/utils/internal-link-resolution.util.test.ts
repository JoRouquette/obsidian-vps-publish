import {
  resolveCanonicalInternalLink,
  parseInternalHref,
} from '../../utils/internal-link-resolution.util';
import type { ManifestPage } from '../../entities/manifest-page';

describe('internal-link-resolution.util', () => {
  const pages: ManifestPage[] = [
    {
      id: 'luminara-page',
      title: 'Luminara (V)',
      aliases: ['Luminara'],
      route: '/anorin-sirdalea/amel-fass/luminara-v',
      slug: { value: 'luminara-v' } as ManifestPage['slug'],
      vaultPath: 'Anorin Sirdalea/Amel Fass/Luminara (V)/Luminara (V).md',
      relativePath: 'Amel Fass/Luminara (V)/Luminara (V).md',
      publishedAt: new Date('2026-03-23T00:00:00.000Z'),
    },
    {
      id: 'ektaron-page',
      title: 'Ektaron',
      route: '/worlds/ektaron',
      slug: { value: 'ektaron' } as ManifestPage['slug'],
      vaultPath: 'Worlds/Ektaron.md',
      relativePath: 'Worlds/Ektaron.md',
      publishedAt: new Date('2026-03-23T00:00:00.000Z'),
    },
  ];

  it('resolves alias-based links to the canonical route without using the alias as the route', () => {
    const resolved = resolveCanonicalInternalLink('Luminara', pages);

    expect(resolved.resolved).toBe(true);
    expect(resolved.page?.id).toBe('luminara-page');
    expect(resolved.aliasMatched).toBe(true);
    expect(resolved.matchSource).toBe('alias');
    expect(resolved.resolvedRoute).toBe('/anorin-sirdalea/amel-fass/luminara-v');
    expect(resolved.resolvedHref).toBe('/anorin-sirdalea/amel-fass/luminara-v');
  });

  it('canonicalizes heading and block fragments while preserving query strings', () => {
    const headingResolved = resolveCanonicalInternalLink(
      'Ektaron?view=card#Histoire locale',
      pages
    );
    expect(headingResolved.resolvedHref).toBe('/worlds/ektaron?view=card#histoire-locale');
    expect(headingResolved.fragmentType).toBe('heading');
    expect(headingResolved.fragmentCanonical).toBe('histoire-locale');

    const blockResolved = resolveCanonicalInternalLink('Ektaron#%5E37066d', pages);
    expect(blockResolved.resolvedHref).toBe('/worlds/ektaron#^37066d');
    expect(blockResolved.fragmentType).toBe('block');
    expect(blockResolved.fragmentCanonical).toBe('^37066d');
  });

  it('parses internal hrefs without losing query or fragment semantics', () => {
    expect(
      parseInternalHref('/worlds/ektaron?view=card#histoire', '/worlds/ektaron', '?view=card')
    ).toEqual({
      raw: '/worlds/ektaron?view=card#histoire',
      path: '/worlds/ektaron',
      search: '?view=card',
      fragment: 'histoire',
      normalizedHref: '/worlds/ektaron?view=card#histoire',
      isFragmentOnly: false,
    });
  });
});
