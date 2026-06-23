"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Common
__exportStar(require("./common/command-handler"), exports);
__exportStar(require("./common/query-handler"), exports);
// Infrastructure
__exportStar(require("./infra/performance-tracker.adapter"), exports);
// Ports génériques
__exportStar(require("./ports/id-generator.port"), exports);
__exportStar(require("./ports/markdown-renderer.port"), exports);
// Utils
__exportStar(require("./utils/concurrency.util"), exports);
// Dataview (Application Layer)
__exportStar(require("./dataview/dataview-to-markdown.converter"), exports);
__exportStar(require("./dataview/markdown-link-normalizer"), exports);
// Sessions
__exportStar(require("./sessions/commands/abort-session.command"), exports);
__exportStar(require("./sessions/commands/abort-session.result"), exports);
__exportStar(require("./sessions/commands/create-session.command"), exports);
__exportStar(require("./sessions/commands/create-session.result"), exports);
__exportStar(require("./sessions/commands/finish-session.command"), exports);
__exportStar(require("./sessions/commands/finish-session.result"), exports);
__exportStar(require("./sessions/handlers/abort-session.handler"), exports);
__exportStar(require("./sessions/handlers/create-session.handler"), exports);
__exportStar(require("./sessions/handlers/finish-session.handler"), exports);
__exportStar(require("./sessions/ports/session.repository"), exports);
// Publishing
__exportStar(require("./publishing/commands/upload-assets.command"), exports);
__exportStar(require("./publishing/commands/upload-notes.command"), exports);
__exportStar(require("./publishing/handlers/upload-assets.handler"), exports);
__exportStar(require("./publishing/handlers/upload-notes.handler"), exports);
__exportStar(require("./publishing/ports/assets-index.port"), exports);
__exportStar(require("./publishing/ports/assets-storage.port"), exports);
__exportStar(require("./publishing/ports/content-storage.port"), exports);
__exportStar(require("./publishing/ports/manifest-storage.port"), exports);
__exportStar(require("./publishing/ports/session-notes-storage.port"), exports);
__exportStar(require("./publishing/services/chunk-assembler.service"), exports);
__exportStar(require("./publishing/services/chunked-upload.service"), exports);
__exportStar(require("./publishing/utils/build-upload-session-notes.util"), exports);
// NOTE: NoteHashService not exported here (uses node:crypto, not SSR-compatible)
// Backend projects should import directly from './publishing/services/note-hash.service'
// Vault parsing & HTTP helpers for Obsidian plugin
__exportStar(require("./vault-parsing"), exports);
// Catalog (site) queries
__exportStar(require("./catalog"), exports);
