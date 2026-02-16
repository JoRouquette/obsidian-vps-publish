import { type PublishableNote, type SanitizationRules } from '@core-domain';

/**
 * Callout style payload (CSS snippet)
 */
export interface CalloutStylePayload {
  path: string;
  css: string;
}

/**
 * Persists the raw notes of a publishing session so we can rebuild
 * cross-linked HTML once the full batch has been received.
 *
 * Also persists session-scoped configuration:
 * - Cleanup rules (sanitization patterns)
 * - Callout styles (CSS snippets for custom callouts)
 */
export interface SessionNotesStoragePort {
  append(sessionId: string, notes: PublishableNote[]): Promise<void>;
  loadAll(sessionId: string): Promise<PublishableNote[]>;
  clear(sessionId: string): Promise<void>;
  saveCleanupRules(sessionId: string, rules: SanitizationRules[]): Promise<void>;
  loadCleanupRules(sessionId: string): Promise<SanitizationRules[]>;
  saveCalloutStyles(sessionId: string, styles: CalloutStylePayload[]): Promise<void>;
  loadCalloutStyles(sessionId: string): Promise<CalloutStylePayload[]>;
}
