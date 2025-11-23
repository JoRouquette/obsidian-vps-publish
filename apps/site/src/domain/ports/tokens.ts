import { InjectionToken } from '@angular/core';
import { ManifestRepository } from './ManifestRepository';
import { ConfigRepository } from './ConfigRepository';
import { ContentRepository } from './ContentRepository';

export const MANIFEST_REPOSITORY = new InjectionToken<ManifestRepository>('MANIFEST_REPOSITORY');
export const CONFIG_REPOSITORY = new InjectionToken<ConfigRepository>('CONFIG_REPOSITORY');
export const CONTENT_REPOSITORY = new InjectionToken<ContentRepository>('CONTENT_REPOSITORY');
