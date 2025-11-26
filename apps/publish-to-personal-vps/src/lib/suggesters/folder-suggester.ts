import { AbstractInputSuggest, TFolder, App } from 'obsidian';

/**
 * Suggestion de dossiers du vault pour un input texte.
 * Attachée à un <input> existant, sans modal séparée.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFolder[] {
    const normalized = query.toLowerCase();
    const folders: TFolder[] = [];

    this.app.vault.getAllLoadedFiles().forEach((file) => {
      if (file instanceof TFolder) {
        if (!normalized || file.path.toLowerCase().contains(normalized)) {
          folders.push(file);
        }
      }
    });

    return folders;
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    // Déclenche l'event "input" pour que Obsidian/Setting capte la modif
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
