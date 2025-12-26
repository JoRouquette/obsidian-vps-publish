import { TagFilterService } from '../infra/markdown/tag-filter.service';

describe('TagFilterService', () => {
  let service: TagFilterService;

  beforeEach(() => {
    service = new TagFilterService();
  });

  it('should return HTML unchanged if no ignored tags', () => {
    const html = '<p>Text with #todo tag</p>';
    const result = service.filterTags(html, []);

    expect(result).toBe(html);
  });

  it('should remove simple ignored tags from text', () => {
    const html = '<p>#todo Buy milk and eggs</p>';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('Buy milk and eggs');
    expect(result).not.toContain('#todo');
  });

  it('should remove accented tags (à-faire, afaire)', () => {
    const html = '<p>#à-faire Finish report #afaire Review</p>';
    const result = service.filterTags(html, ['à-faire', 'afaire']);

    expect(result).toContain('Finish report');
    expect(result).toContain('Review');
    expect(result).not.toContain('#à-faire');
    expect(result).not.toContain('#afaire');
  });

  it('should be case-insensitive', () => {
    const html = '<p>#TODO #Todo #todo All same</p>';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('All same');
    expect(result).not.toContain('#TODO');
    expect(result).not.toContain('#Todo');
    expect(result).not.toContain('#todo');
  });

  it('should preserve C# and other valid code tokens', () => {
    const html = '<p>Programming in C# is fun</p>';
    const result = service.filterTags(html, ['todo', 'C']);

    expect(result).toContain('Programming in C# is fun');
    expect(result).toContain('C#');
  });

  it('should NOT remove tags from code blocks', () => {
    const html = '<p>Example: <code>#todo</code> in code</p>';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('<code>#todo</code>');
  });

  it('should NOT remove tags from pre blocks', () => {
    const html = '<pre><code>#todo Fix bug\n#urgent</code></pre>';
    const result = service.filterTags(html, ['todo', 'urgent']);

    expect(result).toContain('#todo');
    expect(result).toContain('#urgent');
  });

  it('should remove tags from footnotes section', () => {
    const html = `
      <p>Main text with footnote<sup>1</sup></p>
      <section class="footnotes">
        <ol>
          <li id="fn-1">
            <p>#todo This is a footnote content</p>
          </li>
        </ol>
      </section>
    `;
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('This is a footnote content');
    expect(result).not.toContain('#todo');
  });

  it('should NOT modify href attributes', () => {
    const html = '<p>Link: <a href="#fn-1">Go to footnote</a></p>';
    const result = service.filterTags(html, ['fn']);

    // Href should remain intact
    expect(result).toContain('href="#fn-1"');
    expect(result).toContain('Go to footnote');
  });

  it('should NOT modify id attributes', () => {
    const html = '<h2 id="dédommagements">Dédommagements</h2>';
    const result = service.filterTags(html, ['dédommagements']);

    expect(result).toContain('id="dédommagements"');
  });

  it('should remove multiple tags in same paragraph', () => {
    const html = '<p>#todo #urgent #wip Task description</p>';
    const result = service.filterTags(html, ['todo', 'urgent', 'wip']);

    expect(result).toContain('Task description');
    expect(result).not.toContain('#todo');
    expect(result).not.toContain('#urgent');
    expect(result).not.toContain('#wip');
  });

  it('should clean up double spaces after tag removal', () => {
    const html = '<p>#todo  Double  space  test</p>';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('Double space test');
    expect(result).not.toContain('  '); // No double spaces
  });

  it('should handle tags at start of text node', () => {
    const html = '<p>#todo Start of line</p>';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('Start of line');
    expect(result).not.toContain('#todo');
  });

  it('should handle tags at end of text node', () => {
    const html = '<p>End of line #todo</p>';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('End of line');
    expect(result).not.toContain('#todo');
  });

  it('should handle tags with hyphens and underscores', () => {
    const html = '<p>#to-do #work_item #in-progress Tasks</p>';
    const result = service.filterTags(html, ['to-do', 'work_item', 'in-progress']);

    expect(result).toContain('Tasks');
    expect(result).not.toContain('#to-do');
    expect(result).not.toContain('#work_item');
    expect(result).not.toContain('#in-progress');
  });

  it('should handle Unicode tags (Japanese, Cyrillic, etc.)', () => {
    const html = '<p>#日本 #Москва Some text</p>';
    const result = service.filterTags(html, ['日本', 'Москва']);

    expect(result).toContain('Some text');
    expect(result).not.toContain('#日本');
    expect(result).not.toContain('#Москва');
  });

  it('should not break HTML structure', () => {
    const html = `
      <div class="callout">
        <div class="callout-content">
          <p>#todo Callout content</p>
        </div>
      </div>
    `;
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('<div class="callout">');
    expect(result).toContain('Callout content');
    expect(result).not.toContain('#todo');
  });

  it('should handle complex HTML with nested elements', () => {
    const html = `
      <article>
        <h1>Title</h1>
        <p>#urgent <strong>Bold</strong> text with <em>emphasis</em> #todo</p>
        <ul>
          <li>#wip Item one</li>
          <li>Item two #done</li>
        </ul>
      </article>
    `;
    const result = service.filterTags(html, ['urgent', 'todo', 'wip', 'done']);

    expect(result).toContain('<strong>Bold</strong>');
    expect(result).toContain('<em>emphasis</em>');
    expect(result).toContain('Item one');
    expect(result).toContain('Item two');
    expect(result).not.toContain('#urgent');
    expect(result).not.toContain('#todo');
    expect(result).not.toContain('#wip');
    expect(result).not.toContain('#done');
  });

  it('should preserve hashtags in URLs', () => {
    const html = '<p>Visit <a href="https://example.com/#section">link</a></p>';
    const result = service.filterTags(html, ['section']);

    expect(result).toContain('href="https://example.com/#section"');
  });

  it('should handle empty tags list gracefully', () => {
    const html = '<p>#todo Some text</p>';
    const result = service.filterTags(html, []);

    expect(result).toBe(html);
  });

  it('should handle malformed HTML gracefully', () => {
    const html = '<p>#todo Unclosed paragraph';
    const result = service.filterTags(html, ['todo']);

    expect(result).toContain('Unclosed paragraph');
    expect(result).not.toContain('#todo');
  });

  it('should normalize accent variations (NFKD)', () => {
    const html = '<p>#café #cafe Both variants</p>';
    const result = service.filterTags(html, ['cafe']); // normalized form

    expect(result).toContain('Both variants');
    // Both should be removed as they normalize to same form
    expect(result).not.toContain('#café');
    expect(result).not.toContain('#cafe');
  });

  it('should remove tags from headings', () => {
    const html = `
      <h1>Title #à-faire</h1>
      <h2>Subtitle #todo</h2>
      <h3>Section #wip</h3>
      <h4 id="initiation-au-code-a-completer">Initiation au Code #à-compléter</h4>
    `;
    const result = service.filterTags(html, ['à-faire', 'todo', 'wip', 'à-compléter']);

    expect(result).toContain('Title');
    expect(result).toContain('Subtitle');
    expect(result).toContain('Section');
    expect(result).toContain('Initiation au Code');
    expect(result).not.toContain('#à-faire');
    expect(result).not.toContain('#todo');
    expect(result).not.toContain('#wip');
    expect(result).not.toContain('#à-compléter');
  });

  it('should remove tags from blockquotes', () => {
    const html = `
      <blockquote>
        <p>#à-faire Ajouter des récits ou exemples spécifiques de procès mémorables.</p>
      </blockquote>
      <blockquote>
        <p>#todo Développer cette sous-section pour explorer comment le Code influence les cultures.</p>
      </blockquote>
    `;
    const result = service.filterTags(html, ['à-faire', 'todo']);

    expect(result).toContain('Ajouter des récits ou exemples spécifiques de procès mémorables.');
    expect(result).toContain(
      'Développer cette sous-section pour explorer comment le Code influence les cultures.'
    );
    expect(result).not.toContain('#à-faire');
    expect(result).not.toContain('#todo');
  });

  it('should handle complete document with various tag locations', () => {
    const html = `
      <div class="markdown-body">
        <h1 id="le-code">Le Code</h1>
        <h3 id="personnages-historiques-a-completer">Personnages historiques #à-compléter</h3>
        <p>Some content here.</p>
        <h4 id="mythes-et-legendes-a-completer">Mythes et légendes #à-compléter</h4>
        <blockquote>
          <p>#à-faire Ajouter des récits ou exemples spécifiques.</p>
        </blockquote>
        <h4 id="spectre-argent-a-completer">Spectre Argent #à-compléter</h4>
      </div>
    `;
    const result = service.filterTags(html, ['à-compléter', 'à-faire']);

    expect(result).toContain('Personnages historiques');
    expect(result).toContain('Mythes et légendes');
    expect(result).toContain('Spectre Argent');
    expect(result).toContain('Ajouter des récits ou exemples spécifiques.');
    expect(result).not.toContain('#à-compléter');
    expect(result).not.toContain('#à-faire');
  });
});
