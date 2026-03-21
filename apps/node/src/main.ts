import * as path from 'node:path';

import { config as loadEnv } from 'dotenv';

import { EnvConfig } from './infra/config/env-config';
import { createApp } from './infra/http/express/app';
import { ConsoleLogger } from './infra/logging/console-logger';

// Load development environment variables from .env.dev.
// Test/CI runs should rely on their explicit process environment instead.
const isTestMode = process.env.NODE_ENV === 'test' || process.env.CI === 'true';
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction && !isTestMode) {
  loadEnv({
    path: path.resolve(EnvConfig.workspaceRoot(), '.env.dev'),
    override: true,
  });
}

async function bootstrap() {
  const rootLogger = new ConsoleLogger({
    level: EnvConfig.loggerLevel(),
    filePath: EnvConfig.logFilePath(),
  });

  const { app, logger } = createApp(rootLogger);

  app.listen(EnvConfig.port(), () => {
    logger?.debug(`Server listening on port ${EnvConfig.port()}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error on bootstrap', err);
  process.exit(1);
});
