export interface ProgressPort {
  start(total: number): void;
  advance(step?: number): void;
  finish(): void;
}
