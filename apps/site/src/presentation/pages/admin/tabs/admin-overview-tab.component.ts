import { DecimalPipe, NgClass } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { type AdminDashboardSnapshot } from '../../../../application/services/admin-dashboard.service';

@Component({
  standalone: true,
  selector: 'app-admin-overview-tab',
  imports: [DecimalPipe, MatCardModule, NgClass],
  template: `
    <div class="stats-grid">
      <mat-card class="panel accent">
        <p class="panel-kicker">Publication</p>
        <h2>
          {{
            snapshot().publication.lastPublishedAt
              ? formatDate(snapshot().publication.lastPublishedAt ?? '')
              : 'Jamais'
          }}
        </h2>
        <p>
          Manifest mis a jour:
          {{
            snapshot().publication.manifestUpdatedAt
              ? formatDate(snapshot().publication.manifestUpdatedAt ?? '')
              : 'n/a'
          }}
        </p>
        <p>Revision: {{ snapshot().publication.contentRevision || 'n/a' }}</p>
        <p>Version: {{ snapshot().publication.contentVersion || 'n/a' }}</p>
      </mat-card>

      <mat-card class="panel">
        <p class="panel-kicker">Catalogue</p>
        <h2>{{ snapshot().publication.pagesCount }}</h2>
        <p>pages publiees</p>
        <p>{{ snapshot().publication.assetsCount }} assets dans le manifest</p>
      </mat-card>

      <mat-card class="panel" [ngClass]="snapshot().health.status">
        <p class="panel-kicker">Sante serveur</p>
        <h2>{{ snapshot().health.status === 'healthy' ? 'Healthy' : 'Degraded' }}</h2>
        <p>Uptime: {{ formatUptime(snapshot().server.uptimeSeconds) }}</p>
        <p>
          Heap: {{ snapshot().health.memory.heapUsedMB | number: '1.0-2' }} /
          {{ snapshot().health.memory.heapTotalMB | number: '1.0-2' }} MB
        </p>
        <p>RSS: {{ snapshot().health.memory.rssMB | number: '1.0-2' }} MB</p>
      </mat-card>

      <mat-card class="panel">
        <p class="panel-kicker">Runtime</p>
        <h2>{{ snapshot().server.nodeEnv }}</h2>
        <p>PID: {{ snapshot().server.pid }}</p>
        <p>Logger: {{ snapshot().server.loggerLevel }}</p>
        <p>Log file: {{ snapshot().server.logFileSizeBytes | number }} octets</p>
      </mat-card>
    </div>
  `,
})
export class AdminOverviewTabComponent {
  readonly snapshot = input.required<AdminDashboardSnapshot>();

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  }

  formatUptime(seconds: number | undefined): string {
    if (!seconds) {
      return '0s';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }
}
