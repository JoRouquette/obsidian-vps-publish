export interface ManifestPage {
  id: string;
  title: string;
  slug: string;
  route: string;
  description?: string;
  publishedAt: Date;

  vaultPath?: string;
  relativePath?: string;
  tags?: string[];
}
