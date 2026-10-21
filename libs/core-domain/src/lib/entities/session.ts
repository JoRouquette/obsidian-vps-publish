import type { CustomIndexConfig } from './custom-index-config';
import type { IgnoreRule } from './ignore-rule';
import type { SiteLocale } from './manifest';
import type { PipelineSignature } from './pipeline-signature';
import type { SanitizationRules } from './sanitization-rules';

export type SessionStatus = 'pending' | 'active' | 'finished' | 'aborted';

export interface Session {
  id: string;
  notesPlanned: number;
  assetsPlanned: number;
  notesProcessed: number;
  assetsProcessed: number;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  cleanupRules?: SanitizationRules[];
  customIndexConfigs?: CustomIndexConfig[];
  ignoreRules?: IgnoreRule[];
  ignoredTags?: string[];
  /**
   * Frontmatter keys hidden at render time (properties card, inline Dataview queries).
   * They stay in the note data: aliases, tags, SEO fields and routing keep working.
   */
  ignoredFrontmatterKeys?: string[];
  folderDisplayNames?: Record<string, string>;
  /**
   * Site locale for HTML lang attribute and PWA.
   * Resolved from plugin settings before sending.
   */
  locale?: SiteLocale;
  /**
   * Pipeline signature at time of session creation (PHASE 3, PHASE 7)
   * Used to detect render pipeline changes and trigger full re-render
   */
  pipelineSignature?: PipelineSignature;
  /**
   * Mapping of original asset paths to optimized paths (e.g., image.png → image.webp)
   * Used by SessionFinalizerService to update references in rendered HTML
   */
  assetPathMappings?: Record<string, string>;
  deduplicationEnabled?: boolean;
}
