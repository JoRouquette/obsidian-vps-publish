import { type Session } from '@core-domain';

export interface SessionRepository {
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
}
