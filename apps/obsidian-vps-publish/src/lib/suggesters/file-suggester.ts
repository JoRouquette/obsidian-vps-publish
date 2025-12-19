import { AbstractInputSuggest, type App, TFile } from 'obsidian';

/**
 * Suggestion de fichiers du vault pour un input texte.
 * Attachée à un <input> existant, sans modal séparée.
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    private inputEl: HTMLInputElement
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFile[] {
    const normalized = query.toLowerCase();
    const files: TFile[] = [];

    this.app.vault.getAllLoadedFiles().forEach((file) => {
      if (file instanceof TFile) {
        if (!normalized || file.path.toLowerCase().contains(normalized)) {
          files.push(file);
        }
      }
    });

    return files;
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    // Déclenche l'event "input" pour que Obsidian/Setting capte la modif
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
