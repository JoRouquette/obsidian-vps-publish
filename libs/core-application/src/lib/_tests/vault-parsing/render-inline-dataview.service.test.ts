import type { DomainFrontmatter } from '@core-domain/entities/domain-frontmatter';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { LoggerPort } from '@core-domain/ports/logger-port';

import { RenderInlineDataviewService } from '../../vault-parsing/services/render-inline-dataview.service';

class NoopLogger implements LoggerPort {
  private _level: any = 0;
  set level(level: any) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  child(): LoggerPort {
    return this;
  }
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('RenderInlineDataviewService', () => {
  const logger = new NoopLogger();
  const service = new RenderInlineDataviewService(logger);

  const baseFrontmatter: DomainFrontmatter = {
    flat: {},
    nested: {},
    tags: [],
  };

  const baseNote = (content: string, frontmatter: DomainFrontmatter): PublishableNote => ({
    noteId: 'test-note',
    title: 'Test Note',
    vaultPath: 'vault/test.md',
    relativePath: 'test.md',
    content,
    frontmatter,
    folderConfig: {
      id: 'folder',
      vaultFolder: 'vault',
      routeBase: '/',
      vpsId: 'vps',
      ignoredCleanupRuleIds: [],
    },
    routing: {
      routeBase: '/',
      slug: 'test',
      path: '',
      fullPath: '/test',
    },
    publishedAt: new Date(),
    eligibility: {
      isPublishable: true,
    },
  });

  describe('Simple property access (this.property)', () => {
    it('should render a simple string property', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: { titre: 'Le Titre' },
      };

      const note = baseNote('Titre: `= this.titre`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Titre: Le Titre');
    });

    it('should render an array property as comma-separated values', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: { tags: ['magic', 'potion', 'rare'] },
      };

      const note = baseNote('Tags: `= this.tags`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Tags: magic, potion, rare');
    });

    it('should render nested properties', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          relation: {
            parents: ['Parent A', 'Parent B'],
          },
        },
      };

      const note = baseNote('Parents: `= this.relation.parents`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Parents: Parent A, Parent B');
    });

    it('should return empty string for undefined property', () => {
      const note = baseNote('Value: `= this.missingProperty`', baseFrontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Value: ');
    });
  });

  describe('join() function', () => {
    it('should join array property with custom separator', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          effets: ['Effet A', 'Effet B', 'Effet C'],
        },
      };

      const note = baseNote('Effets: `= join(this.effets, " | ")`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Effets: Effet A | Effet B | Effet C');
    });

    it('should handle join() with space separator', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          ingredients: ['Argent', 'Eau distillée'],
        },
      };

      const note = baseNote('Ingrédients: `= join(this.ingredients, " ")`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Ingrédients: Argent Eau distillée');
    });

    it('should normalize string property to array before joining', () => {
      // Cas où frontmatter.effets est une chaîne simple au lieu d'un array
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          effets: 'Effet unique',
        },
      };

      const note = baseNote('Effets: `= join(this.effets, " | ")`', frontmatter);
      const [result] = service.process([note]);

      // Devrait wrapper la chaîne dans un array puis joindre (résultat identique ici)
      expect(result.content).toBe('Effets: Effet unique');
    });

    it('should return empty string when joining undefined property', () => {
      const note = baseNote('Missing: `= join(this.missing, ", ")`', baseFrontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Missing: ');
    });

    it('should handle join() with nested property path', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          meta: {
            keywords: ['keyword1', 'keyword2', 'keyword3'],
          },
        },
      };

      const note = baseNote('Keywords: `= join(this.meta.keywords, ", ")`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Keywords: keyword1, keyword2, keyword3');
    });
  });

  describe('Mixed content with multiple expressions', () => {
    it('should render multiple inline dataview expressions in same content', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          titre: 'Potion de Soin',
          rarete: 'Commun',
          effets: ['Restaure 2d4+2 PV', 'Instantané'],
        },
      };

      const note = baseNote(
        '**Titre**: `= this.titre`\n**Rareté**: `= this.rarete`\n**Effets**: `= join(this.effets, " ; ")`',
        frontmatter
      );

      const [result] = service.process([note]);

      expect(result.content).toBe(
        '**Titre**: Potion de Soin\n**Rareté**: Commun\n**Effets**: Restaure 2d4+2 PV ; Instantané'
      );
    });

    it('should preserve non-dataview inline code', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: { titre: 'Test' },
      };

      const note = baseNote(
        'Some code: `const x = 42;` and dataview: `= this.titre` end.',
        frontmatter
      );

      const [result] = service.process([note]);

      expect(result.content).toBe('Some code: `const x = 42;` and dataview: Test end.');
    });
  });

  describe('HTML rendering scenario (from user report)', () => {
    it('should evaluate join expressions instead of rendering them as code', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: {
          ingredient: ['Argent de haute pureté', 'Eau distillée'],
          rarete: 'commun',
          toxicite: ['Mineur - 2/10', 'Extrême - 9/10 pour les Lycans'],
          effets: ['Effet principal A', 'Effet principal B'],
          effetsSecondaire: ['Effet secondaire A', 'Effet secondaire B'],
        },
      };

      const markdownContent = `
**Ingrédient** : \`= join(this.ingredient, ", ")\`
**Rareté** : \`= this.rarete\`
**Toxicité** : \`= join(this.toxicite, " ; ")\`
**Effet** : \`= join(this.effets, " ")\`
**Effet secondaire** : \`= join(this.effetsSecondaire, " ")\`
`.trim();

      const note = baseNote(markdownContent, frontmatter);
      const [result] = service.process([note]);

      // Le rendu ne doit PAS contenir les formules, mais les valeurs évaluées
      expect(result.content).not.toContain('`= join(this.effets');
      expect(result.content).not.toContain('`= join(this.effetsSecondaire');

      expect(result.content).toContain('Argent de haute pureté, Eau distillée');
      expect(result.content).toContain('commun');
      expect(result.content).toContain('Mineur - 2/10 ; Extrême - 9/10 pour les Lycans');
      expect(result.content).toContain('Effet principal A Effet principal B');
      expect(result.content).toContain('Effet secondaire A Effet secondaire B');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty arrays', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: { emptyArray: [] },
      };

      const note = baseNote('Empty: `= join(this.emptyArray, ", ")`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Empty: ');
    });

    it('should handle numeric values in arrays', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: { numbers: [1, 2, 3] },
      };

      const note = baseNote('Numbers: `= join(this.numbers, "-")`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Numbers: 1-2-3');
    });

    it('should handle boolean values', () => {
      const frontmatter: DomainFrontmatter = {
        ...baseFrontmatter,
        nested: { active: true, disabled: false },
      };

      const note = baseNote('Active: `= this.active`, Disabled: `= this.disabled`', frontmatter);
      const [result] = service.process([note]);

      expect(result.content).toBe('Active: true, Disabled: false');
    });
  });
});
