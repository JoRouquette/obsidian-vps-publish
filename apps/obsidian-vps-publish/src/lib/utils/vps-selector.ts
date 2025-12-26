import type { VpsConfig } from '@core-domain/entities';
import type { App } from 'obsidian';
import { SuggestModal } from 'obsidian';

import { translate } from '../../i18n';
import type { Translations } from '../../i18n/locales';

/**
 * Modal for selecting a VPS when multiple are configured
 */
export class VpsSelectorModal extends SuggestModal<VpsConfig> {
  private vpsConfigs: VpsConfig[];
  private onSelect: (vps: VpsConfig) => void;

  constructor(
    app: App,
    vpsConfigs: VpsConfig[],
    onSelect: (vps: VpsConfig) => void,
    translations?: Translations
  ) {
    super(app);
    this.vpsConfigs = vpsConfigs;
    this.onSelect = onSelect;
    const placeholder = translations
      ? translate(translations, 'placeholders.selectVps')
      : 'Select a VPS to target...';
    this.setPlaceholder(placeholder);
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
 * @param translations Optional translations object for UI strings
 */
export function selectVpsOrAuto(
  app: App,
  vpsConfigs: VpsConfig[],
  callback: (vps: VpsConfig) => void | Promise<void>,
  translations?: Translations
): void {
  if (vpsConfigs.length === 0) {
    // No VPS configured - this should be handled by caller
    return;
  }

  if (vpsConfigs.length === 1) {
    // Auto-select the only VPS
    const result = callback(vpsConfigs[0]);
    if (result instanceof Promise) {
      void result;
    }
  } else {
    // Show modal to let user choose
    const wrappedCallback = (vps: VpsConfig): void => {
      const result = callback(vps);
      if (result instanceof Promise) {
        void result;
      }
    };
    const modal = new VpsSelectorModal(app, vpsConfigs, wrappedCallback, translations);
    modal.open();
  }
}
