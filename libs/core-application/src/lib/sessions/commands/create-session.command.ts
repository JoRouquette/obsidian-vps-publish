import type { CustomIndexConfig, IgnoreRule, PipelineSignature, SiteLocale } from '@core-domain';

export interface CreateSessionCommand {
  notesPlanned: number;
  assetsPlanned: number;
  batchConfig: {
    maxBytesPerRequest: number;
  };
  customIndexConfigs?: CustomIndexConfig[];
  ignoreRules?: IgnoreRule[];
  ignoredTags?: string[];
  folderDisplayNames?: Record<string, string>;
  pipelineSignature?: PipelineSignature;
  /**
   * Site locale for HTML lang attribute and PWA.
   * Resolved from plugin settings (en/fr/system → en/fr).
   */
  locale?: SiteLocale;
  deduplicationEnabled?: boolean;
}
