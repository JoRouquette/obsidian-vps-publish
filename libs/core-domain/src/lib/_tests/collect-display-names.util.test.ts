import { collectDisplayNamesFromRouteTree, type RouteTreeConfig } from '@core-domain';

describe('collectDisplayNamesFromRouteTree', () => {
  it('should collect displayNames from all nodes including those without vaultFolder', () => {
    const routeTree: RouteTreeConfig = {
      roots: [
        {
          id: 'route-tresors',
          segment: 'tresors',
          displayName: 'Trésors',
          children: [
            {
              id: 'route-objets-magiques',
              segment: 'objets-magiques',
              vaultFolder: '_Trésors/Objets Magiques',
              ignoredCleanupRuleIds: [],
            },
            {
              id: 'route-communs',
              segment: 'communs',
              vaultFolder: '_Trésors/Trésors communs',
              flattenTree: true,
              ignoredCleanupRuleIds: [],
            },
          ],
          ignoredCleanupRuleIds: [],
        },
        {
          id: 'route-pantheon',
          segment: 'pantheon',
          displayName: 'Panthéon',
          vaultFolder: '_Codex/Puissances/Divinités',
          ignoredCleanupRuleIds: [],
        },
      ],
    };

    const result = collectDisplayNamesFromRouteTree(routeTree);

    expect(result).toEqual({
      '/tresors': 'Trésors',
      '/pantheon': 'Panthéon',
    });
  });

  it('should handle root route with empty segment', () => {
    const routeTree: RouteTreeConfig = {
      roots: [
        {
          id: 'route-root',
          segment: '',
          displayName: 'Accueil',
          customIndexFile: 'Ektaron/Glossaire.md',
          ignoredCleanupRuleIds: [],
        },
        {
          id: 'route-lore',
          segment: 'lore',
          displayName: 'Encyclopédie',
          ignoredCleanupRuleIds: [],
          children: [
            {
              id: 'route-classes',
              segment: 'classes',
              vaultFolder: '_Codex/Classes',
              ignoredCleanupRuleIds: [],
            },
          ],
        },
      ],
    };

    const result = collectDisplayNamesFromRouteTree(routeTree);

    expect(result).toEqual({
      '/': 'Accueil',
      '/lore': 'Encyclopédie',
    });
  });

  it('should handle nested routes with displayNames', () => {
    const routeTree: RouteTreeConfig = {
      roots: [
        {
          id: 'route-ektaron',
          segment: 'ektaron',
          vaultFolder: 'Ektaron',
          ignoredCleanupRuleIds: [],
          children: [
            {
              id: 'route-anorin',
              segment: 'anorin-sirdalea',
              displayName: 'Anorin Sírdalëa',
              vaultFolder: 'Anorin Sírdalëa',
              ignoredCleanupRuleIds: [],
            },
            {
              id: 'route-aran-talas',
              segment: 'aran-talas',
              displayName: "Aran'talas",
              vaultFolder: "Aran'talas",
              ignoredCleanupRuleIds: [],
            },
          ],
        },
      ],
    };

    const result = collectDisplayNamesFromRouteTree(routeTree);

    expect(result).toEqual({
      '/ektaron/anorin-sirdalea': 'Anorin Sírdalëa',
      '/ektaron/aran-talas': "Aran'talas",
    });
  });

  it('should not create double slashes for children of root route', () => {
    const routeTree: RouteTreeConfig = {
      roots: [
        {
          id: 'route-root',
          segment: '',
          customIndexFile: 'Index.md',
          ignoredCleanupRuleIds: [],
          children: [
            {
              id: 'route-child',
              segment: 'child',
              displayName: 'Enfant',
              ignoredCleanupRuleIds: [],
            },
          ],
        },
      ],
    };

    const result = collectDisplayNamesFromRouteTree(routeTree);

    // Should be '/child', NOT '//child'
    expect(result).toEqual({
      '/child': 'Enfant',
    });
  });
});
