import { Page } from './Page';

export interface Manifest {
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  pages: Page[];
}
