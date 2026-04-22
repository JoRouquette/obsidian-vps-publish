/**
 * Represents the signature of the rendering pipeline configuration
 * Used to detect when pipeline settings change and trigger full re-rendering
 */
export interface PipelineSignature {
  /**
   * Version of the rendering pipeline (e.g., application version)
   */
  version: string;

  /**
   * SHA-256 hash of the stable JSON representation of render settings
   * Includes: calloutStyles, cleanupRules, ignoredTags, and any other settings
   * that affect rendering output
   */
  renderSettingsHash: string;

  /**
   * Optional git commit hash for enhanced traceability
   * Not used for comparison, only for debugging
   */
  gitCommit?: string;
}
