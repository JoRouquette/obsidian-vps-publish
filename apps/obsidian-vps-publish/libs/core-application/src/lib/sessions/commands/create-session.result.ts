export interface CreateSessionResult {
  sessionId: string;
  success: boolean;
  deduplicationEnabled?: boolean;
  existingAssetHashes?: string[];
  /**
   * Map of source note vault paths to their sourceHash from the production manifest.
   * Only populated if pipeline signature is unchanged.
   * Used to skip unchanged uploads without relying on client-owned route authority.
   */
  existingSourceNoteHashesByVaultPath?: Record<string, string>;
  /**
   * True if pipeline signature changed (version or renderSettingsHash),
   * indicating that all notes must be re-rendered
   */
  pipelineChanged?: boolean;
}
