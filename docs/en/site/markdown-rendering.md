# Markdown Rendering Guide

## Overview

This guide covers advanced Markdown rendering features implemented in the backend to ensure compatibility with Obsidian syntax.

## Features

### 1. Wikilinks to Headings

**Support**: Links to specific headings within pages, e.g., `[[#Introduction]]` or `[[Page#Section]]`.

#### Implementation

**Service**: `apps/node/src/infra/markdown/heading-slugger.ts`

Converts heading text to URL-safe slugs matching markdown-it's ID generation:

```typescript
slugify('Système de gouvernance'); // → 'systeme-de-gouvernance'
slugify('Héros & Légendes'); // → 'heros-legendes'
```

**Algorithm**:

1. Unicode normalization (NFKD)
2. Remove diacritics
3. Lowercase
4. Replace non-alphanumeric with hyphens
5. Collapse consecutive hyphens
6. Trim edges

#### Renderer Integration

In `markdown-it.renderer.ts`, the `renderWikilink()` method detects `#` anchors and applies slugification:

```typescript
if (hrefTarget.includes('#')) {
  const [path, heading] = hrefTarget.split('#');
  if (heading) {
    const slug = this.headingSlugger.slugify(heading);
    hrefTarget = path ? `${path}#${slug}` : `#${slug}`;
  }
}
```

#### Examples

| Input                   | Generated Link                                   |
| ----------------------- | ------------------------------------------------ |
| `[[#Introduction]]`     | `<a href="#introduction">Introduction</a>`       |
| `[[Page#Système]]`      | `<a href="Page#systeme">Système</a>`             |
| `[[#Héros & Légendes]]` | `<a href="#heros-legendes">Héros & Légendes</a>` |

#### Tests

**File**: `apps/node/src/_tests/heading-slugger.test.ts`

- 12 tests covering accents, special characters, edge cases
- Real-world examples from French content

### 2. Footnote ID Normalization

**Problem**: markdown-it-footnote generates IDs with colons (`fn:1`, `fnref:1`) that break CSS selectors and JavaScript queries.

**Solution**: Override markdown-it-footnote renderers to use hyphens (`fn-1`, `fnref-1`).

#### Implementation

**Service**: `apps/node/src/infra/markdown/markdown-it.renderer.ts`

Custom renderers override 5 footnote rules:

```typescript
// Footnote reference (superscript link)
this.md.renderer.rules.footnote_ref = (tokens, idx) => {
  const id = Number(tokens[idx].meta.id + 1);
  const refId = `fnref-${id}`;
  return `<sup class="footnote-ref"><a href="#fn-${id}" id="${refId}">${id}</a></sup>`;
};

// Footnote item
this.md.renderer.rules.footnote_open = (tokens, idx) => {
  const id = Number(tokens[idx].meta.id + 1);
  return `<li id="fn-${id}" class="footnote-item">`;
};

// Back-reference link
this.md.renderer.rules.footnote_anchor = (tokens, idx) => {
  const id = Number(tokens[idx].meta.id + 1);
  return ` <a href="#fnref-${id}" class="footnote-backref">↩</a>`;
};
```

#### Generated HTML

**Before (default markdown-it-footnote)**:

```html
<sup><a href="#fn:1" id="fnref:1">1</a></sup>
<li id="fn:1">Footnote content <a href="#fnref:1">↩</a></li>
```

**After (normalized)**:

```html
<sup><a href="#fn-1" id="fnref-1">1</a></sup>
<li id="fn-1">Footnote content <a href="#fnref-1">↩</a></li>
```

#### CSS Compatibility

With normalized IDs, CSS selectors work correctly:

```css
.footnote-item[id^='fn-'] {
  /* styles */
}
#fn-1,
#fn-2,
#fn-3 {
  /* specific styles */
}
```

#### Examples

| Markdown     | HTML (normalized)                                   |
| ------------ | --------------------------------------------------- |
| `Text[^1]`   | `<sup><a href="#fn-1" id="fnref-1">1</a></sup>`     |
| `[^1]: Note` | `<li id="fn-1">Note <a href="#fnref-1">↩</a></li>` |

### 3. Tag Filtering

**Feature**: Automatically removes Obsidian hashtags from rendered HTML while preserving content structure.

**Configuration**: Tags to filter are defined in plugin settings (`Ignore Rules > Tags`).

#### Implementation

**Service**: `apps/node/src/infra/markdown/tag-filter.service.ts`

Uses cheerio to traverse the entire DOM tree and remove configured tags from text nodes:

```typescript
filterTags(html: string, ignoredTags: string[]): string {
  const $ = cheerio.load(html, { decodeEntities: false });

  // Normalize tags with NFKD Unicode normalization
  const normalized = ignoredTags.map(tag =>
    tag.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  );

  // Recursive processing
  const processTextInElement = (element: cheerio.Cheerio) => {
    element.contents().each((_, node) => {
      if (node.type === 'text') {
        // Replace tags in text nodes
        node.data = node.data.replace(tagPattern, (match, prefix, tag) => {
          const tagNormalized = tag.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return normalized.includes(tagNormalized) ? prefix : match;
        });
      } else if (node.type === 'tag' && !skipElements.includes(node.name)) {
        processTextInElement($(node));
      }
    });
  };

  // Process entire tree starting from root
  const root = $('body').length > 0 ? $('body') : $.root();
  processTextInElement(root);

  return $.html();
}
```

#### Key Features

1. **Unicode normalization**: Handles accented tags (`#à-faire` matched against `a-faire`)
2. **Full DOM traversal**: Processes tags in headings, blockquotes, lists, paragraphs
3. **Code preservation**: Skips `<code>`, `<pre>`, `<script>`, `<style>` elements
4. **Attribute preservation**: Tags in HTML attributes remain unchanged

#### Examples

| HTML Input                                   | Filtered Output                              |
| -------------------------------------------- | -------------------------------------------- |
| `<h1>Title #todo</h1>`                       | `<h1>Title</h1>`                             |
| `<blockquote><p>#note Text</p></blockquote>` | `<blockquote><p>Text</p></blockquote>`       |
| `<p>Code: <code>#tag</code></p>`             | `<p>Code: <code>#tag</code></p>` (preserved) |
| `<a href="#todo">Link</a>`                   | `<a href="#todo">Link</a>` (preserved)       |

#### Tests

**File**: `apps/node/src/_tests/tag-filter.service.test.ts`

- 25 tests covering various HTML structures
- Tests for headings, blockquotes, complete documents
- Unicode normalization tests
- Code preservation tests

## Configuration

No user configuration required for wikilinks and footnotes. Tag filtering uses the plugin's `ignoredTags` setting.

## Dependencies

| Package              | Version | Purpose               |
| -------------------- | ------- | --------------------- |
| markdown-it          | ^14.1.0 | Core Markdown parser  |
| markdown-it-footnote | ^4.0.0  | Footnote support      |
| cheerio              | ^1.1.2  | HTML/DOM manipulation |

## Testing

All features have comprehensive test coverage:

- **HeadingSlugger**: 12 tests (accents, special chars, edge cases)
- **TagFilterService**: 25 tests (DOM traversal, Unicode, code preservation)
- **MarkdownItRenderer**: Integration tests for footnotes and wikilinks

## Related Documentation

- [Development](./development.md) - Local setup and testing
- [Architecture](./architecture.md) - Backend service architecture
- [Dataview](./dataview.md) - Dataview processing

## Troubleshooting

### Issue: Wikilink to heading doesn't work

**Cause**: Heading text contains special characters not properly slugified.

**Solution**: The slugger handles most cases automatically. Check browser console for actual generated IDs.

### Issue: Tags still appear in HTML

**Cause**: Tag not configured in plugin settings.

**Solution**: Add the tag to `Settings > Ignore Rules > Tags`.

### Issue: Footnote links broken

**Cause**: Custom CSS assuming old ID format.

**Solution**: Update CSS selectors to use new format (`fn-1` instead of `fn:1`).

## Implementation Files

| File                        | Purpose                    | Lines |
| --------------------------- | -------------------------- | ----- |
| `heading-slugger.ts`        | Slug generation            | 47    |
| `tag-filter.service.ts`     | Tag removal                | 88    |
| `markdown-it.renderer.ts`   | Renderer with custom rules | 314   |
| `markdown-it-footnote.d.ts` | TypeScript types           | 6     |

Total: 455 lines of production code + 108 lines of tests.
