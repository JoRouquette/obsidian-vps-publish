import { DecimalPipe, NgClass } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

import { type AdminDashboardSnapshot } from '../../../../application/services/admin-dashboard.service';

@Component({
  standalone: true,
  selector: 'app-admin-storage-tab',
  imports: [DecimalPipe, MatCardModule, NgClass],
  template: `
    <div class="detail-grid">
      <mat-card class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Stockage</p>
            <h2>Disque / Logs / Assets</h2>
          </div>
          <span class="badge">{{ snapshot().storage.logs.rotatedFilesCount }}</span>
        </div>

        <div class="stack">
          <p>
            Disque libre:
            {{
              snapshot().storage.disk.availableBytes !== null
                ? ((snapshot().storage.disk.availableBytes ?? 0) / 1073741824 | number: '1.1-2')
                : 'n/a'
            }}
            Go
          </p>
          <p>
            Occupation:
            {{
              snapshot().storage.disk.usagePercent !== null
                ? (snapshot().storage.disk.usagePercent | number: '1.0-2')
                : 'n/a'
            }}%
          </p>
          <p>Contenu publie: {{ snapshot().storage.contentBytes | number }} octets</p>
          <p>Assets sur disque: {{ snapshot().storage.assetsBytes | number }} octets</p>
          <p>Logs archives: {{ snapshot().storage.logs.rotatedFilesTotalBytes | number }} octets</p>
          <p>
            Rotation recommandee:
            {{ snapshot().storage.logs.rotationRecommended ? 'oui' : 'non' }}
          </p>
        </div>

        @if (snapshot().storage.largestAssets.length > 0) {
          <div class="list-block">
            <h3>Assets les plus lourds</h3>
            @for (asset of snapshot().storage.largestAssets; track asset.path) {
              <article class="compact-row">
                <div>
                  <strong>{{ asset.path }}</strong>
                  <p>{{ asset.mimeType }}</p>
                </div>
                <span>{{ asset.size | number }} o</span>
              </article>
            }
          </div>
        }
      </mat-card>

      <mat-card class="panel" [ngClass]="snapshot().diagnostics.status">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Diagnostics</p>
            <h2>Config / Coherence</h2>
          </div>
          <span class="badge">{{ snapshot().diagnostics.messages.length }}</span>
        </div>

        <div class="stack">
          <p>Statut: {{ snapshot().diagnostics.status }}</p>
          <p>Manifest present: {{ snapshot().diagnostics.manifest.exists ? 'oui' : 'non' }}</p>
          <p>
            Version file: {{ snapshot().diagnostics.contentVersion.fileExists ? 'oui' : 'non' }}
          </p>
          <p>
            Revision manifest/version:
            {{
              snapshot().diagnostics.contentVersion.revisionMatchesManifest === null
                ? 'n/a'
                : snapshot().diagnostics.contentVersion.revisionMatchesManifest
                  ? 'coherente'
                  : 'incoherente'
            }}
          </p>
          <p>Pages manquantes: {{ snapshot().diagnostics.manifest.missingPageFiles }}</p>
          <p>Assets manquants: {{ snapshot().diagnostics.manifest.missingAssetFiles }}</p>
        </div>

        @if (snapshot().diagnostics.missingRequiredEnv.length > 0) {
          <div class="list-block">
            <h3>Variables critiques manquantes</h3>
            @for (item of snapshot().diagnostics.missingRequiredEnv; track item) {
              <p class="mono">{{ item }}</p>
            }
          </div>
        }

        @if (snapshot().diagnostics.messages.length > 0) {
          <div class="list-block">
            <h3>Alertes de diagnostic</h3>
            @for (message of snapshot().diagnostics.messages; track message) {
              <p>{{ message }}</p>
            }
          </div>
        }
      </mat-card>
    </div>
  `,
})
export class AdminStorageTabComponent {
  readonly snapshot = input.required<AdminDashboardSnapshot>();
}
