import { JsonPipe, NgClass } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import {
  type AdminDashboardSnapshot,
  type AdminLogEntry,
} from '../../../../application/services/admin-dashboard.service';

@Component({
  standalone: true,
  selector: 'app-admin-observability-tab',
  imports: [JsonPipe, MatCardModule, NgClass],
  template: `
    <div class="detail-grid">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Alertes</p>
            <h2>Warnings / Errors</h2>
          </div>
          <span class="badge">{{ snapshot().notifications.length }}</span>
        </div>

        @if (snapshot().notifications.length === 0) {
          <p class="empty-copy">Aucune alerte recente dans le journal.</p>
        } @else {
          <div class="notification-list">
            @for (item of snapshot().notifications; track item.timestamp + item.message) {
              <article class="notification" [ngClass]="item.level">
                <div class="notification-head">
                  <strong>{{ item.level }}</strong>
                  <span>{{ item.timestamp ? formatDate(item.timestamp) : '' }}</span>
                </div>
                <p>{{ item.message }}</p>
                @if (item.meta | json; as meta) {
                  <pre>{{ meta }}</pre>
                }
              </article>
            }
          </div>
        }
      </mat-card>

      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Server Log</p>
            <h2>Tail</h2>
          </div>
          <span class="badge">{{ logs().length }}</span>
        </div>

        @if (logs().length === 0) {
          <p class="empty-copy">Aucune ligne de log disponible.</p>
        } @else {
          <div class="log-list">
            @for (line of logs(); track line.timestamp + line.message + line.level) {
              <article class="log-line" [ngClass]="line.level">
                <div class="log-meta">
                  <strong>{{ line.level }}</strong>
                  <span>{{ line.timestamp ? formatDate(line.timestamp) : '' }}</span>
                </div>
                <p>{{ line.message }}</p>
              </article>
            }
          </div>
        }
      </mat-card>
    </div>
  `,
})
export class AdminObservabilityTabComponent {
  readonly snapshot = input.required<AdminDashboardSnapshot>();
  readonly logs = input.required<AdminLogEntry[]>();

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  }
}
