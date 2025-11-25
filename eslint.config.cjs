// eslint.config.cjs (racine)

const nxPlugin = require('@nx/eslint-plugin');

module.exports = [
  // Ignorer la merde générée
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },

  // Règles globales Nx (architecture)
  {
    plugins: {
      '@nx': nxPlugin,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            // Le domaine ne dépend que du domaine
            {
              sourceTag: 'layer:domain',
              onlyDependOnLibsWithTags: ['layer:domain'],
            },
            // L'application dépend de domaine + application
            {
              sourceTag: 'layer:application',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:application'],
            },
            // L'infra (backend) dépend de tout ce qui est en dessous + infra
            {
              sourceTag: 'layer:infra',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:application', 'layer:infra'],
            },
            // Le front (UI) dépend de tout ce qui est en dessous + ui
            {
              sourceTag: 'layer:ui',
              onlyDependOnLibsWithTags: ['layer:domain', 'layer:application', 'layer:ui'],
            },
          ],
        },
      ],
    },
  },
];
