# Link Normalization

## Purpose

Ensures all internal links in rendered HTML follow a consistent wikilink template, regardless of their source (Dataview, Leaflet, or any plugin-generated content). This guarantees uniform routing behavior and CSS styling across the entire application.

## Problem

Plugins like Dataview and Leaflet can generate HTML with links that:

- Include `.md` extensions in `href` attributes
- Use inconsistent CSS classes
- Reference vault paths instead of routed paths
- Don't have the required `data-wikilink` attribute

This created inconsistent navigation and styling issues in the frontend.

## Solution

A post-processing step (`cleanAndNormalizeLinks()`) in `MarkdownItRenderer` that:

1. **Removes `.md` extensions** from all internal links
2. **Adds `wikilink` CSS class** to all internal links
3. **Translates vault paths to routed paths** using the manifest
4. **Adds `data-wikilink` attribute** if missing
5. **Preserves anchors** (#section) in links
6. **Ignores external URLs** (http://, https://, mailto:)

This renderer-level normalization is only reliable if the routing data stays stable across the whole
publication pipeline. Since March 2026, route normalization is enforced before rendering and again
when manifests are loaded, saved, and promoted from staging to production.

## Implementation

### Location

`apps/node/src/infra/markdown/markdown-it.renderer.ts`

### Key Method

```typescript
private cleanAndNormalizeLinks(html: string, manifest?: Manifest): string {
  const $ = load(html);

  $('a').each((_, element) => {
    const $link = $(element);
    let href = $link.attr('href');

    // Skip external URLs
    if (href && this.isExternalUrl(href)) {
      return;
    }

    // Clean .md extension
    let cleanedHref = this.cleanLinkPath(href);

    // Translate vault path to routed path
    if (manifest) {
      cleanedHref = this.translateToRoutedPath(cleanedHref, manifest);
    }

    // Update attributes
    $link.attr('href', cleanedHref);
    $link.attr('data-wikilink', cleanedHref.replace(/^\//, ''));

    // Add wikilink class
    const classes = ($link.attr('class') || '').split(/\s+/).filter(c => c.length > 0);
    if (!classes.includes('wikilink')) {
      classes.push('wikilink');
    }
    $link.attr('class', classes.join(' '));
  });

  return $.html();
}
```

### Integration

The method is called in the `render()` method after markdown conversion:

```typescript
async render(note: PublishableNote, context?: RenderContext): Promise<string> {
  // ... markdown rendering ...

  // Clean and normalize all links (remove .md extensions, add proper classes, translate paths)
  // Pass manifest from context for vault-to-route path translation
  const cleaned = this.cleanAndNormalizeLinks(withStyles, context?.manifest);

  // ... tag filtering ...
}
```

The manifest is passed from `UploadNotesHandler`:

```typescript
const bodyHtml = await this.markdownRenderer.render(note, {
  ignoredTags: this.ignoredTags,
  manifest: manifest ?? undefined,
});
```

## Route invariants

Internal-link rendering now relies on a strict invariant:

- every published page route must be absolute and start with `/`
- every `resolvedWikilinks.href` generated from routing must therefore also be absolute
- manifest route maps (`pages[].route`, `folderDisplayNames` keys, `canonicalMap` keys/values)
  must never contain slashless paths such as `guides/guide`

### Why this matters

If a route becomes relative at any point, a link that looks valid in the manifest can become broken in
the final HTML:

- from `/guides/guide-a`, `href="lore/deep-note"` resolves as a browser-relative path
- the page exists, but the rendered link points to `/guides/lore/deep-note` instead of `/lore/deep-note`
- the site can then report existing notes as orphaned or unavailable even though the vault and manifest
  both contain them

### Normalization points

The route invariant is now enforced in three places:

1. `ComputeRoutingService` generates absolute `fullPath` values and absolute `resolvedWikilinks.href`
2. `ManifestFileSystem` normalizes routes when loading and saving `_manifest.json`
3. `StagingManager` normalizes staged and promoted manifests during session finalization

This makes link resolution deterministic even when notes are rendered in batches and the final manifest
is reconstructed from both staging and production content.

## Examples

### Before Normalization

```html
<!-- Dataview TABLE output -->
<td><a class="internal-link" data-wikilink="Folder/Note1.md">Note1</a></td>
<td><a href="Folder/Note2.md">Note2</a></td>

<!-- Leaflet marker popup -->
<a href="Location.md">Visit Location</a>
```

### After Normalization

```html
<!-- All links normalized -->
<td>
  <a class="internal-link wikilink" data-wikilink="Folder/Note1" href="/folder/note1">Note1</a>
</td>
<td><a class="wikilink" data-wikilink="Folder/Note2" href="/folder/note2">Note2</a></td>

<!-- Routed path from manifest -->
<a class="wikilink" data-wikilink="locations/location" href="/places/locations/location"
  >Visit Location</a
>
```

## Path Translation

The `translateToRoutedPath()` method uses the manifest to find the correct routed path:

1. Extract base path (remove anchor)
2. Normalize path (remove leading slash, `.md` extension)
3. Search manifest pages by:
   - `vaultPath` (exact match)
   - `relativePath` (exact match)
   - Case-insensitive matches of both
4. Return `page.route` if found, or fallback to adding leading slash

This ensures links generated by plugins (which use vault paths) are translated to the correct routed paths as defined by the folder configuration.

## Testing

Comprehensive test suite in `apps/node/src/_tests/markdown-it-renderer.links-normalization.test.ts` covers:

- `.md` extension removal from `href` and `data-wikilink`
- CSS class addition and preservation
- Anchor preservation
- External URL exclusion
- Dataview TABLE/LIST output
- DataviewJS custom HTML
- Vault path to routed path translation
- Case-insensitive matching
- Fallback behavior

Additional regression coverage protects the route invariant itself:

- `libs/core-application/src/lib/_tests/vault-parsing/compute-routing.service.test.ts`
- `apps/node/src/_tests/manifest-file-system.test.ts`
- `apps/node/src/_tests/staging-manager.test.ts`

## Frontend Compatibility

The normalized links work seamlessly with the Angular frontend:

- `href` attributes use routed paths (no `.md`)
- `class="wikilink"` enables consistent styling
- `data-wikilink` provides metadata for tooltips and navigation
- Fragment-only links (#anchor) are handled separately for smooth scrolling

See `apps/site/src/presentation/pages/viewer/viewer.component.ts` for the frontend link handling.

## Troubleshooting

### Links still have `.md` extensions

- Verify the `context?.manifest` is passed to `cleanAndNormalizeLinks()`
- Check that `UploadNotesHandler` loads and passes the manifest
- Run the link normalization tests to verify behavior

### Links not routing correctly

- Check that the page exists in the manifest
- Verify the `vaultPath` or `relativePath` matches the link href
- Review the `translateToRoutedPath()` logic for edge cases

### Styling not applied

- Ensure the `wikilink` class is added by `cleanAndNormalizeLinks()`
- Check that the frontend CSS targets `.wikilink` class
- Verify no CSS specificity conflicts

## References

- Implementation: [markdown-it.renderer.ts](../../apps/node/src/infra/markdown/markdown-it.renderer.ts)
- Tests: [markdown-it-renderer.links-normalization.test.ts](../../apps/node/src/_tests/markdown-it-renderer.links-normalization.test.ts)
- Frontend handling: [viewer.component.ts](../../apps/site/src/presentation/pages/viewer/viewer.component.ts)
- Related: [Dataview Documentation](../../docs/site/dataview.md), [Leaflet Documentation](../../docs/site/leaflet.md)
