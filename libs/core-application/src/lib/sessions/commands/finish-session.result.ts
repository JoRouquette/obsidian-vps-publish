import type { PromotionStats } from '@core-domain';

export interface FinishSessionResult {
  sessionId: string;
  success: boolean;
  promotionStats?: PromotionStats;
}
