export interface Query<P, R> {
  execute(params: P): Promise<R>;
}
