export interface CreateSessionResult {
  sessionId: string;
  success: boolean;
  existingAssetHashes?: string[];
  /**
   * Map of note routes to their sourceHash from production manifest
   * Only populated if pipeline signature is unchanged
   * Used for client-side note deduplication
   */
  existingNoteHashes?: Record<string, string>;
  /**
   * True if pipeline signature changed (version or renderSettingsHash),
   * indicating that all notes must be re-rendered
   */
  pipelineChanged?: boolean;
}
