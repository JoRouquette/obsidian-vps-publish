/**
 * Représente une expression Dataview inline détectée et évaluée.
 *
 * Exemple de markdown :
 *  - "**Titres** : `= this.titres`"
 *
 * On ne gère pour l'instant que le pattern "= this.<path>".
 */
export interface InlineDataviewExpression {
  /**
   * Texte complet trouvé dans le markdown, backticks inclus.
   * ex: "`= this.titres `"
   */
  raw: string;

  /**
   * Contenu entre les backticks.
   * ex: "= this.titres "
   */
  code: string;

  /**
   * Expression nettoyée (sans le "=" initial, trim).
   * ex: "this.titres"
   */
  expression: string;

  /**
   * Chemin de propriété après "this.".
   * ex:
   *  - "titres"
   *  - "domaines"
   *  - "relation.parents"
   */
  propertyPath: string;

  /**
   * Valeur brute obtenue depuis le frontmatter.
   */
  resolvedValue: unknown;

  /**
   * Texte final injecté dans le markdown.
   * ex:
   *  - "Nouvelle Lune, Tisseuse d'Ombre, ..."
   *  - "Loyal Neutre"
   */
  renderedText: string;
}
