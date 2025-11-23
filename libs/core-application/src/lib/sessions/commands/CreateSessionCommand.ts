export interface CreateSessionCommand {
  notesPlanned: number;
  assetsPlanned: number;
  batchConfig: {
    maxBytesPerRequest: number;
  };
}
