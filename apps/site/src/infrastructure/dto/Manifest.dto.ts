import { PageDTO } from './page.dto';

export interface ManifestDTO {
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  pages: PageDTO[];
}
