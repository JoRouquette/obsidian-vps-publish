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
  addButton: string;
  deleteButton: string;
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
  rulesHelp: string;
  vpsLabel: string;
  vpsDescription: string;
  sanitizationTitle: string;
  sanitizationHelp?: string;
  defaultSanitizationRuleBanner: string;
  addSanitizationRule: string;
  deleteSanitizationRule: string;
  ruleNameLabel: string;
  rulePatternLabel: string;
  ruleReplacementLabel: string;
  ruleEnabledLabel: string;
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
  frontmatterKeysLabel: string;
  frontmatterKeysDescription: string;
  frontmatterKeysPlaceholder: string;
  tagsLabel: string;
  tagsDescription: string;
  tagsPlaceholder: string;
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

export type AdvancedTranslations = {
  title: string;
  logLevelLabel: string;
  logLevelDescription: string;
  logLevelDebug: string;
  logLevelInfo: string;
  logLevelWarn: string;
  logLevelError: string;
  calloutStylesLabel: string;
  calloutStylesDescription: string;
  calloutStylesPlaceholder: string;
  cleanup: {
    title: string;
    description: string;
    button: string;
    targetLabel: string;
    confirmTitle: string;
    confirmDescription: string;
    confirmCta: string;
    secondTitle: string;
    secondDescription: string;
    secondPlaceholder: string;
    secondCta: string;
    cancel: string;
    nameMismatch: string;
    missingVps: string;
    missingName: string;
    success: string;
    error: string;
  };
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
  advanced: AdvancedTranslations;
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
      addButton: 'Add VPS',
      deleteButton: 'Delete VPS',
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
      rulesHelp: 'Notes whose frontmatter matches the ignore rules below will not be published.',
      vpsLabel: 'Target VPS',
      vpsDescription: 'Select which VPS configuration this folder publishes to.',
      sanitizationTitle: 'Sanitization rules',
      sanitizationHelp: 'Define regex-based rules applied to note content before publishing.',
      defaultSanitizationRuleBanner: 'Default rule (uneditable)',
      addSanitizationRule: 'Add rule',
      deleteSanitizationRule: 'Delete rule',
      ruleNameLabel: 'Rule name',
      rulePatternLabel: 'Pattern (regex)',
      ruleReplacementLabel: 'Replacement',
      ruleEnabledLabel: 'Enabled',
    },
    ignoreRules: {
      title: 'Ignore rules',
      description: 'Notes with these frontmatter properties will be ignored during publishing.',
      help: 'You can define global rules based on frontmatter properties and values.',
      addButton: 'Add ignore rule',
      deleteButton: 'Delete ignore rule',
      propertyLabel: 'Frontmatter property',
      propertyDescription: 'Property to inspect in the frontmatter.',
      valueLabel: 'Value(s) to ignore',
      valueDescription: 'Comma-separated list of values to ignore for this property.',
      modeValues: 'Ignore specific values',
      modeBoolean: 'Ignore if equal (true/false)',
      frontmatterKeysLabel: 'Frontmatter keys to strip',
      frontmatterKeysDescription:
        'These frontmatter properties will be removed from notes before publishing.',
      frontmatterKeysPlaceholder: 'e.g. publish, draft, private',
      tagsLabel: 'Tags to exclude',
      tagsDescription: 'These tags will be removed from notes before publishing.',
      tagsPlaceholder: 'e.g. draft, private, internal',
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
    advanced: {
      title: 'Advanced settings',
      logLevelLabel: 'Log level',
      logLevelDescription: 'From debug (verbose) to warning (default). Applied immediately.',
      logLevelDebug: 'Debug (verbose)',
      logLevelInfo: 'Info',
      logLevelWarn: 'Warning (default)',
      logLevelError: 'Error only',
      calloutStylesLabel: 'Callout styles (CSS paths)',
      calloutStylesDescription:
        'Paths (one per line or comma separated) to CSS files in the vault. They will be uploaded, parsed and used to extend callout definitions on the server.',
      calloutStylesPlaceholder: '.obsidian/snippets/callouts.css',
      cleanup: {
        title: 'VPS cleanup',
        description:
          'Delete all published content and assets on the selected VPS. This cannot be undone.',
        button: 'Clean VPS',
        targetLabel: 'Target VPS',
        confirmTitle: 'Confirm VPS cleanup',
        confirmDescription:
          'This will permanently delete every page, manifest, search index and asset stored on the VPS. Visitors will see an empty site until you publish again. This action is irreversible.',
        confirmCta: 'I understand, continue',
        secondTitle: 'Type VPS name to confirm',
        secondDescription:
          'Type the VPS name "{name}" exactly (case sensitive). Copy/paste is disabled to ensure manual confirmation.',
        secondPlaceholder: 'Enter VPS name',
        secondCta: 'Confirm cleanup',
        cancel: 'Cancel',
        nameMismatch: 'The entered value does not match the VPS name.',
        missingVps: 'No VPS configuration available for cleanup.',
        missingName: 'Please set a VPS name before running a cleanup.',
        success: 'VPS content and assets have been deleted.',
        error: 'VPS cleanup failed.',
      },
    },
  },
};

export const fr: Translations = {
  plugin: {
    name: 'Publier vers mon VPS personnel',
    commandPublish: 'Publier vers mon VPS personnel',
    commandTestConnection: 'Tester la connexion VPS',
    commandOpenSettings: 'Ouvrir les parametres du plugin Publier vers mon VPS personnel',
    publishSuccess: 'Publication terminee.',
    publishError: 'Erreur lors de la publication (voir la console).',
    noConfig: 'Aucune configuration VPS ou dossier definie.',
    error: {
      failureToExportSettings: "Echec de l'exportation des parametres.",
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
      title: 'Selection de la langue',
      label: 'Langue',
      description: 'Choisir la langue du plugin.',
    },
    vps: {
      title: 'Configuration du VPS',
      addButton: 'Ajouter un VPS',
      deleteButton: 'Supprimer le VPS',
      nameLabel: 'Nom',
      nameDescription: 'Nom interne pour ce VPS.',
      urlLabel: 'URL',
      urlDescription: 'Ex : https://notes.mondomaine.fr',
      apiKeyLabel: 'Cle API',
      apiKeyDescription: 'Cle utilisee pour authentifier les envois.',
      help: 'Les requetes HTTP vers /api/upload utiliseront cette URL et cette cle.',
    },
    folders: {
      title: 'Dossiers a publier',
      addButton: 'Ajouter un dossier',
      deleteButton: 'Supprimer le dossier',
      deleteLastForbidden: 'Au moins un dossier est requis.',
      vaultLabel: 'Dossier du vault',
      vaultDescription: 'Ex : Blog, Notes/Docs, etc.',
      routeLabel: 'Route du site',
      routeDescription: 'Ex : /blog, /docs, etc.',
      sanitizationTitle: 'Regles de nettoyage',
      sanitizationHelp: 'Definissez des regles regex appliquees au contenu avant publication.',
      defaultSanitizationRuleBanner: 'Regle par defaut (non modifiable)',
      addSanitizationRule: 'Ajouter une regle',
      deleteSanitizationRule: 'Supprimer la regle',
      ruleNameLabel: 'Nom de la regle',
      rulePatternLabel: 'Motif (regex)',
      ruleReplacementLabel: 'Remplacement',
      ruleEnabledLabel: 'Activee',
      rulesHelp:
        'Les notes dont le frontmatter correspond aux regles ci-dessous ne seront pas publiees.',
      vpsLabel: 'VPS cible',
      vpsDescription: 'Choisissez la configuration VPS a utiliser pour ce dossier.',
    },
    ignoreRules: {
      title: "Regles d'ignorance",
      description:
        'Les notes avec ces proprietes de frontmatter seront ignorees lors de la publication.',
      help: 'Vous pouvez definir des regles globales basees sur les proprietes et valeurs du frontmatter.',
      addButton: "Ajouter une regle d'ignorance",
      deleteButton: "Supprimer la regle d'ignorance",
      propertyLabel: 'Propriete du frontmatter',
      propertyDescription: 'Propriete a inspecter dans le frontmatter.',
      valueLabel: 'Valeur(s) a ignorer',
      valueDescription:
        'Liste de valeurs a ignorer pour cette propriete (separees par des virgules).',
      modeValues: 'Ignorer des valeurs specifiques',
      modeBoolean: 'Ignorer si egal (true/false)',
      frontmatterKeysLabel: 'Cles de frontmatter a supprimer',
      frontmatterKeysDescription:
        'Ces proprietes de frontmatter seront retirees des notes avant publication.',
      frontmatterKeysPlaceholder: 'ex: publish, draft, private',
      tagsLabel: 'Tags a exclure',
      tagsDescription: 'Ces tags seront retires des notes avant publication.',
      tagsPlaceholder: 'ex: draft, private, internal',
    },
    testConnection: {
      label: 'Tester la connexion',
      notImplemented: "Test de connexion non implemente pour l'instant.",
      failed: 'Echec du test de connexion.',
      success: 'Test de connexion reussi.',
      invalidConfig: 'Configuration VPS invalide.',
      invalidJson: 'Reponse JSON invalide.',
      missingApiKey: 'Cle API manquante.',
      invalidUrl: 'URL invalide.',
      resultPrefix: 'Resultat du test de connexion : ',
      unexpectedResponsePrefix: 'Reponse inattendue du serveur : ',
    },
    vault: {
      title: 'Vault & assets',
      help: "Reglages globaux lies au vault : dossier d'assets et fallback.",
      assetsFolderLabel: "Dossier d'assets dans le vault",
      assetsFolderDescription:
        'Dossier dans le vault ou les assets (images, fichiers) sont situes. Ex : Assets, Media, etc.',
      enableAssetsVaultFallbackLabel: 'Permettre le recours a la racine du vault',
      enableAssetsVaultFallbackDescription:
        "Si active, lorsqu'un asset n'est pas trouve dans le dossier specifie, le systeme le cherchera a la racine du vault et dans tous les dossiers.",
    },
    advanced: {
      title: 'Parametres avances',
      logLevelLabel: 'Niveau de log',
      logLevelDescription: 'De debug (verbeux) a warning (par defaut). Applique immediatement.',
      logLevelDebug: 'Debug (tres verbeux)',
      logLevelInfo: 'Info',
      logLevelWarn: 'Warning (defaut)',
      logLevelError: 'Error uniquement',
      calloutStylesLabel: 'Styles de callouts (chemins CSS)',
      calloutStylesDescription:
        'Chemins (un par ligne ou separes par des virgules) vers des fichiers CSS du vault. Ils seront envoyes, parses et utilises pour etendre la configuration des callouts cote serveur.',
      calloutStylesPlaceholder: '.obsidian/snippets/callouts.css',
      cleanup: {
        title: 'Nettoyage du VPS',
        description:
          'Supprime tout le contenu publie et les assets du VPS cible. Operation irreversible.',
        button: 'Nettoyer le VPS',
        targetLabel: 'VPS cible',
        confirmTitle: 'Confirmer le nettoyage',
        confirmDescription:
          'Cette action va supprimer definitivement toutes les pages, manifests, index de recherche et assets stockes sur ce VPS. Les visiteurs verront un site vide tant que vous ne republiez pas. Action irreversible.',
        confirmCta: 'Je comprends, continuer',
        secondTitle: 'Validation finale',
        secondDescription:
          'Saisissez le nom du VPS "{name}" exactement (respect de la casse). Le copier/coller est desactive pour forcer la saisie manuelle.',
        secondPlaceholder: 'Nom exact du VPS',
        secondCta: 'Confirmer le nettoyage',
        cancel: 'Annuler',
        nameMismatch: 'La saisie ne correspond pas au nom du VPS cible.',
        missingVps: 'Aucun VPS configure pour lancer un nettoyage.',
        missingName: 'Veuillez definir un nom pour ce VPS avant de lancer le nettoyage.',
        success: 'Contenus et assets supprimes du VPS.',
        error: 'Echec du nettoyage du VPS.',
      },
    },
  },
};
