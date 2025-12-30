# Folders Settings UI - Enhanced User Experience

## Purpose

The folders settings section has been refactored to eliminate the "scroll-of-doom" and improve usability through progressive disclosure, reduced cognitive load, and error prevention.

## Key Concepts

### Before: All-Expanded View

Previously, every published folder was rendered with all fields visible by default, creating a long vertical list that became difficult to navigate with multiple VPS configurations and folders.

### After: Compact List + Detailed Editor

The new UI separates concerns:

- **Compact list**: Shows essential information at a glance
- **Detailed editor**: Opens on demand for full configuration (one at a time)
- **Search & sort**: Quickly find specific folders
- **Progressive disclosure**: Advanced options (custom index, cleanup rules) hidden until needed

## UI Components

### Toolbar (per VPS section)

**Search field**:

- Case-insensitive text search
- Matches: vault folder path, route, custom index file, ignored cleanup rule IDs
- Real-time filtering (no debounce needed in settings context)
- TODO: Extend to match human-readable rule names/labels (see code comments)

**Sort dropdown**:

- Single criterion selection (simplified UX)
- Options:
  - Folder (A-Z / Z-A)
  - Route (A-Z / Z-A)
  - Custom Index (Yes first)
  - Flattened (Yes first)
  - Exceptions (Most first)
- Stable sort (preserves original order for equal items)

**Reset button**:

- Clears search query
- Resets sort to default (Folder A-Z)

### Compact List

Each folder item displays:

- **Main label**: Vault folder path (or fallback "Empty folder #N")
- **Sub-text**: Publication route
- **Indicators** (visual badges):
  - 📁 Flattened (if `flattenTree: true`)
  - 📄 Custom Index (if `customIndexFile` present)
  - 🚫 N exceptions (if `ignoredCleanupRuleIds` non-empty)
- **Actions**:
  - **Edit** button: Opens detailed editor
  - **Delete** button: Immediate deletion (with last-folder protection)

### Detailed Editor

Opens when user clicks "Edit" on a folder item. Only one editor can be open at a time.

**Basic fields** (always visible):

- Vault folder path (with folder suggester)
- Route base (auto-normalized to `/path` format)
- Flatten tree toggle (with warning if enabled)

**Warning for flatten tree**:
If enabled, displays prominent warning:

> ⚠️ Warning: Flattening the tree can cause slug conflicts if multiple notes share the same filename. Ensure unique names or handle conflicts manually.

**Advanced options** (collapsible `<details>` section):

- Custom index file (with file suggester)
- Ignored cleanup rules (toggle list, same as before)

**Close button**: Collapses editor and returns to compact list view.

## Configuration

No configuration changes required. The refactor is purely UI-level and maintains 100% compatibility with the existing JSON settings schema.

## Usage

### Adding a Folder

1. Click "Add folder" button for target VPS
2. Editor opens automatically for the new folder
3. Configure vault path, route, and options
4. Changes save automatically on each field update
5. Close editor when done

### Editing a Folder

1. Locate folder in compact list (use search/sort if needed)
2. Click "Edit" button
3. Make changes in detailed editor
4. Changes save automatically
5. Close editor to return to list

### Searching Folders

1. Type in search field at top of VPS section
2. List filters in real-time
3. Shows result count ("X result(s)")
4. Displays "No results found" if no matches
5. Click reset to clear

### Sorting Folders

1. Select sort criterion from dropdown
2. List re-sorts immediately
3. Sorting applies after search filtering
4. Click reset to return to default sort

### Deleting a Folder

1. Click "Delete" button on folder item (or in editor)
2. Deletion is immediate (no confirmation modal)
3. Last folder protection: Cannot delete if only one folder remains
4. If editor was open for deleted folder, it auto-closes

## Troubleshooting

### Search not finding expected folder

- Check spelling and case (search is case-insensitive but must match substring)
- Rule IDs match literally; human-readable names not yet implemented (see TODO in code)
- Use reset button to clear any filters

### Editor not opening

- Ensure only one editor is open at a time (close existing one first)
- Check browser console for errors
- Refresh settings tab if state becomes inconsistent

### Changes not persisting

- Each field change triggers auto-save
- Check for validation errors (e.g., duplicate VPS names)
- Verify `loadSettings()` and `saveSettings()` work correctly in plugin main

### UI state reset on settings refresh

- UI state (search, sort, open editor) is ephemeral and resets on `ctx.refresh()`
- This is intentional: avoids stale state issues
- Add/delete/save operations trigger refresh for data consistency

## References

- **Implementation**: [apps/obsidian-vps-publish/src/lib/settings/sections/folders-section.ts](../../apps/obsidian-vps-publish/src/lib/settings/sections/folders-section.ts)
- **Domain entities**: `FolderConfig`, `VpsConfig` in `@core-domain/entities`
- **Settings context**: [apps/obsidian-vps-publish/src/lib/settings/context.ts](../../apps/obsidian-vps-publish/src/lib/settings/context.ts)
- **Related PR**: (to be added when merged)

## Future Enhancements

1. **Search by rule names**: Extend `filterFolders()` to match human-readable cleanup rule labels (requires mapping `rule.nameKey` to translations)
2. **Bulk actions**: Select multiple folders for batch delete/edit
3. **Drag-and-drop reordering**: Persist folder display order
4. **Editor keyboard navigation**: Tab/Enter to navigate fields, Esc to close
5. **Validation feedback**: Real-time validation for slug conflicts (flatten tree mode)
6. **Export/import folder configs**: Share folder configurations between VPS
