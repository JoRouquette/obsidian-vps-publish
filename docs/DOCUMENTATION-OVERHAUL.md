# Documentation Overhaul - December 2025

## What Changed

This overhaul reorganized the documentation to eliminate redundancies, improve navigation, and provide English translations for core documents.

## Key Changes

### 1. Consolidated Documentation

**Dataview docs** (removed 6 files, created 1 consolidated):

- ❌ Deleted: `DATAVIEW-CLEANUP-SUMMARY.md`, `DATAVIEW-STRIP-PLAN.md`, `DATAVIEW-STRIP-QUICK-REFERENCE.md`, `DATAVIEW-BUG-DIAGNOSIS.md`, `DATAVIEW-FIX-SUMMARY.md`, `DATAVIEW-LISTS-RENDERING-FIX.md` (archives)
- ✅ Created: `dataview.md` (consolidated guide)

**Removed obsolete/redundant files**:

- ❌ `dataview-markdown-native-implementation.md` (redundant with `dataview.md`)
- ❌ `oversize-removal.md` (obsolete)

**Total reduction**: ~1900 lines of redundant documentation removed.

### 2. English Translations

Created **`docs/en/`** subfolder with translations of core documents:

- ✅ `architecture.md` - Clean Architecture, CQRS, monorepo structure
- ✅ `development.md` - Setup, workflows, testing, contributing
- ✅ `markdown-rendering.md` - Wikilinks, footnotes, tags filtering
- ✅ `dataview.md` - Dataview/DataviewJS implementation
- ✅ `README.md` - Navigation guide for English docs

### 3. Updated Documentation Index

**`documentation-index.md`** completely restructured:

- ✅ Bilingual support (French primary, English translations noted)
- ✅ Clear categorization: Core, Features, Performance, Testing, References
- ✅ Navigation by role (Contributors, Deployment, Performance)
- ✅ Navigation by feature (Markdown, Dataview, Maps, Images, Theme)
- ✅ No redundant entries

### 4. Help Component Updates

Updated plugin help modal (`apps/obsidian-vps-publish/src/i18n/locales.ts`):

- ✅ Added Markdown Rendering section
- ✅ Clarified tag filtering: "Tags configured in Settings > Ignore Rules are automatically removed"
- ✅ Bilingual (EN + FR)

## File Organization

```
docs/
├── documentation-index.md (main index, restructured)
├── dataview.md (NEW - consolidated guide)
├── rendu-markdown.md (NEW - Markdown rendering)
├── en/ (NEW - English translations)
│   ├── README.md
│   ├── architecture.md
│   ├── development.md
│   ├── markdown-rendering.md
│   └── dataview.md
└── [other existing docs...]
```

## Documentation Principles

1. **No Redundancy**: Each topic covered once in primary location, with references where needed
2. **Bilingual Core**: Essential docs available in FR (primary) and EN (translations in `docs/en/`)
3. **Clear Navigation**: Index provides role-based and feature-based navigation
4. **Consolidated Guides**: Similar topics merged into single comprehensive documents
5. **Clean Archive Policy**: Obsolete and redundant files removed, not archived

## Benefits

- ✅ **Reduced maintenance burden**: ~1900 lines fewer docs to maintain
- ✅ **Improved discoverability**: Clear index with categorization
- ✅ **International accessibility**: Key docs available in English
- ✅ **Better organization**: Clean structure without archive bloat
- ✅ **Clearer intent**: Help component explicitly mentions tag filtering configuration

## Migration Guide

### For Contributors

- Use `documentation-index.md` as your starting point
- Core docs in French (root), translations in `docs/en/`
- Technical troubleshooting refs in `docs/references/`

### For English Readers

- Start with `docs/en/README.md`
- Core translated docs available

### Broken Links

If you had bookmarks to deleted files:

| Old File                                  | New Location              |
| ----------------------------------------- | ------------------------- |
| `DATAVIEW-*.md`                           | `docs/dataview.md`        |
| `dataview-markdown-native-implementation` | `docs/dataview.md`        |
| `oversize-removal.md`                     | Removed (obsolete)        |
| `docs/references/dataview/`               | Removed (archives purged) |

## Statistics

- **Files deleted**: 9 (6 DATAVIEW archives + 3 obsolete files)
- **Files created**: 6 (dataview.md, rendu-markdown.md, en/\*.md, en/README.md)
- **Lines removed**: ~1900
- **Lines added (new content)**: ~800 (consolidated + translations)
- **Net reduction**: ~1100 lines

## Next Steps

Future documentation work should:

1. Add missing English translations (docker.md, release.md, leaflet-\*.md)
2. Consolidate performance docs (3+ files → 1 guide)
3. Consolidate theme docs (its-theme-\*.md → single guide)
4. **Archive policy**: Delete obsolete files rather than moving to `references/`

---

**Date**: December 25, 2025  
**Related PR**: feat/footnotes  
**Author**: Documentation overhaul as part of Markdown rendering feature
