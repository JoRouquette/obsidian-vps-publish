import { Slug } from '../value-objects/Slug';

export interface Page {
  id: string;
  route: string;
  title: string;
  tags: string[];
  relativePath: string;
  slug: Slug;
  publishedAt?: Date;
}
