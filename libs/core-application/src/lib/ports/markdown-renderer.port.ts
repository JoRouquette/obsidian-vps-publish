import { type PublishableNote } from '@core-domain';

export interface RenderContext {
  ignoredTags?: string[];
}

export interface MarkdownRendererPort {
  render(note: PublishableNote, context?: RenderContext): Promise<string>;
}
