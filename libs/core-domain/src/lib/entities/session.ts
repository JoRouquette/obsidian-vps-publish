export type SessionStatus = 'pending' | 'active' | 'finished' | 'aborted';

export interface Session {
  id: string;
  notesPlanned: number;
  assetsPlanned: number;
  notesProcessed: number;
  assetsProcessed: number;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}
