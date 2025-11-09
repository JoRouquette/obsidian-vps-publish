import * as path from 'path';

export const EnvConfig = {
  contentRoot(): string {
    return process.env.CONTENT_ROOT || path.resolve(process.cwd(), 'tmp/site');
  },
  port(): number {
    return Number(process.env.PORT ?? 3000);
  },
  apiKey(): string | undefined {
    return process.env.API_KEY;
  },
  nodeEnv(): string {
    return process.env.NODE_ENV ?? 'development';
  },
};
