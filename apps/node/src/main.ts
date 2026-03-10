import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';

import { EnvConfig } from './infra/config/env-config';
import { createApp } from './infra/http/express/app';
import { ConsoleLogger } from './infra/logging/console-logger';

// Load environment variables from .env.dev or .env file
// In test mode (E2E/CI), do NOT override env vars passed externally
const isTestMode = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev';
const envPath = path.resolve(process.cwd(), envFile);

// Only override in development mode, not in test/CI
loadEnv({ path: envPath, override: !isTestMode });

// Fallback to .env if specific file doesn't exist (only if API_KEY not set)
if (!process.env.API_KEY) {
  loadEnv({ override: !isTestMode }); // Try default .env file
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
