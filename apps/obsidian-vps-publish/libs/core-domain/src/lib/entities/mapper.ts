export interface Mapper<T, U> {
  map(req: T): U;
}
