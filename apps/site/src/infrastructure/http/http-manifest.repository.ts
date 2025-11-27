import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, shareReplay } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';
import { Manifest, ManifestRepository } from '@core-domain';

@Injectable({ providedIn: 'root' })
export class HttpManifestRepository implements ManifestRepository {
  private cache$;

  constructor(private http: HttpClient) {
    const url = StringUtils.buildRoute(CONTENT_ROOT, '_manifest.json');

    this.cache$ = this.http.get<Manifest>(url).pipe(shareReplay(1));
  }

  async load(): Promise<Manifest> {
    return await firstValueFrom(this.cache$);
  }
}
