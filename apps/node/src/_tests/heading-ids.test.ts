import { describe, expect, it } from '@jest/globals';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';

import { HeadingSlugger } from '../infra/markdown/heading-slugger';

describe('Markdown-It Heading IDs', () => {
  it('should generate automatic heading IDs with markdown-it-anchor', () => {
    const headingSlugger = new HeadingSlugger();
    const md = new MarkdownIt({ html: true });
    md.use(anchor, {
      slugify: (s: string) => headingSlugger.slugify(s),
      permalink: false,
      level: [1, 2, 3, 4, 5, 6],
    });

    const markdown = '## Système de gouvernance\n\nSome content\n\n### Another Section';
    const html = md.render(markdown);

    console.log('Generated HTML:', html);

    // Check if IDs are generated automatically with proper slugification
    // HeadingSlugger removes accents: "Système de gouvernance" -> "systeme-de-gouvernance"
    expect(html).toContain('id="systeme-de-gouvernance"');
    expect(html).toContain('id="another-section"');
  });
});
