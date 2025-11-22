export interface Session {
  id: string;
  notesPlanned: number;
  assetsPlanned: number;
  notesProcessed: number;
  assetsProcessed: number;
  status: 'pending' | 'active' | 'finished' | 'aborted';
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRepository {
  abort(sessionId: string): Promise<void>;
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
}
