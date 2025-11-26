import { Slug } from '../value-objects/slug.value-object';

export interface Page {
  id: string;
  route: string;
  title: string;
  tags: string[];
  relativePath: string;
  slug: Slug;
  publishedAt?: Date;
}
