import 'dotenv/config';
import { createApp } from './infra/http/express/app';
import { MarkdownItRenderer } from './infra/markdown/MarkdownItRenderer';
import { FileSystemContentStorage } from './infra/filesystem/FileSystemContentStorage';
import { FileSystemSiteIndex } from './infra/filesystem/FileSystemSiteIndex';
import { PublishNotesUseCase } from './application/usecases/PublishNotesUseCase';
import { EnvConfig } from './infra/config/EnvConfig';

async function bootstrap() {
  const markdownRenderer = new MarkdownItRenderer();
  const contentStorage = new FileSystemContentStorage(EnvConfig.contentRoot());
  const siteIndex = new FileSystemSiteIndex(EnvConfig.contentRoot());

  const publishNotesUseCase = new PublishNotesUseCase(markdownRenderer, contentStorage, siteIndex);

  const app = createApp({
    apiKey: EnvConfig.apiKey() || '',
    publishNotesUseCase,
  });

  app.listen(EnvConfig.port(), () => {
    // eslint-disable-next-line no-console
    console.log(
      `[personal-publish] Listening on port ${EnvConfig.port()} (NODE_ENV=${EnvConfig.nodeEnv()})`
    );
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[personal-publish] Fatal error during bootstrap', err);
  process.exit(1);
});
