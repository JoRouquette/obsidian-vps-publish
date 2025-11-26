import { EnvConfig } from './infra/config/env-config';
import { createApp } from './infra/http/express/app';
import { ConsoleLogger } from './infra/logging/console-logger';

async function bootstrap() {
  const rootLogger = new ConsoleLogger({ level: EnvConfig.loggerLevel() });

  const { app, logger } = createApp(rootLogger);

  app.listen(EnvConfig.port(), () => {
    logger?.info(`Server listening on port ${EnvConfig.port()}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error on bootstrap', err);
  process.exit(1);
});
