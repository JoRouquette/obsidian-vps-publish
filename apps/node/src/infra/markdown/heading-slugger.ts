/**
 * Service to generate URL-safe slugs from heading text.
 * Matches the slugification used by markdown-it for heading IDs.
 *
 * Used to resolve wikilinks like [[#Heading Name]] to #heading-name
 */
export class HeadingSlugger {
  /**
   * Convert heading text to URL-safe slug matching markdown-it's behavior.
   *
   * Rules:
   * - Lowercase
   * - Replace spaces and special chars with hyphens
   * - Remove accents/diacritics
   * - Strip leading/trailing hyphens
   * - Collapse multiple hyphens
   *
   * @param text - Raw heading text
   * @returns URL-safe slug
   *
   * @example
   * slugify("Les Héros Légendaires")
   * // => "les-heros-legendaires"
   *
   * slugify("C'est l'été!")
   * // => "cest-lete"
   */
  slugify(text: string): string {
    return (
      text
        // Normalize Unicode (decompose accents)
        .normalize('NFKD')
        // Remove diacritics/accents
        .replace(/[\u0300-\u036f]/g, '')
        // Lowercase
        .toLowerCase()
        // Replace spaces and non-alphanumeric with hyphens
        .replace(/[^\w\s-]/g, '')
        // Replace whitespace with hyphens
        .replace(/\s+/g, '-')
        // Collapse multiple hyphens
        .replace(/-+/g, '-')
        // Trim leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
    );
  }
}
