export interface MaintenanceModeState {
  enabled: boolean;
  message: string | null;
  changedAt: string | null;
}

export class AdminRuntimeControlService {
  private maintenanceState: MaintenanceModeState = {
    enabled: false,
    message: null,
    changedAt: null,
  };

  getMaintenanceState(): MaintenanceModeState {
    return { ...this.maintenanceState };
  }

  setMaintenanceMode(enabled: boolean, message?: string | null): MaintenanceModeState {
    this.maintenanceState = {
      enabled,
      message: enabled ? message?.trim() || null : null,
      changedAt: new Date().toISOString(),
    };

    return this.getMaintenanceState();
  }
}
