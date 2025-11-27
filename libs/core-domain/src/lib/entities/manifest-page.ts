import { Slug } from '../value-objects/slug.value-object';

export interface ManifestPage {
  id: string;
  title: string;
  slug: Slug;
  route: string;
  description?: string;
  publishedAt: Date;

  vaultPath?: string;
  relativePath?: string;
  tags?: string[];
}
