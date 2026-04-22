export interface HttpRequestQuery<T = unknown> {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: T;
  headers?: Record<string, string>;
}

export interface HttpRequestResponse {
  status: number;
  body: unknown;
}
