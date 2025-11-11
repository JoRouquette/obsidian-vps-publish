import { provideHttpClient, withFetch } from '@angular/common/http';
import { ANIMATION_MODULE_TYPE, ApplicationConfig } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { CONFIG_REPOSITORY, HTML_GATEWAY, MANIFEST_REPOSITORY } from '../domain/ports/tokens';
import { HttpConfigRepository } from '../infrastructure/http/HttpConfigRepository';
import { HttpHtmlGateway } from '../infrastructure/http/HttpHtmlGateway';
import { HttpManifestRepository } from '../infrastructure/http/HttpManifestRepository';
import { APP_ROUTES } from './routes/app.routes';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(APP_ROUTES, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideHttpClient(withFetch()),
    provideNoopAnimations(),
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-rounded' } },
    { provide: MANIFEST_REPOSITORY, useClass: HttpManifestRepository },
    { provide: CONFIG_REPOSITORY, useClass: HttpConfigRepository },
    { provide: HTML_GATEWAY, useClass: HttpHtmlGateway },
    { provide: ANIMATION_MODULE_TYPE, useValue: 'BrowserAnimationsModule' },
    { provide: MATERIAL_ANIMATIONS, useValue: 'enabled' },
  ],
};
