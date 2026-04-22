import { type Manifest, type PublishableNote } from '@core-domain';

export interface RenderContext {
  ignoredTags?: string[];
  manifest?: Manifest;
}

export interface MarkdownRendererPort {
  render(note: PublishableNote, context?: RenderContext): Promise<string>;
}
