export interface CreateSessionResult {
  sessionId: string;
  success: boolean;
  deduplicationEnabled?: boolean;
  existingAssetHashes?: string[];
  /**
   * Map of note routes to their sourceHash from production manifest
   * Only populated if pipeline signature is unchanged
   * Used for client-side note deduplication
   */
  existingNoteHashes?: Record<string, string>;
  /**
   * Map of source note vault paths to their sourceHash from the production manifest.
   * Only populated if pipeline signature is unchanged.
   * Used by the api-owned deterministic transform path to skip unchanged uploads
   * without relying on client-owned route authority.
   */
  existingSourceNoteHashesByVaultPath?: Record<string, string>;
  /**
   * True if pipeline signature changed (version or renderSettingsHash),
   * indicating that all notes must be re-rendered
   */
  pipelineChanged?: boolean;
}
