export interface MarkdownRendererPort {
  render(markdown: string): Promise<string>;
}
