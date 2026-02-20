import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';

import { EnvConfig } from './infra/config/env-config';
import { createApp } from './infra/http/express/app';
import { ConsoleLogger } from './infra/logging/console-logger';

// Load environment variables from .env.dev or .env file
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
const envPath = path.resolve(process.cwd(), envFile);

loadEnv({ path: envPath, override: true });

// Fallback to .env if specific file doesn't exist
if (!process.env.API_KEY) {
  loadEnv({ override: true }); // Try default .env file
}

async function bootstrap() {
  const rootLogger = new ConsoleLogger({ level: EnvConfig.loggerLevel() });

  const { app, logger } = createApp(rootLogger);

  app.listen(EnvConfig.port(), () => {
    logger?.debug(`Server listening on port ${EnvConfig.port()}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error on bootstrap', err);
  process.exit(1);
});
