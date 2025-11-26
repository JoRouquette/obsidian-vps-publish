import { InjectionToken } from '@angular/core';
import { ManifestRepository } from './manifest-repository.port';
import { ConfigRepository } from './config-repository.port';
import { ContentRepository } from './content-repository.port';

export const MANIFEST_REPOSITORY = new InjectionToken<ManifestRepository>('MANIFEST_REPOSITORY');
export const CONFIG_REPOSITORY = new InjectionToken<ConfigRepository>('CONFIG_REPOSITORY');
export const CONTENT_REPOSITORY = new InjectionToken<ContentRepository>('CONTENT_REPOSITORY');
