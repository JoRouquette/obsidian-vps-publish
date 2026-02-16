import type { Manifest, PublishableNote } from '@core-domain';
import type { CalloutStylePayload } from '../publishing/ports/session-notes-storage.port';

/**
 * Contextual configuration passed to the renderer
 */
export interface RenderContext {
  /** Tags to filter out from rendered HTML */
  ignoredTags?: string[];

  /** Manifest for path translation (vault → route) */
  manifest?: Manifest;

  /** Session-specific callout CSS styles (isolates styles between sessions) */
  calloutStyles?: CalloutStylePayload[];
}

export interface MarkdownRendererPort {
  render(note: PublishableNote, context?: RenderContext): Promise<string>;
}
