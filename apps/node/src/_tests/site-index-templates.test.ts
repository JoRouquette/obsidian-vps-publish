import { Slug } from '@core-domain';

import { renderFolderIndex, renderRootIndex } from '../infra/filesystem/site-index-templates';

describe('site-index-templates', () => {
  it('renders root index with folders', () => {
    const html = renderRootIndex([
      { name: 'guide', link: '/guide', count: 2 },
      { name: 'home', link: '/', count: 1 },
    ]);
    expect(html).toContain('Dossiers');
    expect(html).toContain('guide');
    expect(html).toContain('/guide/index');
  });

  it('renders folder index with subfolders and pages', () => {
    const html = renderFolderIndex(
      '/guide',
      [
        {
          id: 'p1',
          title: 'Intro',
          route: '/guide/intro',
          slug: Slug.from('intro'),
          publishedAt: new Date(),
        },
      ],
      [{ name: 'advanced', link: '/guide/advanced', count: 1 }]
    );
    expect(html).toContain('Guide');
    expect(html).toContain('Intro');
    expect(html).toContain('advanced');
    expect(html).toContain('Sous-dossiers');
    expect(html).toContain('Pages');
  });

  it('should not render empty subfolders section', () => {
    const html = renderFolderIndex(
      '/guide',
      [
        {
          id: 'p1',
          title: 'Intro',
          route: '/guide/intro',
          slug: Slug.from('intro'),
          publishedAt: new Date(),
        },
      ],
      [] // No subfolders
    );
    expect(html).toContain('Guide');
    expect(html).toContain('Intro');
    expect(html).toContain('Pages');
    expect(html).not.toContain('Sous-dossiers');
    expect(html).not.toContain('Aucun sous dossier');
  });

  it('should not render empty pages section', () => {
    const html = renderFolderIndex(
      '/guide',
      [], // No pages
      [{ name: 'advanced', link: '/guide/advanced', count: 1 }]
    );
    expect(html).toContain('Guide');
    expect(html).toContain('advanced');
    expect(html).toContain('Sous-dossiers');
    expect(html).not.toContain('Pages');
    expect(html).not.toContain('Aucune page');
  });

  it('should render only title when no pages and no subfolders', () => {
    const html = renderFolderIndex(
      '/empty',
      [], // No pages
      [] // No subfolders
    );
    expect(html).toContain('Empty');
    expect(html).not.toContain('Pages');
    expect(html).not.toContain('Sous-dossiers');
    expect(html).not.toContain('Aucun');
  });

  it('should render custom content when provided', () => {
    const html = renderFolderIndex('/guide', [], [], '<p>Custom intro text</p>');
    expect(html).toContain('Custom intro text');
    expect(html).toContain('Guide');
  });
});
