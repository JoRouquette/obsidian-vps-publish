import { Page } from './Page';

export interface Manifest {
  sessionId: string;
  publishedAt: string;
  lastModifiedAt: string;
  pages: Page[];
}
