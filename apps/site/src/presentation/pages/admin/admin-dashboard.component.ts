import { DatePipe, NgComponentOutlet } from '@angular/common';
import {
  Component,
  OnInit,
  Type,
  ViewEncapsulation,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

import { ConfigFacade } from '../../../application/facades/config-facade';
import {
  AdminDashboardService,
  type AdminDashboardSnapshot,
  type AdminLogEntry,
  type AdminPublicationHistoryEntry,
} from '../../../application/services/admin-dashboard.service';

type AdminTabId = 'overview' | 'storage' | 'operations' | 'observability';
type AdminLazyTabComponent = Type<unknown>;

interface AdminTabDefinition {
  id: AdminTabId;
  label: string;
  hint: string;
  loader: () => Promise<AdminLazyTabComponent>;
}

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  encapsulation: ViewEncapsulation.None,
  imports: [
    DatePipe,
    FormsModule,
    NgComponentOutlet,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  readonly admin = inject(AdminDashboardService);
  private readonly config = inject(ConfigFacade);

  readonly user = signal('');
  readonly mdp = signal('');
  readonly maintenanceMessage = signal('');
  readonly maxActiveRequests = signal(0);
  readonly maxEventLoopLagMs = signal(0);
  readonly maxMemoryUsageMB = signal(0);
  readonly selectedTabIndex = signal(0);
  readonly loadedTabs = signal<Partial<Record<AdminTabId, AdminLazyTabComponent>>>({});

  readonly tabs: readonly AdminTabDefinition[] = [
    {
      id: 'overview',
      label: 'Vue globale',
      hint: 'publication, sante, runtime',
      loader: async () =>
        (await import('./tabs/admin-overview-tab.component')).AdminOverviewTabComponent,
    },
    {
      id: 'storage',
      label: 'Stockage',
      hint: 'disque, assets, diagnostics',
      loader: async () =>
        (await import('./tabs/admin-storage-tab.component')).AdminStorageTabComponent,
    },
    {
      id: 'operations',
      label: 'Operations',
      hint: 'maintenance, backpressure, historique',
      loader: async () =>
        (await import('./tabs/admin-operations-tab.component')).AdminOperationsTabComponent,
    },
    {
      id: 'observability',
      label: 'Observabilite',
      hint: 'alertes et logs serveur',
      loader: async () =>
        (await import('./tabs/admin-observability-tab.component')).AdminObservabilityTabComponent,
    },
  ];

  readonly snapshot = this.admin.snapshot;
  readonly logs = this.admin.logs;
  readonly history = this.admin.history;
  readonly authError = this.admin.authError;
  readonly actionFeedback = this.admin.actionFeedback;
  readonly adminEnabled = computed(() => this.config.cfg()?.adminDashboardEnabled ?? false);
  readonly lastRefreshLabel = computed(() => this.admin.lastRefreshedAt());

  constructor() {
    effect(() => {
      const snapshot = this.snapshot();
      const controls = snapshot?.controls;
      if (!controls?.backpressure.config) {
        return;
      }

      this.maintenanceMessage.set(controls.maintenance.message ?? '');
      this.maxActiveRequests.set(controls.backpressure.config.maxActiveRequests);
      this.maxEventLoopLagMs.set(controls.backpressure.config.maxEventLoopLagMs);
      this.maxMemoryUsageMB.set(controls.backpressure.config.maxMemoryUsageMB);
    });

    void this.ensureTabLoaded(this.tabs[0].id);
  }

  ngOnInit(): void {
    if (this.admin.credentials()) {
      void this.admin.refreshAll();
    }
  }

  async submit(): Promise<void> {
    await this.admin.login(this.user(), this.mdp());
    this.mdp.set('');
  }

  async refresh(): Promise<void> {
    await this.admin.refreshAll();
  }

  async refreshLogs(): Promise<void> {
    await this.admin.refreshLogs();
  }

  async toggleMaintenance(): Promise<void> {
    const enabled = !(this.snapshot()?.controls.maintenance.enabled ?? false);
    await this.admin.setMaintenance(enabled, this.maintenanceMessage());
  }

  async saveBackpressure(): Promise<void> {
    await this.admin.updateBackpressure({
      maxActiveRequests: this.maxActiveRequests(),
      maxEventLoopLagMs: this.maxEventLoopLagMs(),
      maxMemoryUsageMB: this.maxMemoryUsageMB(),
    });
  }

  async rotateLogs(): Promise<void> {
    await this.admin.rotateLogs();
  }

  async onTabChange(index: number): Promise<void> {
    this.selectedTabIndex.set(index);
    const tab = this.tabs[index];
    if (tab) {
      await this.ensureTabLoaded(tab.id);
    }
  }

  logout(): void {
    this.admin.logout();
    this.user.set('');
    this.mdp.set('');
    this.selectedTabIndex.set(0);
  }

  tabComponent(tabId: AdminTabId): AdminLazyTabComponent | null {
    return this.loadedTabs()[tabId] ?? null;
  }

  tabInputs(tabId: AdminTabId): Record<string, unknown> {
    const snapshot = this.snapshot();
    if (!snapshot) {
      return {};
    }

    switch (tabId) {
      case 'overview':
        return { snapshot };
      case 'storage':
        return { snapshot };
      case 'operations':
        return {
          snapshot,
          history: this.history(),
          actionLoading: this.admin.actionLoading(),
          maintenanceMessage: this.maintenanceMessage,
          maxActiveRequests: this.maxActiveRequests,
          maxEventLoopLagMs: this.maxEventLoopLagMs,
          maxMemoryUsageMB: this.maxMemoryUsageMB,
          onToggleMaintenance: () => this.toggleMaintenance(),
          onSaveBackpressure: () => this.saveBackpressure(),
          onRotateLogs: () => this.rotateLogs(),
        };
      case 'observability':
        return {
          snapshot,
          logs: this.logs(),
        };
      default:
        return {};
    }
  }

  private async ensureTabLoaded(tabId: AdminTabId): Promise<void> {
    if (this.loadedTabs()[tabId]) {
      return;
    }

    const tab = this.tabs.find((candidate) => candidate.id === tabId);
    if (!tab) {
      return;
    }

    const component = await tab.loader();
    this.loadedTabs.update((loaded) => ({
      ...loaded,
      [tabId]: component,
    }));
  }
}

export type AdminOperationsTabInputs = {
  snapshot: AdminDashboardSnapshot;
  history: AdminPublicationHistoryEntry[];
  actionLoading: boolean;
  maintenanceMessage: WritableSignal<string>;
  maxActiveRequests: WritableSignal<number>;
  maxEventLoopLagMs: WritableSignal<number>;
  maxMemoryUsageMB: WritableSignal<number>;
  onToggleMaintenance: () => Promise<void>;
  onSaveBackpressure: () => Promise<void>;
  onRotateLogs: () => Promise<void>;
};

export type AdminOverviewTabInputs = {
  snapshot: AdminDashboardSnapshot;
};

export type AdminStorageTabInputs = {
  snapshot: AdminDashboardSnapshot;
};

export type AdminObservabilityTabInputs = {
  snapshot: AdminDashboardSnapshot;
  logs: AdminLogEntry[];
};
