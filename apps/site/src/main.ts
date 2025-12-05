import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app';
import { appConfig } from './presentation/app.config';

bootstrapApplication(App, {
  ...appConfig,
  providers: [...appConfig.providers],
}).catch((err) => {
  throw err;
});
