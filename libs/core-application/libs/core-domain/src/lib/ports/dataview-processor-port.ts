import type { PublishableNote } from '../entities/publishable-note';

/**
 * Port for services that process Dataview blocks in notes.
 *
 * This port abstracts the Dataview processing logic, allowing:
 * - Plugin-side implementation: Executes and serializes via Obsidian's Dataview API
 * - Server-side implementation: Parses and executes queries (deprecated)
 *
 * Clean Architecture principle: The application layer depends on this port,
 * not on concrete implementations in infrastructure layers.
 */
export interface DataviewProcessorPort {
  /**
   * Process notes to handle Dataview blocks.
   *
   * @param notes Notes to process
   * @returns Notes with Dataview blocks processed (either serialized or executed)
   */
  process(notes: PublishableNote[]): Promise<PublishableNote[]>;
}
