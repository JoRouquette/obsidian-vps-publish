import { App, Modal, setIcon } from 'obsidian';

import type { Translations } from '../../i18n/locales';

export interface PublishSummary {
  vpsName: string;
  vpsUrl: string;
  notesCount: number;
  assetsCount: number;
}

export class PublishConfirmModal extends Modal {
  private readonly summary: PublishSummary;
  private readonly t: Translations['confirmation'];
  private readonly onConfirm: () => void | Promise<void>;
  private confirmed = false;

  constructor(
    app: App,
    summary: PublishSummary,
    translations: Translations,
    onConfirm: () => void | Promise<void>
  ) {
    super(app);
    this.summary = summary;
    this.t = translations.confirmation;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl, titleEl } = this;
    const { t, summary } = this;

    // Native Obsidian title bar
    titleEl.empty();
    const iconSpan = titleEl.createSpan({ cls: 'ptpv-confirm-modal__icon' });
    setIcon(iconSpan, 'upload-cloud');
    titleEl.appendText(t.title);

    contentEl.empty();
    contentEl.addClass('ptpv-confirm-modal');

    // Summary table
    const table = contentEl.createEl('table', { cls: 'ptpv-confirm-modal__table' });
    const tbody = table.createEl('tbody');

    this.addRow(tbody, t.vpsLabel, summary.vpsName);
    this.addRow(tbody, 'URL', this.formatUrl(summary.vpsUrl));
    this.addRow(tbody, t.notesLabel, `~ ${summary.notesCount}`);
    this.addRow(tbody, t.assetsLabel, `~ ${summary.assetsCount}`);

    // Estimated hint
    contentEl.createEl('p', {
      text: t.estimatedHint,
      cls: 'ptpv-confirm-modal__hint',
    });

    // Buttons — Obsidian-native layout
    const buttons = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttons.createEl('button', { text: t.cancelButton });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = buttons.createEl('button', {
      text: t.publishButton,
      cls: 'mod-cta',
    });
    confirmBtn.addEventListener('click', () => {
      this.confirmed = true;
      this.close();
    });

    // Focus cancel for safety (Escape already closes via Modal base)
    cancelBtn.focus();
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.confirmed) {
      void this.onConfirm();
    }
  }

  private addRow(tbody: HTMLTableSectionElement, label: string, value: string): void {
    const row = tbody.createEl('tr');
    row.createEl('td', { text: label, cls: 'ptpv-confirm-modal__label' });
    row.createEl('td', { text: value, cls: 'ptpv-confirm-modal__value' });
  }

  private formatUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }
}
