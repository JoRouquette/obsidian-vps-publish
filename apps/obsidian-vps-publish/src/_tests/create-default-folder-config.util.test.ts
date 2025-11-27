import {
  createDefaultFolderConfig,
  defaultSanitizationRules,
} from '../lib/utils/create-default-folder-config.util';

describe('createDefaultFolderConfig', () => {
  it('crée un dossier avec les règles de sanitization par défaut et le vpsId fourni', () => {
    const cfg = createDefaultFolderConfig('vps-123');

    expect(cfg.vpsId).toBe('vps-123');
    expect(cfg.sanitization?.[0].isEnabled).toBe(true);
    expect(cfg.sanitization?.[0].regex).toContain('```');
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
    expect(codeRule?.regex).toMatch(/```/);
  });
});
