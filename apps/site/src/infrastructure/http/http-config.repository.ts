import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, shareReplay } from 'rxjs';

import type { ConfigRepository, PublicConfig } from '../../domain/ports/config-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpConfigRepository implements ConfigRepository {
  private cache$;

  constructor(private http: HttpClient) {
    this.cache$ = this.http.get<PublicConfig>('/public-config').pipe(shareReplay(1));
  }

  load(): Promise<PublicConfig> {
    return firstValueFrom(this.cache$);
  }
}
