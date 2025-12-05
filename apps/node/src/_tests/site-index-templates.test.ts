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
  });
});
