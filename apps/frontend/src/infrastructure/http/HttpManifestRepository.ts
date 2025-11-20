import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, shareReplay } from 'rxjs';
import { Manifest } from '../../domain/models/Manifest';
import { ManifestRepository } from '../../domain/ports/ManifestRepository';
import { ManifestDTO } from '../dto/Manifest.dto';
import { toDomain } from '../mappers/manifest.mapper';
import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/CONTENT_ROOT';

@Injectable({ providedIn: 'root' })
export class HttpManifestRepository implements ManifestRepository {
  private cache$;

  constructor(private http: HttpClient) {
    console.log('HttpManifestRepository initialized');
    this.cache$ = this.http
      .get<ManifestDTO>(StringUtils.buildRoute(CONTENT_ROOT, '_manifest.json'), {
        responseType: 'json',
      })
      .pipe(shareReplay(1));
  }

  async load(): Promise<Manifest> {
    const dto = await firstValueFrom(this.cache$);
    console.log('Manifest loaded:', dto);
    return toDomain(dto);
  }
}
