import type { Request } from 'express';

const BEARER_PREFIX = 'Bearer ';

export function extractBearerToken(req: Request): string | undefined {
  const header = req.header('authorization') ?? '';
  if (!header.startsWith(BEARER_PREFIX)) {
    return undefined;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}
