import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { StringUtils } from '../../application/utils/string.utils';
import { CONTENT_ROOT } from '../../domain/constants/content-root.constant';
import type { ContentRepository } from '../../domain/ports/content-repository.port';

@Injectable({ providedIn: 'root' })
export class HttpContentRepository implements ContentRepository {
  constructor(private readonly http: HttpClient) {}

  fetch(path: string): Promise<string> {
    const fullPath = StringUtils.buildRoute(CONTENT_ROOT, path);

    return firstValueFrom(this.http.get(fullPath, { responseType: 'text' }));
  }
}
