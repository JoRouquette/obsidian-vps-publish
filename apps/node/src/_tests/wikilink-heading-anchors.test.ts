import { describe, expect, it } from '@jest/globals';

import { HeadingSlugger } from '../infra/markdown/heading-slugger';
import { MarkdownItRenderer } from '../infra/markdown/markdown-it.renderer';

describe('Wikilinks with Heading Anchors Integration', () => {
  it('should render wikilinks with heading anchors that match heading IDs', async () => {
    const renderer = new MarkdownItRenderer();
    const headingSlugger = new HeadingSlugger();

    // Simulate a note with content containing a heading and a wikilink
    const noteContent = `Voir aussi [[Le Code#Système de gouvernance]]

## Système de gouvernance

Ce texte explique le système.

### Another Section

More content here.`;

    // Simulate wikilinks resolved with subpaths
    const wikilinks = [
      {
        raw: '[[Le Code#Système de gouvernance]]',
        target: 'Le Code',
        path: 'Le Code',
        subpath: 'Système de gouvernance',
        kind: 'page' as const,
        isResolved: true,
        targetNoteId: 'le-code',
        href: '/cultures/le-code#Système de gouvernance', // Will be slugified by renderer
      },
    ];

    const htmlContent = await renderer.render({
      noteId: 'le-code',
      slug: { value: 'le-code', isValid: true },
      title: 'Le Code',
      relativePath: 'cultures/le-code.md',
      content: noteContent,
      frontmatter: {},
      assets: [],
      tags: [],
      resolvedWikilinks: wikilinks,
      folderConfig: { routeBase: '' },
      routing: {
        slug: 'le-code',
        path: 'cultures',
        routeBase: '',
        fullPath: '/cultures/le-code',
      },
    } as any);

    console.log('Generated HTML:', htmlContent);

    // Verify heading has slugified ID
    expect(htmlContent).toContain('id="systeme-de-gouvernance"');

    // Verify the wikilink fragment is also slugified to match
    const expectedSlug = headingSlugger.slugify('Système de gouvernance');
    expect(htmlContent).toContain(`#${expectedSlug}`);
    expect(expectedSlug).toBe('systeme-de-gouvernance');
  });
});
