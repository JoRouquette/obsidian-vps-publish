import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './presentation/app.config';
import { App } from './app';

bootstrapApplication(App, {
  ...appConfig,
  providers: [...appConfig.providers],
}).catch((err) => console.error(err));
