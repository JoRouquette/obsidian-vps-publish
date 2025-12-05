import { type PublishableNote } from '@core-domain';

/**
 * Persists the raw notes of a publishing session so we can rebuild
 * cross-linked HTML once the full batch has been received.
 */
export interface SessionNotesStoragePort {
  append(sessionId: string, notes: PublishableNote[]): Promise<void>;
  loadAll(sessionId: string): Promise<PublishableNote[]>;
  clear(sessionId: string): Promise<void>;
}
