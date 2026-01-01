import type { CustomIndexConfig } from './custom-index-config';
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
}
