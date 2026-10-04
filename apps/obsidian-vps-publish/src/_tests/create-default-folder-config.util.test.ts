import { ContentSanitizerService } from '@core-application/vault-parsing/services/content-sanitizer.service';
import type { PublishableNote } from '@core-domain/entities/publishable-note';
import type { SanitizationRules } from '@core-domain/entities/sanitization-rules';

import {
  createDefaultFolderConfig,
  defaultSanitizationRules,
  enrichCleanupRules,
  LEGACY_REMOVE_CODE_BLOCKS_REGEX,
  REMOVE_CODE_BLOCKS_REGEX,
} from '../lib/utils/create-default-folder-config.util';

// Même compilation que ContentSanitizerService côté serveur.
const removeCodeBlocks = (content: string): string =>
  content.replace(new RegExp(REMOVE_CODE_BLOCKS_REGEX, 'gm'), '');
const fence = (length: number, char = '`'): string => char.repeat(length);
const lines = (...parts: string[]): string => parts.join('\n');

describe('createDefaultFolderConfig', () => {
  it('crée un dossier avec les règles de sanitization par défaut et le vpsId fourni', () => {
    const cfg = createDefaultFolderConfig('vps-123');

    expect(cfg.vpsId).toBe('vps-123');
    expect(cfg.ignoredCleanupRuleIds).toEqual([]);
  });

  it('permet de surcharger les valeurs par défaut', () => {
    const cfg = createDefaultFolderConfig('vps-1', {
      vaultFolder: 'Notes',
      routeBase: '/notes',
      id: 'custom-id',
    });

    expect(cfg.id).toBe('custom-id');
    expect(cfg.vaultFolder).toBe('Notes');
    expect(cfg.routeBase).toBe('/notes');
  });
});

describe('defaultSanitizationRules', () => {
  it('retourne au moins une règle activée pour les blocs de code', () => {
    const rules = defaultSanitizationRules();
    const codeRule = rules.find((r) => r.name.includes('code'));

    expect(codeRule).toBeDefined();
    expect(codeRule?.isEnabled).toBe(true);
    expect(codeRule?.regex).toBe(REMOVE_CODE_BLOCKS_REGEX);
  });
});

describe('REMOVE_CODE_BLOCKS_REGEX', () => {
  it('removes a block closed by a longer fence without leaving a backtick', () => {
    const content = lines(
      'Avant',
      '',
      fence(3) + 'dataviewjs',
      'dv.list([1]);',
      fence(4),
      '',
      'Après'
    );

    const result = removeCodeBlocks(content);

    expect(result).toBe(lines('Avant', '', '', '', 'Après'));
    expect(result).not.toContain('`');
  });

  it('removes backtick and tilde blocks', () => {
    const content = lines(
      fence(3) + 'js',
      'a();',
      fence(3),
      'Milieu',
      fence(3, '~'),
      'b',
      fence(3, '~')
    );

    expect(removeCodeBlocks(content)).toBe(lines('', 'Milieu', ''));
  });

  it('keeps an inner shorter fence inside a longer block', () => {
    const content = lines(fence(4) + 'md', fence(3) + 'js', 'a();', fence(3), fence(4), 'Fin');

    expect(removeCodeBlocks(content)).toBe(lines('', 'Fin'));
  });

  it('handles CRLF line endings', () => {
    const content = [fence(3) + 'dataview', 'LIST', fence(4), 'Fin'].join('\r\n');

    expect(removeCodeBlocks(content)).toBe('\nFin');
  });

  it('does not pair the fences of two unrelated blocks across text', () => {
    const content = lines(
      fence(4) + 'js',
      'a();',
      fence(4),
      'Texte publié',
      fence(3) + 'js',
      'b();',
      fence(3)
    );

    expect(removeCodeBlocks(content)).toBe(lines('', 'Texte publié', ''));
  });

  it('leaves a lone unclosed fence alone', () => {
    const content = lines('Texte', fence(3) + 'js', 'a();');

    expect(removeCodeBlocks(content)).toBe(content);
  });

  it('removes a block inside a callout and keeps the callout going', () => {
    const content = lines(
      '> [!note]',
      '> ' + fence(3) + 'dataviewjs',
      '> dv.list([1]);',
      '> ' + fence(4),
      '> suite du callout',
      'Fin'
    );

    const result = removeCodeBlocks(content);

    // La ligne d'ouverture garde son « > » : une ligne vide fermerait le callout.
    expect(result).toBe(lines('> [!note]', '> ', '> suite du callout', 'Fin'));
    expect(result).not.toContain('`');
  });

  it('removes a block inside a nested quote', () => {
    const content = lines(
      '> [!info]',
      '> > ' + fence(3) + 'dataview',
      '> > LIST',
      '> > ' + fence(3),
      'Fin'
    );

    expect(removeCodeBlocks(content)).toBe(lines('> [!info]', '> > ', 'Fin'));
  });

  it('removes blocks opened on a list item line', () => {
    const bullet = lines(
      '- item',
      '- ' + fence(3) + 'js',
      '  secret();',
      '  ' + fence(3),
      '- after'
    );
    const ordered = lines('1. ' + fence(3) + 'js', '   secret();', '   ' + fence(3), 'fin');
    const quoted = lines('> - ' + fence(3) + 'js', '>   secret();', '> ' + fence(3), 'fin');

    expect(removeCodeBlocks(bullet)).toBe(lines('- item', '- ', '- after'));
    expect(removeCodeBlocks(ordered)).toBe(lines('1. ', 'fin'));
    expect(removeCodeBlocks(quoted)).toBe(lines('> - ', 'fin'));
  });

  it('does not close a top-level block on a quoted fence', () => {
    const content = lines(
      fence(3) + 'md',
      '> [!note]',
      '> ' + fence(3) + 'js',
      '> x',
      '> ' + fence(3),
      fence(3),
      'Texte publié',
      fence(3) + 'js',
      'b',
      fence(3)
    );

    expect(removeCodeBlocks(content)).toBe(lines('', 'Texte publié', ''));
  });

  it('does not close a quoted block on a top-level fence', () => {
    const content = lines(
      '> [!note]',
      '> ' + fence(3) + 'js',
      '> a',
      '',
      'Texte publié',
      fence(3) + 'js',
      'b',
      fence(3)
    );

    expect(removeCodeBlocks(content)).toBe(
      lines('> [!note]', '> ' + fence(3) + 'js', '> a', '', 'Texte publié', '')
    );
  });

  it('keeps triple backticks used inline in a sentence', () => {
    const content = 'Use ```x``` here';

    expect(removeCodeBlocks(content)).toBe(content);
  });

  it('stops a quoted block left open at the end of its quote', () => {
    const content = lines(
      '> [!note]',
      '> ' + fence(3) + 'js',
      '> a',
      '',
      'Texte publié',
      '',
      '> [!tip]',
      '> ' + fence(3) + 'dataview',
      '> LIST',
      '> ' + fence(3),
      'Fin'
    );

    expect(removeCodeBlocks(content)).toBe(
      lines(
        '> [!note]',
        '> ' + fence(3) + 'js',
        '> a',
        '',
        'Texte publié',
        '',
        '> [!tip]',
        '> ',
        'Fin'
      )
    );
  });

  it('handles CRLF line endings inside a callout', () => {
    const content = ['> ' + fence(3) + 'js', '> a', '> ' + fence(3), 'Fin'].join('\r\n');

    expect(removeCodeBlocks(content)).toBe('> \nFin');
  });

  it('stays linear on long lines of spaces or blockquote markers', () => {
    const content = lines(' '.repeat(50_000), '> '.repeat(50_000), 'Fin');

    const start = performance.now();
    const result = removeCodeBlocks(content);
    const elapsed = performance.now() - start;

    expect(result).toBe(content);
    // Seuil large : la version quadratique prenait plusieurs secondes sur cette entrée.
    expect(elapsed).toBeLessThan(500);
  });

  it('does not close a long tilde fence on a shorter one', () => {
    const content = lines(fence(4, '~'), 'secret', fence(3, '~'), 'public');

    expect(removeCodeBlocks(content)).toBe(content);
  });

  it('closes a tilde fence on a longer one', () => {
    const content = lines(fence(3, '~') + 'js', 'a();', fence(4, '~'), 'Fin');

    expect(removeCodeBlocks(content)).toBe(lines('', 'Fin'));
  });

  it('is applied the same way by ContentSanitizerService with the default rules', () => {
    const note = {
      noteId: 'note',
      content: lines('Avant', fence(3) + 'dataviewjs', 'dv.list([1]);', fence(4), 'Après'),
      frontmatter: { flat: {}, nested: {}, tags: [] },
      folderConfig: { ignoredCleanupRuleIds: [] },
    } as unknown as PublishableNote;

    const [sanitized] = new ContentSanitizerService(defaultSanitizationRules()).process([note]);

    expect(sanitized.content).toBe(lines('Avant', '', 'Après'));
  });

  it('documents the legacy regex defect it replaces', () => {
    const content = lines(fence(3) + 'dataviewjs', 'dv.list([1]);', fence(4));

    expect(content.replace(new RegExp(LEGACY_REMOVE_CODE_BLOCKS_REGEX, 'gm'), '')).toBe('`');
  });
});

describe('enrichCleanupRules', () => {
  const storedRule = (overrides: Partial<SanitizationRules> = {}): SanitizationRules => ({
    id: 'remove-code-blocks',
    name: 'Remove fenced code blocks',
    regex: LEGACY_REMOVE_CODE_BLOCKS_REGEX,
    replacement: '',
    isEnabled: true,
    ...overrides,
  });

  it('migrates the code-block rule still holding the legacy default regex', () => {
    const [rule] = enrichCleanupRules([storedRule()]);

    expect(rule.regex).toBe(REMOVE_CODE_BLOCKS_REGEX);
  });

  it('keeps the user choices while migrating', () => {
    const [rule] = enrichCleanupRules([storedRule({ isEnabled: false, name: 'Mes blocs' })]);

    expect(rule.regex).toBe(REMOVE_CODE_BLOCKS_REGEX);
    expect(rule.isEnabled).toBe(false);
    expect(rule.name).toBe('Mes blocs');
  });

  it('leaves a regex edited by the user untouched', () => {
    const custom = '```mermaid[\\s\\S]*?```';

    const [rule] = enrichCleanupRules([storedRule({ regex: custom })]);

    expect(rule.regex).toBe(custom);
  });

  it('does not touch another rule holding the legacy regex', () => {
    const other = storedRule({ id: 'cleanup-123', name: 'Copie' });

    const [rule] = enrichCleanupRules([other]);

    expect(rule).toEqual(other);
  });
});
