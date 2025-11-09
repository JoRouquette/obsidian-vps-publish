export interface NoteFrontmatter {
  title: string;
  description?: string;
  date?: string;
  tags?: string[];
  aliases?: string[];
}

export interface Note {
  id: string;
  slug: string;
  vaultPath: string;
  relativePath: string;
  route: string;
  markdown: string;
  frontmatter: NoteFrontmatter;
  publishedAt: Date;
  updatedAt: Date;
}
