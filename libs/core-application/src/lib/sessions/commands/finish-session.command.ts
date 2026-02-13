export interface FinishSessionCommand {
  sessionId: string;
  notesProcessed: number;
  assetsProcessed: number;
  /**
   * All routes collected from vault (PHASE 6.1)
   * Used to detect deleted pages during finalization
   */
  allCollectedRoutes?: string[];
}
