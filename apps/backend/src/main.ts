import { createApp } from './infra/http/express/app';

async function bootstrap() {
  const { app, EnvConfig } = createApp();

  app.listen(EnvConfig.port(), () => {
    console.log(`Server listening on port ${EnvConfig.port()}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error on bootstrap', err);
  process.exit(1);
});
