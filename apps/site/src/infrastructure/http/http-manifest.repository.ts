import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, shareReplay } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';
import { Manifest } from '../../domain/models/manifest';
import { ManifestRepository } from '../../domain/ports/manifest-repository.port';
import { ManifestDTO } from '../dto/manifest.dto';
import { toDomain } from '../mappers/manifest.mapper';

@Injectable({ providedIn: 'root' })
export class HttpManifestRepository implements ManifestRepository {
  private cache$;

  constructor(private http: HttpClient) {
    console.log('HttpManifestRepository initialized');
    const url = StringUtils.buildRoute(CONTENT_ROOT, '_manifest.json');
    console.log('Fetching manifest from URL:', url);

    this.cache$ = this.http.get<ManifestDTO>(url).pipe(shareReplay(1));
  }

  async load(): Promise<Manifest> {
    const dto: ManifestDTO = await firstValueFrom(this.cache$);
    console.log('Manifest loaded:', dto);
    return toDomain(dto);
  }
}
