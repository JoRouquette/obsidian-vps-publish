import { Injectable} from '@angular/core';
import { HtmlGateway } from '../../domain/ports/HtmlGateway';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HttpHtmlGateway implements HtmlGateway {
  constructor(private http: HttpClient) {}

  fetch(path: string): Promise<string> {
    return firstValueFrom(this.http.get(path, { responseType: 'text' }));
  }
}
