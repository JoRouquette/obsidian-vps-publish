export interface ContentRepository {
  fetch(path: string): Promise<string>;
}
