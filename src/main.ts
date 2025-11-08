import 'dotenv/config';
import { createApp } from './infra/http/express/app';
import { loadEnvConfig } from './infra/config/EnvConfig';
import { MarkdownItRenderer } from './infra/markdown/MarkdownItRenderer';
import { FileSystemContentStorage } from './infra/filesystem/FileSystemContentStorage';
import { FileSystemSiteIndex } from './infra/filesystem/FileSystemSiteIndex';
import { PublishNotesUseCase } from './application/usecases/PublishNotesUseCase';

async function bootstrap() {
  const config = loadEnvConfig();

  const markdownRenderer = new MarkdownItRenderer();
  const contentStorage = new FileSystemContentStorage(config.contentRoot);
  const siteIndex = new FileSystemSiteIndex(config.contentRoot);

  const publishNotesUseCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);

  const app = createApp({
    apiKey: config.apiKey,
    publishNotesUseCase,
  });

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[personal-publish] Listening on port ${config.port} (NODE_ENV=${config.nodeEnv})`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[personal-publish] Fatal error during bootstrap', err);
  process.exit(1);
});
