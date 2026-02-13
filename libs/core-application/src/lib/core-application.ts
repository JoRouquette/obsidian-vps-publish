// Common
export * from './common/command-handler';
export * from './common/query-handler';

// Infrastructure
export * from './infra/performance-tracker.adapter';

// Ports génériques
export * from './ports/id-generator.port';
export * from './ports/markdown-renderer.port';

// Utils
export * from './utils/concurrency.util';

// Dataview (Application Layer)
export * from './dataview/dataview-to-markdown.converter';
export * from './dataview/markdown-link-normalizer';

// Sessions
export * from './sessions/commands/abort-session.command';
export * from './sessions/commands/abort-session.result';
export * from './sessions/commands/create-session.command';
export * from './sessions/commands/create-session.result';
export * from './sessions/commands/finish-session.command';
export * from './sessions/commands/finish-session.result';
export * from './sessions/handlers/abort-session.handler';
export * from './sessions/handlers/create-session.handler';
export * from './sessions/handlers/finish-session.handler';
export * from './sessions/ports/session.repository';

// Publishing
export * from './publishing/commands/upload-assets.command';
export * from './publishing/commands/upload-notes.command';
export * from './publishing/handlers/upload-assets.handler';
export * from './publishing/handlers/upload-notes.handler';
export * from './publishing/ports/assets-index.port';
export * from './publishing/ports/assets-storage.port';
export * from './publishing/ports/content-storage.port';
export * from './publishing/ports/manifest-storage.port';
export * from './publishing/ports/session-notes-storage.port';
export * from './publishing/services/chunk-assembler.service';
export * from './publishing/services/chunked-upload.service';
export * from './publishing/services/note-hash.service';

// Vault parsing & HTTP helpers for Obsidian plugin
export * from './vault-parsing';

// Catalog (site) queries
export * from './catalog';
