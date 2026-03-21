import { Component, input, type WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import {
  type AdminDashboardSnapshot,
  type AdminPublicationHistoryEntry,
} from '../../../../application/services/admin-dashboard.service';

@Component({
  standalone: true,
  selector: 'app-admin-operations-tab',
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="detail-grid">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Controles</p>
            <h2>Maintenance / Backpressure</h2>
          </div>
          <span class="badge">{{ snapshot().controls.maintenance.enabled ? 'ON' : 'OFF' }}</span>
        </div>

        <div class="stack">
          <p>
            Maintenance:
            {{ snapshot().controls.maintenance.enabled ? 'activee' : 'desactivee' }}
          </p>
          <p>
            Dernier changement:
            {{
              snapshot().controls.maintenance.changedAt
                ? formatDate(snapshot().controls.maintenance.changedAt ?? '')
                : 'n/a'
            }}
          </p>
          <p>
            Pression active:
            {{ snapshot().controls.backpressure.metrics?.isUnderPressure ? 'oui' : 'non' }}
          </p>
        </div>

        <div class="control-grid">
          <mat-form-field appearance="outline">
            <mat-label>Message maintenance</mat-label>
            <input
              matInput
              [ngModel]="maintenanceMessage()()"
              (ngModelChange)="maintenanceMessage().set($event)"
              name="maintenanceMessage"
            />
          </mat-form-field>

          <button
            mat-flat-button
            type="button"
            (click)="onToggleMaintenance()()"
            [disabled]="actionLoading()"
          >
            {{ snapshot().controls.maintenance.enabled ? 'Desactiver' : 'Activer' }}
            la maintenance
          </button>

          <mat-form-field appearance="outline">
            <mat-label>Max active requests</mat-label>
            <input
              matInput
              type="number"
              [ngModel]="maxActiveRequests()()"
              (ngModelChange)="maxActiveRequests().set(+$event)"
              name="maxActiveRequests"
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Max event loop lag (ms)</mat-label>
            <input
              matInput
              type="number"
              [ngModel]="maxEventLoopLagMs()()"
              (ngModelChange)="maxEventLoopLagMs().set(+$event)"
              name="maxEventLoopLagMs"
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Max memory (MB)</mat-label>
            <input
              matInput
              type="number"
              [ngModel]="maxMemoryUsageMB()()"
              (ngModelChange)="maxMemoryUsageMB().set(+$event)"
              name="maxMemoryUsageMB"
            />
          </mat-form-field>

          <div class="actions inline">
            <button
              mat-stroked-button
              type="button"
              (click)="onSaveBackpressure()()"
              [disabled]="actionLoading()"
            >
              Enregistrer les seuils
            </button>
            <button
              mat-stroked-button
              type="button"
              (click)="onRotateLogs()()"
              [disabled]="actionLoading()"
            >
              Rotation des logs
            </button>
          </div>
        </div>
      </mat-card>

      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Historique</p>
            <h2>Publications / Sessions</h2>
          </div>
          <span class="badge">{{ history().length }}</span>
        </div>

        <div class="stack">
          <p>Jobs en file: {{ snapshot().history.queue.queueLength }}</p>
          <p>Jobs actifs: {{ snapshot().history.queue.activeJobs }}</p>
          <p>Jobs echoues: {{ snapshot().history.queue.failed }}</p>
        </div>

        @if (history().length === 0) {
          <p class="empty-copy">Aucune session recente.</p>
        } @else {
          <div class="history-list">
            @for (item of history(); track item.sessionId + item.updatedAt) {
              <article class="history-row">
                <div class="history-head">
                  <strong>{{ item.sessionId }}</strong>
                  <span>{{ formatDate(item.updatedAt) }}</span>
                </div>
                <p>
                  Session: {{ item.sessionStatus }} | Finalization:
                  {{ item.finalizationStatus || 'n/a' }}
                </p>
                <p>
                  Notes {{ item.notesProcessed }}/{{ item.notesPlanned }} | Assets
                  {{ item.assetsProcessed }}/{{ item.assetsPlanned }}
                </p>
                @if (item.error) {
                  <p class="error-copy">{{ item.error }}</p>
                }
              </article>
            }
          </div>
        }
      </mat-card>
    </div>
  `,
})
export class AdminOperationsTabComponent {
  readonly snapshot = input.required<AdminDashboardSnapshot>();
  readonly history = input.required<AdminPublicationHistoryEntry[]>();
  readonly actionLoading = input.required<boolean>();
  readonly maintenanceMessage = input.required<WritableSignal<string>>();
  readonly maxActiveRequests = input.required<WritableSignal<number>>();
  readonly maxEventLoopLagMs = input.required<WritableSignal<number>>();
  readonly maxMemoryUsageMB = input.required<WritableSignal<number>>();
  readonly onToggleMaintenance = input.required<() => Promise<void>>();
  readonly onSaveBackpressure = input.required<() => Promise<void>>();
  readonly onRotateLogs = input.required<() => Promise<void>>();

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  }
}
