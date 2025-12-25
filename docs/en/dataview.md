# Dataview Implementation Guide

## Overview

Dataview and DataviewJS code blocks are automatically processed by the plugin before publishing:

- Queries are executed against the vault
- Results are converted to native Markdown
- The published site renders static HTML (no runtime Dataview dependency)

## Architecture

### Plugin Layer (Obsidian)

**File**: `apps/obsidian-vps-publish/src/lib/dataview/process-dataview-blocks.service.ts`

- Detects Dataview code blocks in vault notes
- Executes queries using Obsidian's Dataview plugin API
- Converts HTML/JS results to Markdown
- Returns processed content ready for publishing

### Application Layer

**Converter**: `libs/core-application/src/lib/dataview/dataview-to-markdown.converter.ts`

Converts Dataview output formats to Markdown:

- **Lists** (`<ul>`, `<ol>`) → Markdown lists (`-`, `1.`)
- **Tables** → Markdown tables with pipes
- **Empty results** → Info callout `> [!info] No Results`
- **Wikilinks** → Normalized format `[[path|title]]` without `.md` extension

### Backend Layer (Express API)

No Dataview-specific processing. The backend receives pre-processed Markdown from the plugin.

## Supported Formats

### Query Types

```dataview
LIST FROM #tag
TABLE field1, field2 FROM "folder"
TASK WHERE !completed
CALENDAR date
```

### DataviewJS

```dataviewjs
dv.list(dv.pages("#tag").map(p => p.file.link))
dv.table(["Name", "Date"], pages.map(p => [p.name, p.date]))
```

## Implementation Details

### Wikilink Normalization

**Problem**: Dataview generates links with `.md` extensions that get corrupted by markdown-it's linkify feature.

**Solution**: `MarkdownLinkNormalizer` strips `.md` and converts to clean wikilink format before Markdown rendering.

**Example**:

- Before: `[[Ektaron/Character.md]]`
- After: `[[Ektaron/Character|Character]]`

### Empty Results Handling

| Type                        | Output                                                    |
| --------------------------- | --------------------------------------------------------- |
| Dataview query (no results) | `> [!info] No Results<br>This query returned no results.` |
| DataviewJS (no output)      | Empty string (no HTML)                                    |

### List Rendering

Ensures clean HTML output without unwanted `<p>` tags inside `<li>` elements:

```markdown
- Item 1
- Item 2
```

Renders as:

```html
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

Not:

```html
<ul>
  <li><p>Item 1</p></li>
</ul>
```

## Testing

### Unit Tests

- `DataviewToMarkdownConverter.test.ts` - Conversion logic
- `MarkdownLinkNormalizer.test.ts` - Link normalization

### Integration Tests

- End-to-end Dataview processing with real vault notes
- Anti-corruption tests to prevent `.md` in links

## Configuration

No backend configuration required. Dataview processing happens in the plugin using Obsidian's API.

## Troubleshooting

### Issue: Dataview blocks not processed

**Cause**: Obsidian's Dataview plugin not installed or disabled.

**Solution**: Ensure Dataview is installed and enabled in Obsidian.

### Issue: Wikilinks show `.md` extension

**Cause**: Old version before normalization fix.

**Solution**: Update to latest version (≥4.7.0).

### Issue: Empty dataview queries show warning

**Cause**: Expected behavior for clarity.

**Solution**: Empty queries intentionally render an info callout.

## Related Documentation

- [Markdown Rendering](./markdown-rendering.md) - Wikilinks, footnotes, tags
- [Architecture](./architecture.md) - Monorepo structure
- [Development](./development.md) - Local setup and testing
