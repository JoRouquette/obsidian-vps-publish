import { type PublishableNote } from '@core-domain';

export interface MarkdownRendererPort {
  render(note: PublishableNote): Promise<string>;
}
