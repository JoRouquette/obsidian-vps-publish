import { App, Modal, setIcon } from 'obsidian';

import type { Translations } from '../../i18n/locales';

export interface PublishSummary {
  vpsName: string;
  vpsUrl: string;
  notesCount: number;
  assetsCount: number;
}

/**
 * Modal to confirm publication before uploading to VPS.
 * Displays a summary of what will be published and allows user to confirm or cancel.
 */
export class PublishConfirmModal extends Modal {
  private readonly summary: PublishSummary;
  private readonly translations: Translations;
  private readonly onConfirm: () => void;

  constructor(
    app: App,
    summary: PublishSummary,
    translations: Translations,
    onConfirm: () => void
  ) {
    super(app);
    this.summary = summary;
    this.translations = translations;
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = this.translations.confirmation;

    contentEl.empty();
    contentEl.addClass('ptpv-confirm-modal');

    // Title
    const titleEl = contentEl.createEl('h2', {
      text: t.title,
      cls: 'ptpv-confirm-modal__title',
    });
    const iconEl = titleEl.createSpan({ cls: 'ptpv-confirm-modal__icon' });
    setIcon(iconEl, 'upload-cloud');
    titleEl.prepend(iconEl);

    // Description
    contentEl.createEl('p', {
      text: t.description,
      cls: 'ptpv-confirm-modal__description',
    });

    // Summary list
    const summaryList = contentEl.createDiv({ cls: 'ptpv-confirm-modal__summary' });

    // VPS info
    const vpsItem = summaryList.createDiv({ cls: 'ptpv-confirm-modal__item' });
    vpsItem.createSpan({ text: t.vpsLabel + ': ', cls: 'ptpv-confirm-modal__label' });
    vpsItem.createSpan({
      text: `${this.summary.vpsName} (${this.summary.vpsUrl})`,
      cls: 'ptpv-confirm-modal__value',
    });

    // Notes count
    const notesItem = summaryList.createDiv({ cls: 'ptpv-confirm-modal__item' });
    notesItem.createSpan({ text: t.notesLabel + ': ', cls: 'ptpv-confirm-modal__label' });
    notesItem.createSpan({
      text: `~${this.summary.notesCount}`,
      cls: 'ptpv-confirm-modal__value ptpv-confirm-modal__value--count',
    });

    // Assets count
    const assetsItem = summaryList.createDiv({ cls: 'ptpv-confirm-modal__item' });
    assetsItem.createSpan({ text: t.assetsLabel + ': ', cls: 'ptpv-confirm-modal__label' });
    assetsItem.createSpan({
      text: `~${this.summary.assetsCount}`,
      cls: 'ptpv-confirm-modal__value ptpv-confirm-modal__value--count',
    });

    // Buttons
    const buttonsEl = contentEl.createDiv({ cls: 'ptpv-confirm-modal__buttons' });

    const cancelBtn = buttonsEl.createEl('button', {
      text: t.cancelButton,
      cls: 'ptpv-confirm-modal__btn ptpv-confirm-modal__btn--cancel',
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const confirmBtn = buttonsEl.createEl('button', {
      text: t.publishButton,
      cls: 'ptpv-confirm-modal__btn ptpv-confirm-modal__btn--confirm mod-cta',
    });
    confirmBtn.addEventListener('click', () => {
      this.close();
      this.onConfirm();
    });

    // Focus cancel button by default for safety
    cancelBtn.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
