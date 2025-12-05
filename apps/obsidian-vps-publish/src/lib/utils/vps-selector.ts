import type { VpsConfig } from '@core-domain/entities';
import type { App } from 'obsidian';
import { SuggestModal } from 'obsidian';

/**
 * Modal for selecting a VPS when multiple are configured
 */
export class VpsSelectorModal extends SuggestModal<VpsConfig> {
  private vpsConfigs: VpsConfig[];
  private onSelect: (vps: VpsConfig) => void;

  constructor(app: App, vpsConfigs: VpsConfig[], onSelect: (vps: VpsConfig) => void) {
    super(app);
    this.vpsConfigs = vpsConfigs;
    this.onSelect = onSelect;
    this.setPlaceholder('Select a VPS to target...');
  }

  getSuggestions(query: string): VpsConfig[] {
    const lowerQuery = query.toLowerCase();
    return this.vpsConfigs.filter(
      (vps) =>
        vps.name.toLowerCase().includes(lowerQuery) ||
        vps.baseUrl.toLowerCase().includes(lowerQuery)
    );
  }

  renderSuggestion(vps: VpsConfig, el: HTMLElement): void {
    el.createEl('div', { text: vps.name, cls: 'vps-selector-name' });
    el.createEl('small', { text: vps.baseUrl, cls: 'vps-selector-url' });
  }

  onChooseSuggestion(vps: VpsConfig): void {
    this.onSelect(vps);
  }
}

/**
 * Helper to select a VPS or auto-select if only one is configured
 * @param app Obsidian App instance
 * @param vpsConfigs Array of VPS configurations
 * @param callback Function to call with selected VPS
 */
export function selectVpsOrAuto(
  app: App,
  vpsConfigs: VpsConfig[],
  callback: (vps: VpsConfig) => void | Promise<void>
): void {
  if (vpsConfigs.length === 0) {
    // No VPS configured - this should be handled by caller
    return;
  }

  if (vpsConfigs.length === 1) {
    // Auto-select the only VPS
    void callback(vpsConfigs[0]);
    return;
  }

  // Multiple VPS - show selector modal
  const modal = new VpsSelectorModal(app, vpsConfigs, (vps) => {
    void callback(vps);
  });
  modal.open();
}
