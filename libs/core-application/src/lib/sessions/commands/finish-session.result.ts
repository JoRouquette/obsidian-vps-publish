import type { PromotionStats } from '@core-domain';

export interface FinishSessionResult {
  sessionId: string;
  success: boolean;
  /** Unique revision identifier for this publication (matches manifest.contentRevision). */
  contentRevision?: string;
  promotionStats?: PromotionStats;
}
