export type Mapper<T> = (
  response: T,
  url?: string
) =>
  | { response: Response; url?: string }
  | Promise<{ response: Response; url?: string }>;

export type MappingResult = {
  response: Response;
  url?: string;
};

export interface ApiRequestMapper<T> {
  execute(response: T, url?: string): MappingResult;
}

export interface Handler<T> {
  defaultMapper: Mapper<T>;
}
