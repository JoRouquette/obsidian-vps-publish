export interface ContentStoragePort {
  save(params: { route: string; content: string; slug: string }): Promise<void>;
}
