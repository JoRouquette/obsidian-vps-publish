import { InjectionToken } from '@angular/core';
import type { ManifestRepository } from '@core-domain';

import type { ConfigRepository } from './config-repository.port';
import type { ContentRepository } from './content-repository.port';
import type { SearchIndexRepository } from './search-index-repository.port';

export const MANIFEST_REPOSITORY = new InjectionToken<ManifestRepository>('MANIFEST_REPOSITORY');
export const CONFIG_REPOSITORY = new InjectionToken<ConfigRepository>('CONFIG_REPOSITORY');
export const CONTENT_REPOSITORY = new InjectionToken<ContentRepository>('CONTENT_REPOSITORY');
export const SEARCH_INDEX_REPOSITORY = new InjectionToken<SearchIndexRepository>(
  'SEARCH_INDEX_REPOSITORY'
);
