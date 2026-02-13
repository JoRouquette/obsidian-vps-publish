import type { CustomIndexConfig } from './custom-index-config';
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
  ignoredTags?: string[];
  folderDisplayNames?: Record<string, string>;
  /**
   * All routes collected from vault during publish (PHASE 6.1)
   * Used to detect deleted pages: production pages not in this set were deleted
   */
  allCollectedRoutes?: string[];
  /**
   * Pipeline signature at time of session creation (PHASE 3, PHASE 7)
   * Used to detect render pipeline changes and trigger full re-render
   */
  pipelineSignature?: PipelineSignature;
}
