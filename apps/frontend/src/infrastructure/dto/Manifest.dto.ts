import { PageDTO } from './Page.dto';

export interface ManifestDTO {
  sessionId: string;
  createdAt: string;
  lastUpdatedAt: string;
  pages: PageDTO[];
}
