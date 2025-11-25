export interface ResolvedAssetFile {
  /**
   * Chemin réel dans le vault Obsidian.
   * ex: "assets/divinites/Tenebra1.jpg"
   */
  vaultPath: string;

  /**
   * Nom de fichier seul.
   * ex: "Tenebra1.jpg"
   */
  fileName: string;

  /**
   * Chemin logique côté backend, relatif à la racine des assets.
   * ex: "divinites/Tenebra1.jpg"
   * ou "images/Tenebra1.jpg" si le fichier n'est pas sous assetsFolder.
   */
  relativeAssetPath: string;

  /**
   * Contenu binaire du fichier.
   */
  content: ArrayBuffer | Uint8Array;

  /**
   * Type MIME si connu côté client, sinon laissé à null/undefined.
   * Le client peut aussi le déduire du fileName.
   */
  mimeType?: string;
}
