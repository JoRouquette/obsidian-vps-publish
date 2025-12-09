import { provideHttpClient, withFetch } from '@angular/common/http';
import type { ApplicationConfig } from '@angular/core';
import { ANIMATION_MODULE_TYPE } from '@angular/core';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import {
  CONFIG_REPOSITORY,
  CONTENT_REPOSITORY,
  MANIFEST_REPOSITORY,
  SEARCH_INDEX_REPOSITORY,
} from '../domain/ports/tokens';
import { HttpConfigRepository } from '../infrastructure/http/http-config.repository';
import { HttpContentRepository } from '../infrastructure/http/http-content.repository';
import { HttpManifestRepository } from '../infrastructure/http/http-manifest.repository';
import { HttpSearchIndexRepository } from '../infrastructure/http/http-search-index.repository';
import { APP_ROUTES } from './routes/app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      APP_ROUTES,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
      withViewTransitions({ skipInitialTransition: true })
    ),
    provideHttpClient(withFetch()),
    provideClientHydration(),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-rounded' } },
    { provide: MANIFEST_REPOSITORY, useClass: HttpManifestRepository },
    { provide: CONFIG_REPOSITORY, useClass: HttpConfigRepository },
    { provide: CONTENT_REPOSITORY, useClass: HttpContentRepository },
    { provide: SEARCH_INDEX_REPOSITORY, useClass: HttpSearchIndexRepository },
    { provide: ANIMATION_MODULE_TYPE, useValue: 'BrowserAnimationsModule' },
    { provide: MATERIAL_ANIMATIONS, useValue: 'enabled' },
  ],
};
