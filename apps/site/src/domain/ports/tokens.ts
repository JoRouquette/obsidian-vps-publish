import { InjectionToken } from '@angular/core';
import { ConfigRepository } from './config-repository.port';
import { ContentRepository } from './content-repository.port';
import { ManifestRepository } from '@core-domain';

export const MANIFEST_REPOSITORY = new InjectionToken<ManifestRepository>('MANIFEST_REPOSITORY');
export const CONFIG_REPOSITORY = new InjectionToken<ConfigRepository>('CONFIG_REPOSITORY');
export const CONTENT_REPOSITORY = new InjectionToken<ContentRepository>('CONTENT_REPOSITORY');
