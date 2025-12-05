import { Injectable, signal } from '@angular/core';

import type { PublicConfig } from '../../domain/ports/config-repository.port';
import { HttpConfigRepository } from '../../infrastructure/http/http-config.repository';

@Injectable({ providedIn: 'root' })
export class ConfigFacade {
  cfg = signal<PublicConfig | null>(null);

  constructor(private readonly repo: HttpConfigRepository) {}

  async ensure() {
    if (!this.cfg()) this.cfg.set(await this.repo.load());
  }
}
