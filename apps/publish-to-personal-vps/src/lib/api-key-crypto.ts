const PREFIX = 'enc:';

/**
 * "Chiffre" l'API key de façon réversible.
 * Techniquement c'est juste du base64 avec un préfixe.
 * => obfuscation, pas sécurité forte.
 */
export function encryptApiKey(value: string | undefined | null): string {
  if (!value) return '';
  try {
    return PREFIX + btoa(value);
  } catch {
    // En cas d'environnement bizarre, on retombe sur le clair
    return value;
  }
}

/**
 * Déchiffre l'API key si elle a été encryptée par encryptApiKey.
 * Si ce n'est pas le cas (ancien format), on renvoie la valeur telle quelle.
 */
export function decryptApiKey(value: string | undefined | null): string {
  if (!value) return '';
  if (!value.startsWith(PREFIX)) {
    // backward compat : ancienne valeur en clair
    return value;
  }
  const base64 = value.slice(PREFIX.length);
  try {
    return atob(base64);
  } catch {
    return '';
  }
}
