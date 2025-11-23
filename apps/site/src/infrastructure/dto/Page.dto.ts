export interface PageDTO {
  id: string;
  title: string;
  route: string;
  slug?: string;
  tags: string[];
  relativePath: string;
  publishedAt?: string;
}
