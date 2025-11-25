export type Locale = 'en' | 'fr';

type ErrorTranslations = {
  failureToExportSettings: string;
};

type IgnoreRulesDefaults = {
  publishingProperty: string;
  nonPublishingValue: string;
  draftProperty?: string;
  draftValue?: string;
  typeProperty: string;
  typeValue: string;
};

type LanguageTranslations = {
  title: string;
  label: string;
  description: string;
};

type VpsTranslations = {
  title: string;
  nameLabel: string;
  nameDescription: string;
  urlLabel: string;
  urlDescription: string;
  apiKeyLabel: string;
  apiKeyDescription: string;
  help: string;
};

type FoldersTranslations = {
  title: string;
  addButton: string;
  deleteButton: string;
  deleteLastForbidden: string;
  vaultLabel: string;
  vaultDescription: string;
  routeLabel: string;
  routeDescription: string;
  sanitizeRemoveCodeBlocksLabel: string;
  sanitizeRemoveCodeBlocksDescription: string;
  rulesHelp: string;
};

type IgnoreRulesTranslations = {
  title: string;
  description?: string;
  help: string;
  addButton: string;
  deleteButton: string;
  propertyLabel: string;
  propertyDescription: string;
  valueLabel: string;
  valueDescription: string;
  modeValues: string;
  modeBoolean: string;
};

type TestConnectionTranslations = {
  label: string;
  notImplemented: string;
  failed: string;
  success: string;
  invalidConfig: string;
  invalidJson: string;
  missingApiKey: string;
  invalidUrl: string;
  resultPrefix: string;
  unexpectedResponsePrefix: string;
};

export type PluginTranslations = {
  name: string;
  commandPublish: string;
  commandTestConnection: string;
  commandOpenSettings: string;
  publishSuccess: string;
  publishError: string;
  noConfig: string;
  error: ErrorTranslations;
};

export type VaultTranslations = {
  title: string;
  help: string;
  assetsFolderLabel: string;
  assetsFolderDescription: string;
  enableAssetsVaultFallbackLabel: string;
  enableAssetsVaultFallbackDescription: string;
};

export type SettingsTranslations = {
  tabTitle: string;
  errors: {
    missingVpsConfig: string;
  };
  defaults: {
    ignoreRules: IgnoreRulesDefaults;
  };
  language: LanguageTranslations;
  vps: VpsTranslations;
  folders: FoldersTranslations;
  ignoreRules: IgnoreRulesTranslations;
  testConnection: TestConnectionTranslations;
  vault: VaultTranslations;
};

export type Translations = {
  plugin: PluginTranslations;
  settings: SettingsTranslations;
};

export const en: Translations = {
  plugin: {
    name: 'Publish To Personal VPS',
    commandPublish: 'Launch publishing to Personal VPS',
    commandTestConnection: 'Test VPS connection',
    commandOpenSettings: 'Open Publish To Personal VPS Settings',
    publishSuccess: 'Publishing completed.',
    publishError: 'Error during publishing (see console).',
    noConfig: 'No VPS or folder configuration defined.',
    error: {
      failureToExportSettings: 'Failed to export settings.',
    },
  },
  settings: {
    tabTitle: 'Publish To Personal VPS',
    errors: {
      missingVpsConfig: 'VPS configuration not found for folder: ',
    },
    defaults: {
      ignoreRules: {
        publishingProperty: 'publish',
        nonPublishingValue: 'false',
        draftProperty: 'draft',
        draftValue: 'true',
        typeProperty: 'type',
        typeValue: 'Dashboard',
      },
    },
    language: {
      title: 'Language selection',
      label: 'Language',
      description: 'Choose plugin language.',
    },
    vps: {
      title: 'VPS configuration',
      nameLabel: 'Name',
      nameDescription: 'Internal name for this VPS.',
      urlLabel: 'URL',
      urlDescription: 'Example: https://notes.mydomain.com',
      apiKeyLabel: 'API key',
      apiKeyDescription: 'Key used to authenticate uploads.',
      help: 'HTTP requests to /api/upload will use this URL and API key.',
    },
    folders: {
      title: 'Folders to publish',
      addButton: 'Add folder',
      deleteButton: 'Delete folder',
      deleteLastForbidden: 'At least one folder is required.',
      vaultLabel: 'Vault folder',
      vaultDescription: 'Example: Blog, Notes/Docs, etc.',
      routeLabel: 'Site route',
      routeDescription: 'Example: /blog, /docs, etc.',
      sanitizeRemoveCodeBlocksLabel: 'Remove fenced code blocks',
      sanitizeRemoveCodeBlocksDescription:
        'If enabled, fenced code blocks (``` or ~~~) will be removed from the content before publishing.',
      rulesHelp:
        'Notes whose frontmatter matches the ignore rules below will not be published.',
    },
    ignoreRules: {
      title: 'Ignore rules',
      description:
        'Notes with these frontmatter properties will be ignored during publishing.',
      help: 'You can define global rules based on frontmatter properties and values.',
      addButton: 'Add ignore rule',
      deleteButton: 'Delete ignore rule',
      propertyLabel: 'Frontmatter property',
      propertyDescription: 'Property to inspect in the frontmatter.',
      valueLabel: 'Value(s) to ignore',
      valueDescription:
        'Comma-separated list of values to ignore for this property.',
      modeValues: 'Ignore specific values',
      modeBoolean: 'Ignore if equal (true/false)',
    },
    testConnection: {
      label: 'Test connection',
      notImplemented: 'Connection test not implemented yet.',
      failed: 'Connection test failed.',
      success: 'Connection test succeeded.',
      invalidConfig: 'Invalid VPS configuration.',
      invalidJson: 'Invalid JSON response.',
      missingApiKey: 'Missing API key.',
      invalidUrl: 'Invalid URL.',
      resultPrefix: 'Test connection result: ',
      unexpectedResponsePrefix: 'Unexpected response from server: ',
    },
    vault: {
      title: 'Vault & assets',
      help: 'Global settings related to the vault: assets folder and fallback.',
      assetsFolderLabel: 'Assets folder in vault',
      assetsFolderDescription:
        'Folder in the vault where assets (images, files) are located. Example: Assets, Media, etc.',
      enableAssetsVaultFallbackLabel: 'Allow system to fallback on vault root',
      enableAssetsVaultFallbackDescription:
        'If enabled, when an asset is not found in the specified folder, the system will look for it in the vault root and in all folders.',
    },
  },
};

export const fr: Translations = {
  plugin: {
    name: 'Publier vers mon VPS personnel',
    commandPublish: 'Publier vers mon VPS personnel',
    commandTestConnection: 'Tester la connexion VPS',
    commandOpenSettings:
      'Ouvrir les paramètres du plugin Publier vers mon VPS personnel',
    publishSuccess: 'Publication terminée.',
    publishError: 'Erreur lors de la publication (voir la console).',
    noConfig: 'Aucune configuration VPS ou dossier définie.',
    error: {
      failureToExportSettings: 'Échec de l’exportation des paramètres.',
    },
  },
  settings: {
    tabTitle: 'Publier vers mon VPS personnel',
    errors: {
      missingVpsConfig: 'Configuration VPS introuvable pour le dossier : ',
    },
    defaults: {
      ignoreRules: {
        publishingProperty: 'publish',
        nonPublishingValue: 'false',
        draftProperty: 'brouillon',
        draftValue: 'true',
        typeProperty: 'type',
        typeValue: 'Dashboard',
      },
    },
    language: {
      title: 'Sélection de la langue',
      label: 'Langue',
      description: 'Choisir la langue du plugin.',
    },
    vps: {
      title: 'Configuration du VPS',
      nameLabel: 'Nom',
      nameDescription: 'Nom interne pour ce VPS.',
      urlLabel: 'URL',
      urlDescription: 'Ex : https://notes.mondomaine.fr',
      apiKeyLabel: 'Clé API',
      apiKeyDescription: 'Clé utilisée pour authentifier les envois.',
      help: 'Les requêtes HTTP vers /api/upload utiliseront cette URL et cette clé.',
    },
    folders: {
      title: 'Dossiers à publier',
      addButton: 'Ajouter un dossier',
      deleteButton: 'Supprimer le dossier',
      deleteLastForbidden: 'Au moins un dossier est requis.',
      vaultLabel: 'Dossier du vault',
      vaultDescription: 'Ex : Blog, Notes/Docs, etc.',
      routeLabel: 'Route du site',
      routeDescription: 'Ex : /blog, /docs, etc.',
      sanitizeRemoveCodeBlocksLabel: 'Supprimer les blocs de code délimités',
      sanitizeRemoveCodeBlocksDescription:
        'Si activé, les blocs de code délimités (``` ou ~~~) seront supprimés du contenu avant publication.',
      rulesHelp:
        'Les notes dont le frontmatter correspond aux règles ci-dessous ne seront pas publiées.',
    },
    ignoreRules: {
      title: 'Règles d’ignorance',
      description:
        'Les notes avec ces propriétés de frontmatter seront ignorées lors de la publication.',
      help: 'Vous pouvez définir des règles globales basées sur les propriétés et valeurs du frontmatter.',
      addButton: "Ajouter une règle d'ignorance",
      deleteButton: "Supprimer la règle d'ignorance",
      propertyLabel: 'Propriété du frontmatter',
      propertyDescription: 'Propriété à inspecter dans le frontmatter.',
      valueLabel: 'Valeur(s) à ignorer',
      valueDescription:
        'Liste de valeurs à ignorer pour cette propriété (séparées par des virgules).',
      modeValues: 'Ignorer des valeurs spécifiques',
      modeBoolean: 'Ignorer si égal (true/false)',
    },
    testConnection: {
      label: 'Tester la connexion',
      notImplemented: 'Test de connexion non implémenté pour l’instant.',
      failed: 'Échec du test de connexion.',
      success: 'Test de connexion réussi.',
      invalidConfig: 'Configuration VPS invalide.',
      invalidJson: 'Réponse JSON invalide.',
      missingApiKey: 'Clé API manquante.',
      invalidUrl: 'URL invalide.',
      resultPrefix: 'Résultat du test de connexion : ',
      unexpectedResponsePrefix: 'Réponse inattendue du serveur : ',
    },
    vault: {
      title: 'Vault & assets',
      help: 'Réglages globaux liés au vault : dossier d’assets et fallback.',
      assetsFolderLabel: 'Dossier d’assets dans le vault',
      assetsFolderDescription:
        'Dossier dans le vault où les assets (images, fichiers) sont situés. Ex : Assets, Media, etc.',
      enableAssetsVaultFallbackLabel:
        'Permettre le recours à la racine du vault',
      enableAssetsVaultFallbackDescription:
        'Si activé, lorsqu’un asset n’est pas trouvé dans le dossier spécifié, le système le cherchera à la racine du vault et dans tous les dossiers.',
    },
  },
};
