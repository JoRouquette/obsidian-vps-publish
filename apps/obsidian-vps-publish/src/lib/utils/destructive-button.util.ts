import type { ButtonComponent } from 'obsidian';

/**
 * Marque un bouton comme destructif.
 *
 * `ButtonComponent#setDestructive()` remplace `setWarning()` depuis Obsidian
 * 1.13.0, mais le plugin déclare `minAppVersion: 1.5.0` : sur une version
 * antérieure la méthode n'existe pas et l'appel planterait. On l'utilise donc
 * quand elle est disponible, avec repli sur l'API dépréciée sinon.
 *
 * À simplifier en un simple `setDestructive()` le jour où `minAppVersion`
 * passera à 1.13.0 ou plus.
 */
export function markDestructive(button: ButtonComponent): ButtonComponent {
  const candidate = button as ButtonComponent & {
    setDestructive?: () => ButtonComponent;
  };

  // L'appel est précisément gardé par la détection ci-dessus : c'est tout l'objet
  // de ce helper, puisque minAppVersion reste 1.5.0.
  /* eslint-disable obsidianmd/no-unsupported-api */
  if (typeof candidate.setDestructive === 'function') {
    return candidate.setDestructive();
  }
  /* eslint-enable obsidianmd/no-unsupported-api */

  // Repli volontaire sur l'API dépréciée : c'est la seule disponible avant 1.13.
  return button.setWarning();
}
