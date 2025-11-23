import { Injectable } from '@angular/core';
import { ContentRepository } from '../../domain/ports/ContentRepository';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CONTENT_ROOT } from '../../domain/constants/CONTENT_ROOT';
import { StringUtils } from '../../application/utils/string.utils';

@Injectable({ providedIn: 'root' })
export class HttpContentRepository implements ContentRepository {
  constructor(private readonly http: HttpClient) {}

  fetch(path: string): Promise<string> {
    const fullPath = StringUtils.buildRoute(CONTENT_ROOT, path);

    console.log(`Fetching HTML content from: ${fullPath}`);

    return firstValueFrom(this.http.get(fullPath, { responseType: 'text' }));
  }
}
