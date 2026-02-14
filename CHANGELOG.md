## <small>6.5.2 (2026-02-14)</small>

* Merge branch 'fix/mobile-image-style' ([c09cbb4](https://github.com/JoRouquette/obsidian-vps-publish/commit/c09cbb4))
* fix(site): center all images on mobile devices ([cce43bd](https://github.com/JoRouquette/obsidian-vps-publish/commit/cce43bd))

## <small>6.5.1 (2026-02-14)</small>

* fix(node): downgrade file-type to v16.5.4 for Node.js 16 compatibility ([84572bc](https://github.com/JoRouquette/obsidian-vps-publish/commit/84572bc))

## 6.5.0 (2026-02-14)

* test: increase timeout and relax assertions in session finalization test ([1c32f51](https://github.com/JoRouquette/obsidian-vps-publish/commit/1c32f51))
* Merge branch 'feat/better-callouts-in-site' ([3a25778](https://github.com/JoRouquette/obsidian-vps-publish/commit/3a25778))
* feat(assets): add MIME detection and size validation for uploaded assets ([518b132](https://github.com/JoRouquette/obsidian-vps-publish/commit/518b132))
* feat(callout): add support for Obsidian callout type aliases ([6238a0b](https://github.com/JoRouquette/obsidian-vps-publish/commit/6238a0b))
* feat(deduplication): add promotion statistics tracking ([9593799](https://github.com/JoRouquette/obsidian-vps-publish/commit/9593799))
* feat(plugin): add background throttle monitoring and diagnostics ([0bf12f1](https://github.com/JoRouquette/obsidian-vps-publish/commit/0bf12f1))
* feat(publishing): implement inter-publication note deduplication ([74ff595](https://github.com/JoRouquette/obsidian-vps-publish/commit/74ff595))
* feat(security): add virus scanning for uploaded assets ([d4a9242](https://github.com/JoRouquette/obsidian-vps-publish/commit/d4a9242))
* fix(assets): implement SHA256 deduplication and selective promotion ([9e197fa](https://github.com/JoRouquette/obsidian-vps-publish/commit/9e197fa))

## 6.4.0 (2026-02-13)

* Merge branch 'feat/wikilinks_and_vault_explorer' ([1a51a22](https://github.com/JoRouquette/obsidian-vps-publish/commit/1a51a22))
* fix: correct workflow errors (linting and env config tests) ([95e4c02](https://github.com/JoRouquette/obsidian-vps-publish/commit/95e4c02))
* fix(backend): preserve URL fragments in link validation ([643e5fa](https://github.com/JoRouquette/obsidian-vps-publish/commit/643e5fa)), closes [Note#Section](https://github.com/Note/issues/Section) [#fragment](https://github.com/JoRouquette/obsidian-vps-publish/issues/fragment)
* docs: add local development guides ([8d51bf1](https://github.com/JoRouquette/obsidian-vps-publish/commit/8d51bf1))
* style(ui): improve mobile image responsive behavior ([1c9fe0c](https://github.com/JoRouquette/obsidian-vps-publish/commit/1c9fe0c))
* feat(backend): add fragment to resolved wikilink hrefs ([750a365](https://github.com/JoRouquette/obsidian-vps-publish/commit/750a365)), closes [Note#Header](https://github.com/Note/issues/Header)
* feat(frontend): implement fragment-based navigation with scroll ([65d9070](https://github.com/JoRouquette/obsidian-vps-publish/commit/65d9070))
* feat(ui): add clear button to search bar ([4045955](https://github.com/JoRouquette/obsidian-vps-publish/commit/4045955))
* test(backend): add wikilink header resolution tests ([e3c6be0](https://github.com/JoRouquette/obsidian-vps-publish/commit/e3c6be0)), closes [s#Vision](https://github.com/s/issues/Vision)
* test(frontend): add wikilink header navigation e2e tests ([7edf2ff](https://github.com/JoRouquette/obsidian-vps-publish/commit/7edf2ff)), closes [#heading](https://github.com/JoRouquette/obsidian-vps-publish/issues/heading) [page#heading](https://github.com/page/issues/heading)
* chore: setup local development environment without Docker ([bd65736](https://github.com/JoRouquette/obsidian-vps-publish/commit/bd65736))

## 6.3.0 (2026-02-12)

* Merge branch 'docs/better-documentation' ([3cc6a3b](https://github.com/JoRouquette/obsidian-vps-publish/commit/3cc6a3b))
* Merge branch 'fix/images-integration' ([16f32aa](https://github.com/JoRouquette/obsidian-vps-publish/commit/16f32aa))
* feat(images): implement float wrapping and responsive sizing for floated assets ([dd044bf](https://github.com/JoRouquette/obsidian-vps-publish/commit/dd044bf))
* docs: consolidate documentation per charter, remove orphaned files ([7d7a4d2](https://github.com/JoRouquette/obsidian-vps-publish/commit/7d7a4d2))
* fix(site): simplify asset styling and remove decorative effects ([37a0108](https://github.com/JoRouquette/obsidian-vps-publish/commit/37a0108))

## <small>6.2.4 (2026-02-03)</small>

* Merge branch 'fix/images-integration' ([adf4211](https://github.com/JoRouquette/obsidian-vps-publish/commit/adf4211))
* fix(ui): wrap floated images in figure elements for proper CSS isolation ([1008848](https://github.com/JoRouquette/obsidian-vps-publish/commit/1008848))

## <small>6.2.3 (2026-02-03)</small>

* Merge branch 'fix/images-integration' ([6f71511](https://github.com/JoRouquette/obsidian-vps-publish/commit/6f71511))
* fix(site): adjust floated image margins and prevent text overlap ([fbfc1e3](https://github.com/JoRouquette/obsidian-vps-publish/commit/fbfc1e3))

## <small>6.2.2 (2026-02-03)</small>

* Merge branch 'fix/images-integration' ([f8dce1a](https://github.com/JoRouquette/obsidian-vps-publish/commit/f8dce1a))
* fix(site): correct inline image sizing and clear behavior ([f2d1090](https://github.com/JoRouquette/obsidian-vps-publish/commit/f2d1090))

## <small>6.2.1 (2026-02-03)</small>

* Merge branch 'fix/images-integration' ([ef40a4b](https://github.com/JoRouquette/obsidian-vps-publish/commit/ef40a4b))
* fix(site): improve inline image text wrapping with margin-box shape-outside ([f07ca1b](https://github.com/JoRouquette/obsidian-vps-publish/commit/f07ca1b))

## 6.2.0 (2026-02-02)

* feat(seo)!: add comprehensive SEO implementation with meta tags, sitemap, and redirects ([5d36140](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d36140))
* Merge branch 'feat/add-seo' ([cf26ca2](https://github.com/JoRouquette/obsidian-vps-publish/commit/cf26ca2))
* Merge branch 'fix/images-and-settings' ([1a42df2](https://github.com/JoRouquette/obsidian-vps-publish/commit/1a42df2))
* fix(plugin): move route validation to save action instead of display ([f47858f](https://github.com/JoRouquette/obsidian-vps-publish/commit/f47858f))
* feat(plugin): add drag & drop route management with temporary state ([9edbf74](https://github.com/JoRouquette/obsidian-vps-publish/commit/9edbf74))
* docs(seo): consolidate SEO documentation into single reference guide ([9d354f6](https://github.com/JoRouquette/obsidian-vps-publish/commit/9d354f6))

## <small>6.1.4 (2026-01-11)</small>

* Merge branch 'fix/several-bugs' ([10e5b71](https://github.com/JoRouquette/obsidian-vps-publish/commit/10e5b71))
* fix(api): normalize all links to use proper routing and prevent broken wikilinks ([9c9c9a7](https://github.com/JoRouquette/obsidian-vps-publish/commit/9c9c9a7))
* fix(backend): remove .md extensions from Dataview HTML links via post-processing ([0cc027a](https://github.com/JoRouquette/obsidian-vps-publish/commit/0cc027a)), closes [#section](https://github.com/JoRouquette/obsidian-vps-publish/issues/section)
* docs(plugin): improve help content for Dataview and no-publishing marker ([4afb38e](https://github.com/JoRouquette/obsidian-vps-publish/commit/4afb38e))
* refactor(core-app): improve no-publishing marker service documentation and tests ([c532638](https://github.com/JoRouquette/obsidian-vps-publish/commit/c532638))

## <small>6.1.3 (2026-01-02)</small>

* Merge branch 'fix/dataview-rendering' ([1ff85a7](https://github.com/JoRouquette/obsidian-vps-publish/commit/1ff85a7))
* fix(dataview): preserve HTML formatting in DataviewJS blocks ([73d608d](https://github.com/JoRouquette/obsidian-vps-publish/commit/73d608d))

## <small>6.1.2 (2026-01-02)</small>

* fix(publishing): pass folderDisplayNames through session finalization to renderer ([a34a7a8](https://github.com/JoRouquette/obsidian-vps-publish/commit/a34a7a8))

## <small>6.1.1 (2026-01-01)</small>

* fix(plugin): validate route tree on settings save and prevent multiple root routes ([03cf1e9](https://github.com/JoRouquette/obsidian-vps-publish/commit/03cf1e9))

## 6.1.0 (2026-01-01)

* Merge branch 'feat/better-settings-and-html-conversion' ([d9fcebe](https://github.com/JoRouquette/obsidian-vps-publish/commit/d9fcebe))
* feat(routes): pass folder display names from plugin to backend ([eb2337a](https://github.com/JoRouquette/obsidian-vps-publish/commit/eb2337a))

## <small>6.0.3 (2026-01-01)</small>

* fix(core): remove folderDisplayName from pages, use manifest-level folderDisplayNames ([88a02b6](https://github.com/JoRouquette/obsidian-vps-publish/commit/88a02b6))

## <small>6.0.2 (2026-01-01)</small>

* fix(routing): improve slug deduplication and validation ([07941ea](https://github.com/JoRouquette/obsidian-vps-publish/commit/07941ea))

## <small>6.0.1 (2026-01-01)</small>

* fix(logging): serialize Error objects in structured logs ([2fbc8ae](https://github.com/JoRouquette/obsidian-vps-publish/commit/2fbc8ae))

## 6.0.0 (2026-01-01)

* feat(route-tree)!: implement route-first navigation model ([23cbfb3](https://github.com/JoRouquette/obsidian-vps-publish/commit/23cbfb3))
* Merge branch 'feat/route-tree-by-vps' ([5f0a11d](https://github.com/JoRouquette/obsidian-vps-publish/commit/5f0a11d))
* chore(plugin): migrate custom indexes to route tree during VPS migration ([f40760a](https://github.com/JoRouquette/obsidian-vps-publish/commit/f40760a))
* chore(routes): add folder display names support across plugin, backend, and frontend ([899beea](https://github.com/JoRouquette/obsidian-vps-publish/commit/899beea))


### BREAKING CHANGE

* VPS configuration now uses route tree instead of flat folders array.
The new `routeTree` property replaces the legacy `folders` array. Existing configurations
are automatically migrated on plugin load. Routes can now exist independently of vault
folders (pure route nodes), enabling flexible URL structures.

## 5.2.0 (2025-12-31)

* Merge branch 'feat/additionnal-files' ([0fe7876](https://github.com/JoRouquette/obsidian-vps-publish/commit/0fe7876))
* feat: add note deduplication service to prevent slug collisions ([e7862b5](https://github.com/JoRouquette/obsidian-vps-publish/commit/e7862b5))
* feat(plugin): add additional files support for folder publishing ([7e1d560](https://github.com/JoRouquette/obsidian-vps-publish/commit/7e1d560))

## 5.1.0 (2025-12-30)

* Merge branch 'fix/improve-setting-ui' ([785e5e5](https://github.com/JoRouquette/obsidian-vps-publish/commit/785e5e5))
* feat(plugin): enhance folders settings UI with search, sort, and compact list ([96c8db4](https://github.com/JoRouquette/obsidian-vps-publish/commit/96c8db4))

## 5.0.0 (2025-12-30)

* docs: add performance enhancements implementation summary ([b403930](https://github.com/JoRouquette/obsidian-vps-publish/commit/b403930))
* docs: add performance testing and validation guide ([74948b9](https://github.com/JoRouquette/obsidian-vps-publish/commit/74948b9))
* docs: add performance validation script and corrections summary ([abf465f](https://github.com/JoRouquette/obsidian-vps-publish/commit/abf465f))
* docs: remove obsolete performance implementation and diagnostic files ([41c00b0](https://github.com/JoRouquette/obsidian-vps-publish/commit/41c00b0))
* docs(api): add comprehensive load testing documentation ([6ff39ac](https://github.com/JoRouquette/obsidian-vps-publish/commit/6ff39ac))
* docs(loadtest): add reports directory documentation and allow .gitkeep ([8269083](https://github.com/JoRouquette/obsidian-vps-publish/commit/8269083))
* docs(plugin): add Phase 1 performance analysis documentation ([b8290f3](https://github.com/JoRouquette/obsidian-vps-publish/commit/b8290f3))
* feat(api)!: implement async session finalization with performance instrumentation ([49fe95e](https://github.com/JoRouquette/obsidian-vps-publish/commit/49fe95e))
* Merge branch 'perf/performance-enhancing' ([d1216ba](https://github.com/JoRouquette/obsidian-vps-publish/commit/d1216ba))
* perf(plugin,api): throttle UI updates, add compression yielding, implement backpressure ([eb95557](https://github.com/JoRouquette/obsidian-vps-publish/commit/eb95557))
* test(plugin,api): add performance instrumentation and synthetic vault generator ([0c04a9b](https://github.com/JoRouquette/obsidian-vps-publish/commit/0c04a9b))
* perf: optimize API performance with 3 targeted improvements ([17126dd](https://github.com/JoRouquette/obsidian-vps-publish/commit/17126dd))
* perf(plugin): add configurable concurrency limits to prevent UI freeze ([6e1f028](https://github.com/JoRouquette/obsidian-vps-publish/commit/6e1f028))
* perf(plugin): optimize imports and improve test reliability ([965cba9](https://github.com/JoRouquette/obsidian-vps-publish/commit/965cba9))
* test(loadtest): add artillery load test infrastructure with DTO-compliant payload generators ([eedc7e9](https://github.com/JoRouquette/obsidian-vps-publish/commit/eedc7e9))
* test(loadtest): add payload generator validation script ([32747f3](https://github.com/JoRouquette/obsidian-vps-publish/commit/32747f3))
* test(plugin): replace obsolete performance tests with Phase 1 instrumentation tests ([1fceace](https://github.com/JoRouquette/obsidian-vps-publish/commit/1fceace))
* fix(plugin): disable outdated performance smoke tests temporarily ([6e77717](https://github.com/JoRouquette/obsidian-vps-publish/commit/6e77717))
* feat: add configurable size distributions and increased note counts for comprehensive testing ([a71658f](https://github.com/JoRouquette/obsidian-vps-publish/commit/a71658f))
* feat(perf): auto-generate HTML reports for all load tests ([291fecc](https://github.com/JoRouquette/obsidian-vps-publish/commit/291fecc))
* feat(plugin): add Phase 1 performance instrumentation ([6c30327](https://github.com/JoRouquette/obsidian-vps-publish/commit/6c30327))
* chore(loadtest): add npm scripts and gitignore for artillery reports ([6ba6934](https://github.com/JoRouquette/obsidian-vps-publish/commit/6ba6934))


### BREAKING CHANGE

* POST /api/session/:id/finish now returns 202 Accepted with
jobId instead of 200 OK. Clients must poll GET /api/session/:id/status to
check completion. Migration guide provided in docs/api/performance/IMPLEMENTATION.md.

Features:
- SessionFinalizationJobService: Async job queue with sequential processing
- 12-step timing instrumentation in SessionFinalizerService
- Request correlation middleware (x-request-id propagation)
- Enhanced backpressure middleware with 429 attribution (cause/source/headers)
- Health endpoint with event loop lag + memory metrics
- Artillery tests updated for async workflow
- Performance regression test suite

Performance Impact:
- Expected throughput: 1 req/s -> 5+ req/s (5x improvement)
- Session finish latency: 1800ms -> <50ms (P95)
- Eliminates 429 rate limiting under normal load

Documentation:
- artillery-report-analysis.md: Root cause analysis
- validation-checklist.md: 50+ verification items
- IMPLEMENTATION.md: Migration guide + deployment steps
- Performance testing guide

Resolves Artillery load test issues: throughput plateau, high finish latency,
excessive 429 responses due to event loop blocking.

## 4.12.0 (2025-12-30)

* Merge branch 'feat/fix-indexes-and-flattentree' ([e4aac59](https://github.com/JoRouquette/obsidian-vps-publish/commit/e4aac59))
* style: fix prettier formatting ([158266b](https://github.com/JoRouquette/obsidian-vps-publish/commit/158266b))
* fix(backend): add flattenTree to DTO and apply H1 removal to all custom indexes ([614098e](https://github.com/JoRouquette/obsidian-vps-publish/commit/614098e))
* fix(backend): exclude index pages from folder listings ([451019d](https://github.com/JoRouquette/obsidian-vps-publish/commit/451019d))
* fix(backend): properly build folder hierarchy for custom index folders ([3d31a18](https://github.com/JoRouquette/obsidian-vps-publish/commit/3d31a18))
* fix(index): hide empty sections in folder indexes ([5ef6e29](https://github.com/JoRouquette/obsidian-vps-publish/commit/5ef6e29))
* fix(plugin): collect custom index files even if outside vaultFolder ([a451c44](https://github.com/JoRouquette/obsidian-vps-publish/commit/a451c44))
* refactor(plugin): move flattenTree toggle under delete button ([0624721](https://github.com/JoRouquette/obsidian-vps-publish/commit/0624721))
* chore(test): remove unused LogLevel import ([4f9cb73](https://github.com/JoRouquette/obsidian-vps-publish/commit/4f9cb73))
* docs(plugin): mention flattenTree in advanced settings ([aefe971](https://github.com/JoRouquette/obsidian-vps-publish/commit/aefe971))
* test(site): verify BuildTreeHandler handles flattened routes ([9b367df](https://github.com/JoRouquette/obsidian-vps-publish/commit/9b367df))
* feat(config): add flattenTree option to FolderConfig ([93d3b2e](https://github.com/JoRouquette/obsidian-vps-publish/commit/93d3b2e))
* feat(plugin-settings): expose flattenTree option in folder configuration ([47269a2](https://github.com/JoRouquette/obsidian-vps-publish/commit/47269a2))
* feat(routing): support flattened folder trees with collision detection ([9bbc5bf](https://github.com/JoRouquette/obsidian-vps-publish/commit/9bbc5bf))

## 4.11.0 (2025-12-26)

* Merge branch 'feat/async-and-performance' ([15b48bf](https://github.com/JoRouquette/obsidian-vps-publish/commit/15b48bf))
* perf(api): optimize Express app with compression and caching ([24da357](https://github.com/JoRouquette/obsidian-vps-publish/commit/24da357))
* perf(plugin): optimize batch-by-bytes with async yielding ([939973a](https://github.com/JoRouquette/obsidian-vps-publish/commit/939973a))
* feat(plugin): add cancel button to ribbon during publishing ([7784eb6](https://github.com/JoRouquette/obsidian-vps-publish/commit/7784eb6))
* feat(plugin): add cancellation support for publishing operations ([09e5a02](https://github.com/JoRouquette/obsidian-vps-publish/commit/09e5a02))
* test(plugin): add smoke tests for async yielding and cancellation ([2f69af3](https://github.com/JoRouquette/obsidian-vps-publish/commit/2f69af3))

## 4.10.0 (2025-12-26)

* Merge branch 'feat/footnotes' ([c32d152](https://github.com/JoRouquette/obsidian-vps-publish/commit/c32d152))
* chore: fix lint/test issues and restore node_modules ([e792447](https://github.com/JoRouquette/obsidian-vps-publish/commit/e792447))
* feat: add ignoredTags configuration for tag filtering ([276f647](https://github.com/JoRouquette/obsidian-vps-publish/commit/276f647))
* feat(backend): add advanced Markdown rendering (wikilinks to headings, footnotes, tag filtering) ([3091e4b](https://github.com/JoRouquette/obsidian-vps-publish/commit/3091e4b))
* feat(markdown): add automatic heading IDs with markdown-it-anchor ([d91d5de](https://github.com/JoRouquette/obsidian-vps-publish/commit/d91d5de)), closes [Note#Section](https://github.com/Note/issues/Section)
* feat(markdown): convert markdown links to wikilinks and handle unpublished notes ([a8636ef](https://github.com/JoRouquette/obsidian-vps-publish/commit/a8636ef))
* feat(site): add smooth scroll navigation for footnotes and anchors ([08cc258](https://github.com/JoRouquette/obsidian-vps-publish/commit/08cc258)), closes [#anchor](https://github.com/JoRouquette/obsidian-vps-publish/issues/anchor)
* fix(markdown): handle multiple references to same footnote with unique IDs ([985e30b](https://github.com/JoRouquette/obsidian-vps-publish/commit/985e30b))
* refactor(plugin): centralize UI strings in i18n system ([f00684d](https://github.com/JoRouquette/obsidian-vps-publish/commit/f00684d))
* docs: establish documentation charter and restructure ([d622ace](https://github.com/JoRouquette/obsidian-vps-publish/commit/d622ace))

## 4.9.0 (2025-12-24)

* Merge branch 'refacto/performances' ([165fb13](https://github.com/JoRouquette/obsidian-vps-publish/commit/165fb13))
* feat: add comprehensive performance optimizations for publishing workflow ([3f1c58d](https://github.com/JoRouquette/obsidian-vps-publish/commit/3f1c58d))

## 4.8.0 (2025-12-24)

* Merge branch 'feat/add-no-publishing-command' ([c73a8b0](https://github.com/JoRouquette/obsidian-vps-publish/commit/c73a8b0))
* feat(plugin): add command to insert ^no-publishing marker ([0831e33](https://github.com/JoRouquette/obsidian-vps-publish/commit/0831e33))

## 4.7.0 (2025-12-24)

* Merge branch 'feat/add-one' ([e763f27](https://github.com/JoRouquette/obsidian-vps-publish/commit/e763f27))
* feat(plugin): add help modal and improve progress UX ([7fc4082](https://github.com/JoRouquette/obsidian-vps-publish/commit/7fc4082))

## <small>4.6.1 (2025-12-22)</small>

* Merge branch 'feat/logging-overhaul' ([48efc06](https://github.com/JoRouquette/obsidian-vps-publish/commit/48efc06))
* style: fix import sorting (eslint auto-fix) ([70370e7](https://github.com/JoRouquette/obsidian-vps-publish/commit/70370e7))
* refactor(core-application): downgrade ParseContentHandler progress logs to debug ([3199631](https://github.com/JoRouquette/obsidian-vps-publish/commit/3199631))
* refactor(logging): clean up vault-parsing services logging ([2efb5aa](https://github.com/JoRouquette/obsidian-vps-publish/commit/2efb5aa))
* refactor(logging): eliminate noise in NormalizeFrontmatterService ([004e7f4](https://github.com/JoRouquette/obsidian-vps-publish/commit/004e7f4))
* refactor(logging): improve session handlers with actionable messages ([5220f74](https://github.com/JoRouquette/obsidian-vps-publish/commit/5220f74))
* refactor(logging): unify LoggerPort with OperationContext and info() ([0b18563](https://github.com/JoRouquette/obsidian-vps-publish/commit/0b18563))
* refactor(plugin): reduce warning noise in logs ([163e821](https://github.com/JoRouquette/obsidian-vps-publish/commit/163e821))
* fix(logging): resolve TypeScript errors from LoggerPort refactor ([bb67845](https://github.com/JoRouquette/obsidian-vps-publish/commit/bb67845))
* docs(logging): add comprehensive logging policy guide ([98c1e89](https://github.com/JoRouquette/obsidian-vps-publish/commit/98c1e89))
* test: replace local NoopLogger with centralized helper ([7c5b9a9](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c5b9a9))


### BREAKING CHANGE

* LoggerPort.child() now requires OperationContext type.
Merge duplicate ports, add info() method, add correlation tracking support.
Create FakeLogger test helper. Update adapters (node + plugin).

## 4.6.0 (2025-12-19)

* Merge branch 'feat/implement-dataview' ([abd4891](https://github.com/JoRouquette/obsidian-vps-publish/commit/abd4891))
* feat: implement markdown-native conversion and custom index support ([e737e11](https://github.com/JoRouquette/obsidian-vps-publish/commit/e737e11))
* style: better its-theme ([0315607](https://github.com/JoRouquette/obsidian-vps-publish/commit/0315607))

## <small>4.5.1 (2025-12-14)</small>

* Merge branch 'fix/leaflet-implementation' ([8c8558b](https://github.com/JoRouquette/obsidian-vps-publish/commit/8c8558b))
* fix(leaflet): implement end-to-end Leaflet map support with plugin sanitization ([332eec7](https://github.com/JoRouquette/obsidian-vps-publish/commit/332eec7))

## 4.5.0 (2025-12-11)

* Merge branch 'feat/implementation-leaflet' ([403b23f](https://github.com/JoRouquette/obsidian-vps-publish/commit/403b23f))
* feat: add support for Leaflet map blocks in published notes ([20d71c9](https://github.com/JoRouquette/obsidian-vps-publish/commit/20d71c9))
* feat(publish): add detailed publishing stats and improved table rendering ([27794ca](https://github.com/JoRouquette/obsidian-vps-publish/commit/27794ca))

## <small>4.4.1 (2025-12-09)</small>

* Merge branch 'fix/mobile-side-effect-on-desktop' ([eff25eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/eff25eb))
* fix(site): prevent navigation to search page with query < 3 chars ([08892af](https://github.com/JoRouquette/obsidian-vps-publish/commit/08892af))

## 4.4.0 (2025-12-09)

* ci: fix playwright e2e tests in CI pipeline ([9ab7e74](https://github.com/JoRouquette/obsidian-vps-publish/commit/9ab7e74))
* Merge branch 'feature/end-to-end-testing' ([a8b4d76](https://github.com/JoRouquette/obsidian-vps-publish/commit/a8b4d76))
* feat(site): add E2E testing with Playwright and Server-Side Rendering support ([5a9b506](https://github.com/JoRouquette/obsidian-vps-publish/commit/5a9b506))
* feat(site): add mobile-optimized UI with search overlay and responsive navigation ([fd6720d](https://github.com/JoRouquette/obsidian-vps-publish/commit/fd6720d))
* feat(site): improve mobile UX and dataview inline rendering ([1f421ef](https://github.com/JoRouquette/obsidian-vps-publish/commit/1f421ef))
* fix(site): improve mobile topbar layout and remove overlay title ([c02f2ad](https://github.com/JoRouquette/obsidian-vps-publish/commit/c02f2ad))

## 4.3.0 (2025-12-09)

* Merge branch 'fix/style-mobile' ([400d0d0](https://github.com/JoRouquette/obsidian-vps-publish/commit/400d0d0))
* fix(site): remove duplicate title header in viewer component ([dc32327](https://github.com/JoRouquette/obsidian-vps-publish/commit/dc32327))
* fix(site): resolve double-scroll and improve layout responsiveness ([c962324](https://github.com/JoRouquette/obsidian-vps-publish/commit/c962324))
* feat(plugin): add step-based progress tracking with notifications ([2f25c0e](https://github.com/JoRouquette/obsidian-vps-publish/commit/2f25c0e))
* feat(site): add collapsible and resizable sidebar with responsive improvements ([abe99c9](https://github.com/JoRouquette/obsidian-vps-publish/commit/abe99c9))
* refactor(site): migrate to Angular 20 modern patterns ([34af979](https://github.com/JoRouquette/obsidian-vps-publish/commit/34af979))


### BREAKING CHANGE

* NotesUploaderAdapter and AssetsUploaderAdapter constructors now accept
ProgressPort or StepProgressManagerPort

## 4.2.0 (2025-12-06)

* Merge branch 'feature/mobile-display' ([04f589f](https://github.com/JoRouquette/obsidian-vps-publish/commit/04f589f))
* feat(mobile): add responsive design with overlay menu for mobile devices ([83d8d61](https://github.com/JoRouquette/obsidian-vps-publish/commit/83d8d61))
* feat(viewer): add interactive image overlay with zoom and contrast adjustment ([aa64e47](https://github.com/JoRouquette/obsidian-vps-publish/commit/aa64e47))
* chore: simplify git workflow and fix docker permissions ([cc16b10](https://github.com/JoRouquette/obsidian-vps-publish/commit/cc16b10))

## <small>4.1.2 (2025-12-06)</small>

* Merge branch 'fix/nanoid-issues' into release ([64e8303](https://github.com/JoRouquette/obsidian-vps-publish/commit/64e8303))
* Merge branch 'release' ([1145180](https://github.com/JoRouquette/obsidian-vps-publish/commit/1145180))
* fix: replace nanoid with guid generator port ([a6dcfaf](https://github.com/JoRouquette/obsidian-vps-publish/commit/a6dcfaf))
* build(docker): simplify user configuration by using existing node user ([1bea73c](https://github.com/JoRouquette/obsidian-vps-publish/commit/1bea73c))

## <small>4.1.1 (2025-12-06)</small>

* refactor(docker): use existing node group instead of creating nodegrp ([7c63517](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c63517))

## 4.1.0 (2025-12-06)

* Merge branch 'fix/overhall-upload' into release ([63fc892](https://github.com/JoRouquette/obsidian-vps-publish/commit/63fc892))
* Merge branch 'release' ([26b9182](https://github.com/JoRouquette/obsidian-vps-publish/commit/26b9182))
* Merge branch 'release' ([fa673e3](https://github.com/JoRouquette/obsidian-vps-publish/commit/fa673e3))
* refactor: replace console.info with console.debug and improve logging consistency ([2a6fdea](https://github.com/JoRouquette/obsidian-vps-publish/commit/2a6fdea))
* feat(upload): implement chunked compression system for large uploads ([39a80ce](https://github.com/JoRouquette/obsidian-vps-publish/commit/39a80ce))
* fix(upload): handle oversized items and improve batch upload reliability ([736fe20](https://github.com/JoRouquette/obsidian-vps-publish/commit/736fe20))
* ci: add individual plugin files to release assets ([8bf7ad8](https://github.com/JoRouquette/obsidian-vps-publish/commit/8bf7ad8))
* ci: remove tag-based trigger and add version sync for plugin release ([4e03035](https://github.com/JoRouquette/obsidian-vps-publish/commit/4e03035))
* ci(release): bundle plugin into a ZIP file ([6ff811b](https://github.com/JoRouquette/obsidian-vps-publish/commit/6ff811b))


### BREAKING CHANGE

* batchByBytes now returns {batches, oversized} instead of batches array

## 4.0.0 (2025-12-05)

* ci: fix linting issues ([fe5954b](https://github.com/JoRouquette/obsidian-vps-publish/commit/fe5954b))
* ci: update obsidian-plugin-release job dependency ([16df570](https://github.com/JoRouquette/obsidian-vps-publish/commit/16df570))
* Merge branch 'docs/better-readme' into release ([93b9ccf](https://github.com/JoRouquette/obsidian-vps-publish/commit/93b9ccf))
* Merge branch 'fix/obsidian-publication-requirements' ([38c6e36](https://github.com/JoRouquette/obsidian-vps-publish/commit/38c6e36))
* Merge branch 'fix/obsidian-publication-requirements' into release ([a7305f7](https://github.com/JoRouquette/obsidian-vps-publish/commit/a7305f7))
* Merge branch 'fix/single-source-of-trust' into release ([af6c7dc](https://github.com/JoRouquette/obsidian-vps-publish/commit/af6c7dc))
* Merge branch 'release' ([5d0b525](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d0b525))
* Merge branch 'release' ([91d3598](https://github.com/JoRouquette/obsidian-vps-publish/commit/91d3598))
* refactor(settings)!: migrate to VPS-centric configuration model ([ce06f0b](https://github.com/JoRouquette/obsidian-vps-publish/commit/ce06f0b))
* test: add ignoredCleanupRuleIds to FolderConfig test fixtures ([64cc363](https://github.com/JoRouquette/obsidian-vps-publish/commit/64cc363))
* chore: add plugin compliance check and update documentation ([6ff1548](https://github.com/JoRouquette/obsidian-vps-publish/commit/6ff1548))
* chore: migrate to ESLint flat config and sync version management ([04a6ffb](https://github.com/JoRouquette/obsidian-vps-publish/commit/04a6ffb))
* chore: ssot for manifest and scripts to root ([7c1e20b](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c1e20b))
* chore: standardize plugin naming and improve documentation ([3a70dfc](https://github.com/JoRouquette/obsidian-vps-publish/commit/3a70dfc))


### BREAKING CHANGE

* Settings structure completely refactored. Each VPS now contains its own folders,
ignore rules, and cleanup rules. Migration required for existing configurations.

## <small>3.2.2 (2025-12-04)</small>

* Merge branch 'fix/frontmatter-properties' into release ([2fed1d9](https://github.com/JoRouquette/obsidian-vps-publish/commit/2fed1d9))
* Merge branch 'release' ([602a62b](https://github.com/JoRouquette/obsidian-vps-publish/commit/602a62b))
* fix: normalize and display frontmatter property keys consistently ([8ef07f4](https://github.com/JoRouquette/obsidian-vps-publish/commit/8ef07f4))
* fix(vps): add VPS cleanup endpoint with staged content removal ([637276a](https://github.com/JoRouquette/obsidian-vps-publish/commit/637276a))
* ci: enable Docker Hub image caching and simplify merge tasks ([36b879b](https://github.com/JoRouquette/obsidian-vps-publish/commit/36b879b))

## <small>3.2.1 (2025-12-04)</small>

* Merge branch 'fix/search-and-filtering' into release ([3bf4cb4](https://github.com/JoRouquette/obsidian-vps-publish/commit/3bf4cb4))
* Merge branch 'release' ([1a6440f](https://github.com/JoRouquette/obsidian-vps-publish/commit/1a6440f))
* chore: add format:write tasks to all project configurations ([b784f2b](https://github.com/JoRouquette/obsidian-vps-publish/commit/b784f2b))
* fix: improve search UX with empty states and auto-expand ([d128497](https://github.com/JoRouquette/obsidian-vps-publish/commit/d128497))
* fix(search): implement global content search with sentence-level indexing ([0d923a1](https://github.com/JoRouquette/obsidian-vps-publish/commit/0d923a1))

## 3.2.0 (2025-12-04)

* Merge branch 'feature/abstracts-and-styles' into release ([efbbb85](https://github.com/JoRouquette/obsidian-vps-publish/commit/efbbb85))
* Merge branch 'hotfix/fix-tests' into release ([9621ab1](https://github.com/JoRouquette/obsidian-vps-publish/commit/9621ab1))
* Merge branch 'release' ([9c8c037](https://github.com/JoRouquette/obsidian-vps-publish/commit/9c8c037))
* ci: add tasks ([6b11374](https://github.com/JoRouquette/obsidian-vps-publish/commit/6b11374))
* chore: format all files ([e7f9b9d](https://github.com/JoRouquette/obsidian-vps-publish/commit/e7f9b9d))
* fix: resolve wikilinks against full session batch for accurate cross-references ([21be6d1](https://github.com/JoRouquette/obsidian-vps-publish/commit/21be6d1))
* fix(callouts): replace text icons with Material Symbols and improve styling ([66b1840](https://github.com/JoRouquette/obsidian-vps-publish/commit/66b1840))
* feat: add callouts ([526f84f](https://github.com/JoRouquette/obsidian-vps-publish/commit/526f84f))
* feat: add custom callout styles support ([066ac2b](https://github.com/JoRouquette/obsidian-vps-publish/commit/066ac2b))


### BREAKING CHANGE

* Session creation now accepts optional calloutStyles parameter

## 3.1.0 (2025-12-03)

* Merge branch 'fix/site-navigation-and-default' into release ([9495cbb](https://github.com/JoRouquette/obsidian-vps-publish/commit/9495cbb))
* Merge branch 'hotfix/activate-pipeline' into release ([d681447](https://github.com/JoRouquette/obsidian-vps-publish/commit/d681447))
* Merge branch 'hotfix/fix-tests' ([374bcd0](https://github.com/JoRouquette/obsidian-vps-publish/commit/374bcd0))
* Merge branch 'release' ([3ff7a7e](https://github.com/JoRouquette/obsidian-vps-publish/commit/3ff7a7e))
* test: fix localStorage mock in http-manifest-repository tests ([db7d5fa](https://github.com/JoRouquette/obsidian-vps-publish/commit/db7d5fa))
* refactor: asset style and display ([5d06f4c](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d06f4c))
* refactor: filter empty frontmatter values from rendering ([85cb15c](https://github.com/JoRouquette/obsidian-vps-publish/commit/85cb15c))
* refactor: normalize frontmatter consistently and handle DomainFrontmatter input ([5468784](https://github.com/JoRouquette/obsidian-vps-publish/commit/5468784))
* feat: detect and render assets and wikilinks from frontmatter ([19aa1e6](https://github.com/JoRouquette/obsidian-vps-publish/commit/19aa1e6))
* feat: improve asset rendering, progress, and ignore rules UI ([705e811](https://github.com/JoRouquette/obsidian-vps-publish/commit/705e811))
* feat: improve asset resolution and frontmatter sanitization ([8beb38e](https://github.com/JoRouquette/obsidian-vps-publish/commit/8beb38e))
* feat(site): add reusable search bar and improve index rendering ([01da2c0](https://github.com/JoRouquette/obsidian-vps-publish/commit/01da2c0))

## <small>3.0.2 (2025-11-27)</small>

* Merge branch 'hotfix/activate-pipeline' ([c9f5d84](https://github.com/JoRouquette/obsidian-vps-publish/commit/c9f5d84))
* refactor(plugin): rename publish-to-personal-vps to obsidian-vps-publish everywhere ([5c84080](https://github.com/JoRouquette/obsidian-vps-publish/commit/5c84080))

## <small>3.0.1 (2025-11-27)</small>

- Merge branch 'fix/actions' into release ([63d7d21](https://github.com/JoRouquette/obsidian-vps-publish/commit/63d7d21))
- Merge branch 'fix/release-pipeline' into release ([d545e0e](https://github.com/JoRouquette/obsidian-vps-publish/commit/d545e0e))
- Merge branch 'fix/test' into release ([8592bfe](https://github.com/JoRouquette/obsidian-vps-publish/commit/8592bfe))
- Merge branch 'release' ([0eb276e](https://github.com/JoRouquette/obsidian-vps-publish/commit/0eb276e))
- Merge branch 'release' ([2130c7e](https://github.com/JoRouquette/obsidian-vps-publish/commit/2130c7e))
- fix(ci): ensure plugin build exists before packaging in release pipeline ([a80521a](https://github.com/JoRouquette/obsidian-vps-publish/commit/a80521a))
- test(site-index-templates): use Slug.from for slug in renderFolderIndex test ([f423ab0](https://github.com/JoRouquette/obsidian-vps-publish/commit/f423ab0))
- test(site-index-templates): use Slug.from for slug in renderFolderIndex test ([e2cdc26](https://github.com/JoRouquette/obsidian-vps-publish/commit/e2cdc26))
- chore(ci): refactor and rename GitHub Actions workflows ([6fd1c19](https://github.com/JoRouquette/obsidian-vps-publish/commit/6fd1c19))
- chore(ci): unify and refactor GitHub Actions workflows ([849ad65](https://github.com/JoRouquette/obsidian-vps-publish/commit/849ad65))

## 3.0.0 (2025-11-27)

- Merge branch 'feat/ajout-plugin-in-workspace' into release ([19b076b](https://github.com/JoRouquette/obsidian-vps-publish/commit/19b076b))
- Merge branch 'fix/packaging' into release ([82c4595](https://github.com/JoRouquette/obsidian-vps-publish/commit/82c4595))
- Merge branch 'release' ([b11425f](https://github.com/JoRouquette/obsidian-vps-publish/commit/b11425f))
- Merge branch 'release' ([5e863db](https://github.com/JoRouquette/obsidian-vps-publish/commit/5e863db))
- refactor!: migrate folder sanitization to array of rules, update content sanitizer ([d7cd502](https://github.com/JoRouquette/obsidian-vps-publish/commit/d7cd502))
- refactor(core,plugin): modularize note parsing pipeline and settings UI ([c6fa555](https://github.com/JoRouquette/obsidian-vps-publish/commit/c6fa555))
- refactor(site,core): move catalog queries and manifest types to core libs ([ce7fa88](https://github.com/JoRouquette/obsidian-vps-publish/commit/ce7fa88))
- test: add Jest config and test setup ([ef66dab](https://github.com/JoRouquette/obsidian-vps-publish/commit/ef66dab))
- test(core-application): add vault-parsing pipeline tests and update test fixtures ([972dcc0](https://github.com/JoRouquette/obsidian-vps-publish/commit/972dcc0))
- test(obsidian-vps-publish): migrate tests to .test.ts, add missing coverage ([ce2d360](https://github.com/JoRouquette/obsidian-vps-publish/commit/ce2d360))
- refactor: migrate plugin to standalone TypeScript and improve test coverage ([36873e3](https://github.com/JoRouquette/obsidian-vps-publish/commit/36873e3))
- refactor: migrate to kebab-case file naming for consistency ([6f69787](https://github.com/JoRouquette/obsidian-vps-publish/commit/6f69787))
- refactor: move publish entities and ports to dedicated folders ([f742735](https://github.com/JoRouquette/obsidian-vps-publish/commit/f742735))
- refactor: normalize plugin naming and session flow ([cc5146b](https://github.com/JoRouquette/obsidian-vps-publish/commit/cc5146b))
- refactor: plugin software architecture ([249648a](https://github.com/JoRouquette/obsidian-vps-publish/commit/249648a))
- refactor: remove vpsConfig from note and related tests, update slug to use Slug value object ([48e92b0](https://github.com/JoRouquette/obsidian-vps-publish/commit/48e92b0))
- refactor(core): migrate to kebab-case file naming for all entities, ports, and usecases ([4de1e7e](https://github.com/JoRouquette/obsidian-vps-publish/commit/4de1e7e))
- feat(settings): add default sanitization rule banner and disable editing for default rule ([1b4c48c](https://github.com/JoRouquette/obsidian-vps-publish/commit/1b4c48c))
- fix(packaging): update script paths for correct workspace and app root resolution ([fe32b34](https://github.com/JoRouquette/obsidian-vps-publish/commit/fe32b34))
- chore: add plugin to nx monorepo ([64b6ff3](https://github.com/JoRouquette/obsidian-vps-publish/commit/64b6ff3))
- chore: correction pipeline ([f58a6da](https://github.com/JoRouquette/obsidian-vps-publish/commit/f58a6da))
- chore: correction pipeline ([103ea8e](https://github.com/JoRouquette/obsidian-vps-publish/commit/103ea8e))
- chore: update gitignore ([31e7f08](https://github.com/JoRouquette/obsidian-vps-publish/commit/31e7f08))
- ci: enforce lint and tests on merge ([0c89653](https://github.com/JoRouquette/obsidian-vps-publish/commit/0c89653))

### BREAKING CHANGE

- FolderConfig.sanitization is now an array of rules (SanitizationRules[]), not
  a single object.

## 2.0.0 (2025-11-25)

- fix(routes,uploads): correct asset upload param, improve route building logs, update file storage ([5a79d64](https://github.com/JoRouquette/obsidian-vps-publish/commit/5a79d64))
- Merge branch 'chore/migrate-to-nx' into release ([0e96c53](https://github.com/JoRouquette/obsidian-vps-publish/commit/0e96c53))
- Merge branch 'feature/add-batched-upload' into release ([7c77f8c](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c77f8c))
- Merge branch 'fix/issues-semantic-versionning' into release ([f3d3bb9](https://github.com/JoRouquette/obsidian-vps-publish/commit/f3d3bb9))
- Merge branch 'fix/issues-with-routes-and-uploads' into release ([cbc5806](https://github.com/JoRouquette/obsidian-vps-publish/commit/cbc5806))
- Merge branch 'fix/tests-and-linting' into release ([18ee3ba](https://github.com/JoRouquette/obsidian-vps-publish/commit/18ee3ba))
- Merge branch 'release' ([197dba7](https://github.com/JoRouquette/obsidian-vps-publish/commit/197dba7))
- Merge branch 'release' ([63defbe](https://github.com/JoRouquette/obsidian-vps-publish/commit/63defbe))
- Merge branch 'release' ([82fb8d9](https://github.com/JoRouquette/obsidian-vps-publish/commit/82fb8d9))
- refactor(architecture)!: introduce CQRS handlers and feature ports ([eb7eddd](https://github.com/JoRouquette/obsidian-vps-publish/commit/eb7eddd))
- chore: change logger level ([67b19d6](https://github.com/JoRouquette/obsidian-vps-publish/commit/67b19d6))
- chore: fix build configuration ([0951cf7](https://github.com/JoRouquette/obsidian-vps-publish/commit/0951cf7))
- chore: proper docker config ([3796aa0](https://github.com/JoRouquette/obsidian-vps-publish/commit/3796aa0))
- chore: updating pre-push to include tests ([ae4bc7f](https://github.com/JoRouquette/obsidian-vps-publish/commit/ae4bc7f))
- chore(backend): add session lifecycle and filesystem repository ([b9323f6](https://github.com/JoRouquette/obsidian-vps-publish/commit/b9323f6))
- chore(ci): update release workflows to use Node.js 22.14.0 and optimize npm install ([105fa01](https://github.com/JoRouquette/obsidian-vps-publish/commit/105fa01))
- chore(lint): enforce layered eslint rules and add pre-push hook ([ca23781](https://github.com/JoRouquette/obsidian-vps-publish/commit/ca23781))
- chore(lint): migrate to flat config, add Nx plugin and enforce module boundaries ([cf43dcf](https://github.com/JoRouquette/obsidian-vps-publish/commit/cf43dcf))
- chore(publishing): add batched note upload and session-based manifest updates ([be2038f](https://github.com/JoRouquette/obsidian-vps-publish/commit/be2038f))
- test: implement jest.config.cjs files and update tsconfig files to reference them ([936a9af](https://github.com/JoRouquette/obsidian-vps-publish/commit/936a9af))
- test(core-domain): add unit tests for Asset, Manifest, Note, and Session entities ([761a975](https://github.com/JoRouquette/obsidian-vps-publish/commit/761a975))
- test(core-domain): refactor SessionError tests and update coverage config ([bb8991d](https://github.com/JoRouquette/obsidian-vps-publish/commit/bb8991d))
- test(node): add coverage for infra components ([83d8a6e](https://github.com/JoRouquette/obsidian-vps-publish/commit/83d8a6e))
- test(site): add unit coverage for queries and infra ([dde8fa5](https://github.com/JoRouquette/obsidian-vps-publish/commit/dde8fa5))
- refactor: migrate monorepo to nx workspace ([7696edb](https://github.com/JoRouquette/obsidian-vps-publish/commit/7696edb))
- refactor: rename NotesIndexPort to ManifestPort and update manifest structure ([23af6cc](https://github.com/JoRouquette/obsidian-vps-publish/commit/23af6cc))
- refactor: simplify note and manifest models, remove unused fields and utilities ([5fbf829](https://github.com/JoRouquette/obsidian-vps-publish/commit/5fbf829))
- refactor: unify content API, update config, and improve structure ([1822936](https://github.com/JoRouquette/obsidian-vps-publish/commit/1822936))
- refactor(backend): unify note and asset index ports, rename files and update use cases ([73c16a3](https://github.com/JoRouquette/obsidian-vps-publish/commit/73c16a3))
- refactor(core): update SiteIndexPort and PublishNotesUseCase to support logger injection ([7c25075](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c25075))
- feat(backend): refactor publishing and session flows, update note and asset handling ([5eb4ffe](https://github.com/JoRouquette/obsidian-vps-publish/commit/5eb4ffe))
- fix: resolve static file serving, proxy config, and manifest loading ([d121460](https://github.com/JoRouquette/obsidian-vps-publish/commit/d121460))
- fix: simplify asset upload flow and DTOs ([8786b8b](https://github.com/JoRouquette/obsidian-vps-publish/commit/8786b8b))
- ci: unify env file naming, update Docker Compose and CI for multi-env support ([1554ee6](https://github.com/JoRouquette/obsidian-vps-publish/commit/1554ee6))

### BREAKING CHANGE

- legacy StoragePort/IndexPort and Upload\*UseCase paths have been removed or moved,
  impacting imports and tests.

## 1.2.0 (2025-11-17)

- chore:start implementing a better viewer ([e2940e8](https://github.com/JoRouquette/obsidian-vps-publish/commit/e2940e8))
- Merge branch 'feature/better-viewer' into release ([a1fd2ea](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1fd2ea))
- Merge branch 'release' ([8ef89bf](https://github.com/JoRouquette/obsidian-vps-publish/commit/8ef89bf))
- fix: remove trailing slash from note URL in PublishNotesUseCase ([dd9950f](https://github.com/JoRouquette/obsidian-vps-publish/commit/dd9950f))
- fix(api): add health check endpoint and controller ([e0b1dee](https://github.com/JoRouquette/obsidian-vps-publish/commit/e0b1dee))
- fix(backend): add status field to /ping endpoint response in express app ([0ec4f16](https://github.com/JoRouquette/obsidian-vps-publish/commit/0ec4f16))
- fix(express): serve Angular UI and content directory as static assets ([0dc030d](https://github.com/JoRouquette/obsidian-vps-publish/commit/0dc030d))
- fix(logging): make logger optional and add structured logging to backend ([a1cfb14](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1cfb14))
- build: add husky ([9eb7156](https://github.com/JoRouquette/obsidian-vps-publish/commit/9eb7156))
- build: complete dockerfile ([9b4820e](https://github.com/JoRouquette/obsidian-vps-publish/commit/9b4820e))
- feat(backend): add asset upload API, refactor storage ports, improve test setup ([7c2568f](https://github.com/JoRouquette/obsidian-vps-publish/commit/7c2568f))
- feat(ci): add GitHub Actions workflow to build and push Docker image ([6f930ee](https://github.com/JoRouquette/obsidian-vps-publish/commit/6f930ee))
- feat(docker): add assets volume and ASSETS_ROOT env to docker-compose.yml ([cc412ea](https://github.com/JoRouquette/obsidian-vps-publish/commit/cc412ea))
- feat(logging): add structured logger and propagate context across backend ([a3a114a](https://github.com/JoRouquette/obsidian-vps-publish/commit/a3a114a))
- feat(viewer): improve markdown layout and styling, add OnPush change detection ([2cf24a4](https://github.com/JoRouquette/obsidian-vps-publish/commit/2cf24a4))

## <small>1.1.5 (2025-11-13)</small>

- test: sementic commit message ([b3b460c](https://github.com/JoRouquette/obsidian-vps-publish/commit/b3b460c))
- fix: better release file ([c0fa39d](https://github.com/JoRouquette/obsidian-vps-publish/commit/c0fa39d))
- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- fix: vault explorer style and navigation ([faca1d4](https://github.com/JoRouquette/obsidian-vps-publish/commit/faca1d4))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))
- chore(release): 1.1.5 [skip ci] ([7bdd0e4](https://github.com/JoRouquette/obsidian-vps-publish/commit/7bdd0e4))
- chore(release): 1.1.5 [skip ci] ([a1808bd](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1808bd))
- chore(release): 1.1.5 [skip ci] ([5d4fb78](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d4fb78))
- style: improve display of main and vault-explorer grid area ([90ffd1b](https://github.com/JoRouquette/obsidian-vps-publish/commit/90ffd1b))
- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))

## <small>1.1.5 (2025-11-13)</small>

- style: improve display of main and vault-explorer grid area ([90ffd1b](https://github.com/JoRouquette/obsidian-vps-publish/commit/90ffd1b))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))
- chore(release): 1.1.5 [skip ci] ([a1808bd](https://github.com/JoRouquette/obsidian-vps-publish/commit/a1808bd))
- chore(release): 1.1.5 [skip ci] ([5d4fb78](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d4fb78))
- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- fix: vault explorer style and navigation ([faca1d4](https://github.com/JoRouquette/obsidian-vps-publish/commit/faca1d4))
- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))

## <small>1.1.5 (2025-11-13)</small>

- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- fix: vault explorer style and navigation ([faca1d4](https://github.com/JoRouquette/obsidian-vps-publish/commit/faca1d4))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))
- chore(release): 1.1.5 [skip ci] ([5d4fb78](https://github.com/JoRouquette/obsidian-vps-publish/commit/5d4fb78))
- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))

## <small>1.1.5 (2025-11-12)</small>

- refactor: update for improved file upload and explorer UI ([0871361](https://github.com/JoRouquette/obsidian-vps-publish/commit/0871361))
- fix: injection issue locally ([83f31eb](https://github.com/JoRouquette/obsidian-vps-publish/commit/83f31eb))
- chore: add content to dockerignore ([626c9f0](https://github.com/JoRouquette/obsidian-vps-publish/commit/626c9f0))
- chore: add content to dockerignore ([3557163](https://github.com/JoRouquette/obsidian-vps-publish/commit/3557163))

## <small>1.1.4 (2025-11-11)</small>

- build: better docker ([e7ef3ae](https://github.com/JoRouquette/obsidian-vps-publish/commit/e7ef3ae))
- fix: site navigation throughout rendered markdown ([37ffbb0](https://github.com/JoRouquette/obsidian-vps-publish/commit/37ffbb0))
- Merge branch 'main' of https://github.com/JoRouquette/obsidian-vps-publish ([d242256](https://github.com/JoRouquette/obsidian-vps-publish/commit/d242256))
- chore: complete fix ([1085f2e](https://github.com/JoRouquette/obsidian-vps-publish/commit/1085f2e))

## <small>1.1.3 (2025-11-11)</small>

- fix: grid layout ([c447992](https://github.com/JoRouquette/obsidian-vps-publish/commit/c447992))

## <small>1.1.2 (2025-11-10)</small>

- fix: publish-frontend issues ([f761f1c](https://github.com/JoRouquette/obsidian-vps-publish/commit/f761f1c))
- Merge branch 'main' of https://github.com/JoRouquette/obsidian-vps-publish ([ef1350c](https://github.com/JoRouquette/obsidian-vps-publish/commit/ef1350c))
- chore: add favicon ([dde94b4](https://github.com/JoRouquette/obsidian-vps-publish/commit/dde94b4))

## <small>1.1.1 (2025-11-10)</small>

- fix: complete theming and grid ([ad07ee5](https://github.com/JoRouquette/obsidian-vps-publish/commit/ad07ee5))

## 1.1.0 (2025-11-10)

- feat: add theming and gridstyle ([53219e5](https://github.com/JoRouquette/obsidian-vps-publish/commit/53219e5))
- fix: docker and api routes ([9001a9f](https://github.com/JoRouquette/obsidian-vps-publish/commit/9001a9f))
- build: updating docker configuration ([e4b1617](https://github.com/JoRouquette/obsidian-vps-publish/commit/e4b1617))
- docs: update README ([1c492b5](https://github.com/JoRouquette/obsidian-vps-publish/commit/1c492b5))

## 1.0.0 (2025-11-10)

- ci: add semver and conventionnal commits ([fb0ba94](https://github.com/JoRouquette/obsidian-vps-publish/commit/fb0ba94))
- build!: software architecture changes ([9b3875a](https://github.com/JoRouquette/obsidian-vps-publish/commit/9b3875a))
- feat: add complete upload ([0485d9d](https://github.com/JoRouquette/obsidian-vps-publish/commit/0485d9d))
- feat: add docker integration ([f301843](https://github.com/JoRouquette/obsidian-vps-publish/commit/f301843))
- feat: add site index ([9281e0a](https://github.com/JoRouquette/obsidian-vps-publish/commit/9281e0a))
- feat: allow for complete overide of site structure ([fd8e1b7](https://github.com/JoRouquette/obsidian-vps-publish/commit/fd8e1b7))
- feat: better static site ([f24588b](https://github.com/JoRouquette/obsidian-vps-publish/commit/f24588b))
- docs: add README ([bfec9af](https://github.com/JoRouquette/obsidian-vps-publish/commit/bfec9af))
- test: add several tests ([91f603d](https://github.com/JoRouquette/obsidian-vps-publish/commit/91f603d))
- chore: initialize repository ([72b3934](https://github.com/JoRouquette/obsidian-vps-publish/commit/72b3934))

### BREAKING CHANGE

- The project structure has changed significantly.
  All backend code now resides in the `backend/` directory, and frontend
  code is in the root `src/` directory. Import paths, build scripts, and
  deployment processes must be updated accordingly.
