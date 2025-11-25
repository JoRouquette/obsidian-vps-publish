import type { DomainFrontmatter } from '@core-domain/publish/DomainFrontmatter';
import { IgnorePrimitive } from '@core-domain/publish/IgnorePrimitive';
import type { IgnoreRule } from '@core-domain/publish/IgnoreRule';
import type { NoteEligibility } from '@core-domain/publish/NoteEligibility';
import type { LoggerPort } from '@core-domain/publish/ports/logger-port';
import { normalizePropertyKey } from '@core-domain/publish/utils/string.utils';

export interface EvaluateIgnoreRulesInput {
  frontmatter: DomainFrontmatter;
  rules: IgnoreRule[] | null | undefined;
}

export class EvaluateIgnoreRulesUseCase {
  private readonly _logger: LoggerPort;

  constructor(logger: LoggerPort) {
    this._logger = logger.child({ usecase: 'EvaluateIgnoreRulesUseCase' });
  }

  execute(input: EvaluateIgnoreRulesInput): NoteEligibility {
    const { frontmatter, rules } = input;

    this._logger.debug('Evaluating ignore rules', { frontmatter, rules });
    rules?.map((r) => this._logger.debug(` - rule: ${JSON.stringify(r)}`));

    if (!rules || rules.length === 0) {
      this._logger.info('No ignore rules provided, note is publishable');
      return { isPublishable: true };
    }

    const nested = frontmatter.nested;

    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      const value = getNestedValue(nested, normalizePropertyKey(rule.property));

      this._logger.debug(`Evaluating rule ${index}`, { rule, value, index });

      if (value === undefined) {
        this._logger.debug(
          `Property does not exist in frontmatter, skipping rule evaluation property: ${rule.property}, index: ${index}`
        );
        continue;
      }

      // 1) Cas ignoreIf (bool uniquement)
      if (rule.ignoreIf !== undefined) {
        if (typeof value === 'boolean' && value === rule.ignoreIf) {
          this._logger.info(
            `Note ignored by ignoreIf rule property: ${rule.property}, value: ${value}, ruleIndex: ${index}`
          );
          return {
            isPublishable: false,
            ignoredByRule: {
              property: rule.property,
              reason: 'ignoreIf',
              matchedValue: rule.ignoreIf, // bool
              ruleIndex: index,
            },
          };
        }
        // Si la valeur n'est pas booléenne, on ignore cette partie de la règle.
      }

      // 2) Cas ignoreValues
      if (rule.ignoreValues && rule.ignoreValues.length > 0) {
        const matched = matchesAnyPrimitive(value, rule.ignoreValues);
        if (matched !== undefined) {
          this._logger.info(
            `Note ignored by ignoreValues rule property: ${rule.property}, matchedValue: ${matched}, ruleIndex: ${index}`
          );
          return {
            isPublishable: false,
            ignoredByRule: {
              property: rule.property,
              reason: 'ignoreValues',
              matchedValue: matched,
              ruleIndex: index,
            },
          };
        }
      }
    }

    // Aucune règle n'a matché : la note est publiable.
    this._logger.info('No ignore rule matched, note is publishable');
    return { isPublishable: true };
  }
}

/**
 * Retrieves a value from the nested frontmatter using a dotted property path.
 * Example: getNestedValue(nested, "relation.parents") will return nested["relation"]["parents"] if it exists.
 */
function getNestedValue(
  nested: Record<string, unknown>,
  propertyPath: string
): unknown {
  const segments = propertyPath.split('.').map(normalizePropertyKey);

  let current: any = nested;
  for (const segment of segments) {
    if (
      typeof current !== 'object' ||
      current === null ||
      !(segment in current)
    ) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

/**
 * Compare une valeur quelconque (unknown) à une valeur primitive d'ignore.
 * On reste sur une égalité stricte, sans coercition.
 */
function isEqualPrimitive(value: unknown, target: IgnorePrimitive): boolean {
  return value === target;
}

/**
 * Retourne la valeur de target qui matche, ou undefined si aucun match.
 * - value peut être un primitif ou un tableau de primitifs.
 */
function matchesAnyPrimitive(
  value: unknown,
  targets: IgnorePrimitive[]
): IgnorePrimitive | undefined {
  if (targets.length === 0) return undefined;

  if (Array.isArray(value)) {
    for (const item of value) {
      for (const t of targets) {
        if (isEqualPrimitive(item, t)) {
          return t;
        }
      }
    }
    return undefined;
  }

  for (const t of targets) {
    if (isEqualPrimitive(value, t)) {
      return t;
    }
  }

  return undefined;
}
