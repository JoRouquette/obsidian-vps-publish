import type { Setting } from 'obsidian';

/**
 * Affiche un message d'erreur **sous le champ concerné**, ou l'efface.
 *
 * Remplace les `Notice` utilisées jusqu'ici comme messages de validation : une
 * bulle en coin d'écran ne dit pas quel champ est en cause, disparaît toute
 * seule, et laissait l'utilisateur devant un formulaire qui semble accepté.
 *
 * La classe `ptpv-input-error` est celle déjà employée par les champs d'exclusion
 * (expressions régulières) : un seul style d'erreur pour tout l'onglet.
 */
export function setFieldError(
  setting: Setting,
  input: HTMLInputElement,
  message: string | null
): void {
  setting.settingEl.querySelector('.ptpv-field-error')?.remove();

  input.toggleClass('ptpv-input-error', message !== null);
  if (message === null) {
    input.removeAttribute('aria-invalid');
    return;
  }

  input.setAttribute('aria-invalid', 'true');
  setting.settingEl.createDiv({ cls: 'ptpv-field-error', text: message });
}
