export interface NoteFrontmatter {
  tags: string[];
  flat: Record<string, unknown>;
  nested: Record<string, unknown>;
}

export interface Note {
  id: string;
  title: string;
  slug: string;
  vaultPath: string;
  relativePath: string;
  route: string;
  markdown: string;
  frontmatter: NoteFrontmatter;
  publishedAt: Date;
}
