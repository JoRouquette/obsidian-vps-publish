import { type LegacyVpsConfig, migrateLegacyVpsConfig } from '../../entities/route-node-migration';
import { validateRouteTree } from '../../entities/route-node-validation';

// The migration builds trees that pass the validation for every input reachable through saved
// settings, so the refusal of an invalid tree is exercised through the validation seam.
jest.mock('../../entities/route-node-validation', () => ({
  validateRouteTree: jest.fn(),
}));

const mockedValidate = jest.mocked(validateRouteTree);

function createSavedLegacyVps(): LegacyVpsConfig {
  return {
    id: 'vps-1',
    name: 'Legacy VPS',
    baseUrl: 'https://example.com',
    apiKey: 'enc:key',
    ignoreRules: [],
    cleanupRules: [],
    folders: [
      {
        id: 'folder-blog',
        vpsId: 'vps-1',
        vaultFolder: 'Blog',
        routeBase: '/blog',
        ignoredCleanupRuleIds: [],
      },
    ],
    customIndexes: [{ id: 'idx-1', folderPath: '/blog', indexFilePath: 'indexes/blog.md' }],
  };
}

describe('migrateLegacyVpsConfig with an invalid migrated tree', () => {
  beforeEach(() => {
    mockedValidate.mockReset();
  });

  it('does not adopt the tree and returns the VPS unchanged, legacy fields included', () => {
    mockedValidate.mockReturnValue({
      valid: false,
      conflicts: [
        {
          type: 'duplicate-path',
          message: 'Duplicate path "/blog"',
          conflictingNodes: [],
          path: '/blog',
        },
      ],
    });
    const warnings: string[] = [];
    const legacy = createSavedLegacyVps();

    const { vps, migrated } = migrateLegacyVpsConfig(legacy, (message) => warnings.push(message));

    expect(migrated).toBe(false);
    expect(vps).toBe(legacy);
    expect((vps as LegacyVpsConfig).folders).toHaveLength(1);
    expect(vps.routeTree).toBeUndefined();
    expect(warnings).toEqual([
      'Legacy folders not migrated, the resulting routes are invalid: Duplicate path "/blog"',
    ]);
  });

  it('adopts the tree when the validation passes', () => {
    mockedValidate.mockReturnValue({ valid: true, conflicts: [] });

    const { vps, migrated } = migrateLegacyVpsConfig(createSavedLegacyVps());

    expect(migrated).toBe(true);
    expect(vps.routeTree?.roots).toHaveLength(1);
    expect(mockedValidate).toHaveBeenCalledTimes(1);
    expect(mockedValidate).toHaveBeenCalledWith({
      roots: [expect.objectContaining({ segment: 'blog', vaultFolder: 'Blog' })],
    });
  });
});
