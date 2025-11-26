import { Injectable, signal } from '@angular/core';
import { HttpConfigRepository } from '../../infrastructure/http/http-config.repository';
import { PublicConfig } from '../../domain/ports/config-repository.port';

@Injectable({ providedIn: 'root' })
export class ConfigFacade {
  cfg = signal<PublicConfig | null>(null);

  constructor(private readonly repo: HttpConfigRepository) {}

  async ensure() {
    if (!this.cfg()) this.cfg.set(await this.repo.load());
  }
}
