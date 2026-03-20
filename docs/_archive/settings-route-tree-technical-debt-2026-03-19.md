# Settings Technical Debt Note: `folders` and `routeTree`

Date: 2026-03-19

## Context

The plugin currently exposes two overlapping configuration surfaces:

- legacy `vps.folders`
- canonical `vps.routeTree`

The runtime already derives effective folders from `routeTree` when it exists, via `getEffectiveFolders()`. This keeps old callers working, but it also means the folder editor can drift from the canonical source when a VPS has already migrated to `routeTree`.

## Current safe behavior

- route editing should happen in `routes-section.ts`
- route and folder editors now both expose `ignoredCleanupRuleIds`
- folder search now matches cleanup rule display names, not only raw IDs

## Remaining debt

The legacy folder editor still mutates `vps.folders` directly for add/delete flows. That is correct for non-migrated settings, but incomplete for VPS configs already driven by `routeTree`.

## Intended target model

1. Keep `routeTree` as the single editable source of truth.
2. Treat `getEffectiveFolders()` as a compatibility read model only.
3. Either:
   - hide legacy folder mutation controls when `routeTree` is present, or
   - rewrite folder add/delete/edit flows to operate on `routeTree` nodes directly.

## Why this was not fully changed here

The folder editor currently allows edits on `routeBase`, `vaultFolder`, and cleanup exceptions using a flat mental model. Rewriting those flows safely against a hierarchical tree requires explicit UX decisions:

- how to create a new route node from the flat folders screen
- how to represent parent/child placement
- how to preserve `routeBase` semantics while editing tree segments

That is larger than a safe debt-reduction patch, so it is left explicit instead of hidden behind vague TODOs.
