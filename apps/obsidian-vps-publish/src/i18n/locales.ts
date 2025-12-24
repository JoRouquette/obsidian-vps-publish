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
  nameRequired: string;
  nameDuplicate: string;
  urlLabel: string;
  urlDescription: string;
  urlRequired: string;
  urlDuplicate: string;
  apiKeyLabel: string;
  apiKeyDescription: string;
  help: string;
  addButton: string;
  deleteButton: string;
  deleteLastForbidden: string;
  actionsTitle: string;
  actionsDescription: string;
  uploadButton: string;
  cleanupRulesTitle: string;
  cleanupRulesDescription: string;
  addCleanupRule: string;
  deleteCleanupRule: string;
  ruleNameLabel: string;
  rulePatternLabel: string;
  ruleReplacementLabel: string;
  ruleEnabledLabel: string;
  defaultRuleIndicator: string;
};

type CleanupRulesTranslations = {
  removeCodeBlocks: {
    name: string;
    description: string;
  };
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
  foldersLabel: string;
  sanitizationTitle: string;
  sanitizationHelp?: string;
  defaultSanitizationRuleBanner: string;
  addSanitizationRule: string;
  deleteSanitizationRule: string;
  ruleNameLabel: string;
  rulePatternLabel: string;
  ruleReplacementLabel: string;
  ruleEnabledLabel: string;
  ignoredCleanupRulesTitle: string;
  ignoredCleanupRulesDescription: string;
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
  rulesLabel: string;
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
  commandOpenHelp: string;
  publishSuccess: string;
  publishError: string;
  noConfig: string;
  error: ErrorTranslations;
  progress: {
    parseVault: {
      start: string;
      success: string;
      error: string;
    };
    uploadNotes: {
      start: string;
      success: string;
      error: string;
    };
    uploadAssets: {
      start: string;
      success: string;
      error: string;
      skip: string;
    };
    finalizeSession: {
      start: string;
      success: string;
      error: string;
    };
  };
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
  cleanupRules: CleanupRulesTranslations;
  ignoreRules: IgnoreRulesTranslations;
  testConnection: TestConnectionTranslations;
  vault: VaultTranslations;
  advanced: AdvancedTranslations;
};

export type HelpSection = {
  title: string;
  content: string;
  examples?: Array<{ code: string; description: string }>;
};

export type HelpTranslations = {
  title: string;
  introduction: string;
  sections: {
    publishing: HelpSection;
    noPublishing: HelpSection;
    frontmatter: HelpSection;
    wikilinks: HelpSection;
    assets: HelpSection;
    dataview: HelpSection;
    leaflet: HelpSection;
  };
  footer: {
    docsText: string;
    docsLinkText: string;
    docsLink?: string;
  };
  closeButton: string;
  settingsButtonLabel: string;
  settingsButtonDescription: string;
};

export type Translations = {
  plugin: PluginTranslations;
  settings: SettingsTranslations;
  help: HelpTranslations;
};

export const en: Translations = {
  plugin: {
    name: 'Publish to VPS',
    commandPublish: 'Launch publishing to VPS',
    commandTestConnection: 'Test VPS connection',
    commandOpenSettings: 'Open Publish to VPS Settings',
    commandOpenHelp: 'Open Help & Documentation',
    publishSuccess: 'Publishing completed.',
    publishError: 'Error during publishing (see console).',
    noConfig: 'No VPS or folder configuration defined.',
    error: {
      failureToExportSettings: 'Failed to export settings.',
    },
    progress: {
      parseVault: {
        start: 'Parsing vault content...',
        success: 'Vault parsed successfully',
        error: 'Failed to parse vault',
      },
      uploadNotes: {
        start: 'Uploading notes...',
        success: 'Notes uploaded successfully',
        error: 'Failed to upload notes',
      },
      uploadAssets: {
        start: 'Uploading assets...',
        success: 'Assets uploaded successfully',
        error: 'Failed to upload assets',
        skip: 'No assets to upload',
      },
      finalizeSession: {
        start: 'Finalizing publication...',
        success: 'Publication finalized',
        error: 'Failed to finalize publication',
      },
    },
  },
  settings: {
    tabTitle: 'Publish to VPS',
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
      deleteLastForbidden: 'At least one VPS is required',
      nameLabel: 'Name',
      nameDescription: 'Internal name for this VPS.',
      nameRequired: 'VPS name is required',
      nameDuplicate: 'VPS name already exists',
      urlLabel: 'URL',
      urlDescription: 'Example: https://notes.mydomain.com',
      urlRequired: 'VPS URL is required',
      urlDuplicate: 'VPS URL already exists',
      apiKeyLabel: 'API key',
      apiKeyDescription: 'Key used to authenticate uploads.',
      help: 'HTTP requests to /api/upload will use this URL and API key.',
      actionsTitle: 'Actions',
      actionsDescription: 'Test connection or upload to this VPS',
      uploadButton: 'Upload to this VPS',
      cleanupRulesTitle: 'Content Cleanup Rules',
      cleanupRulesDescription:
        'Rules applied to clean content before publishing. Folders can opt-out of specific rules.',
      addCleanupRule: 'Add cleanup rule',
      deleteCleanupRule: 'Delete rule',
      ruleNameLabel: 'Rule name',
      rulePatternLabel: 'Pattern (regex)',
      ruleReplacementLabel: 'Replacement',
      ruleEnabledLabel: 'Enabled',
      defaultRuleIndicator: 'Default rule (read-only)',
    },
    folders: {
      title: 'Folders to publish',
      addButton: 'Add folder',
      deleteButton: 'Delete folder',
      deleteLastForbidden: 'At least one folder is required per VPS.',
      vaultLabel: 'Vault folder',
      vaultDescription: 'Example: Blog, Notes/Docs, etc.',
      routeLabel: 'Site route',
      routeDescription: 'Example: /blog, /docs, etc.',
      rulesHelp: 'Notes whose frontmatter matches the ignore rules below will not be published.',
      vpsLabel: 'Target VPS',
      vpsDescription: 'Select which VPS configuration this folder publishes to.',
      foldersLabel: 'Folders',
      sanitizationTitle: 'Sanitization rules',
      sanitizationHelp: 'Define regex-based rules applied to note content before publishing.',
      defaultSanitizationRuleBanner: 'Default rule (uneditable)',
      addSanitizationRule: 'Add rule',
      deleteSanitizationRule: 'Delete rule',
      ruleNameLabel: 'Rule name',
      rulePatternLabel: 'Pattern (regex)',
      ruleReplacementLabel: 'Replacement',
      ruleEnabledLabel: 'Enabled',
      ignoredCleanupRulesTitle: 'Ignored Cleanup Rules',
      ignoredCleanupRulesDescription:
        'Select which VPS cleanup rules should NOT be applied to this folder',
    },
    cleanupRules: {
      removeCodeBlocks: {
        name: 'Remove fenced code blocks',
        description: 'Removes all code blocks (``` or ~~~) from the content before publishing',
      },
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
      rulesLabel: 'Ignore Rules',
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
  help: {
    title: 'Help & Documentation',
    introduction:
      'This plugin allows you to publish your Obsidian vault content to a self-hosted VPS. Here are the key features and syntax supported.',
    sections: {
      publishing: {
        title: 'Publishing Control',
        content:
          'By default, all notes in configured folders are published unless they match ignore rules.\n\nYou can control publication using frontmatter properties or inline markers.',
        examples: [
          {
            code: '---\npublish: false\n---',
            description: 'Excludes this note from publishing',
          },
          {
            code: '---\ndraft: true\n---',
            description: 'Marks note as draft (excluded if draft rule is configured)',
          },
        ],
      },
      noPublishing: {
        title: 'Section Exclusion with ^no-publishing',
        content:
          'You can exclude specific sections from publication using the ^no-publishing marker.\n\nWhen a line contains ^no-publishing, the plugin removes content up to the previous delimiter:\n1. Horizontal rule (---, ***, ___) if present (highest priority)\n2. Previous header (##, ###, etc.) if no horizontal rule\n3. Start of document if no delimiter found',
        examples: [
          {
            code: '## Public Header\nPublic content\n\n---\n\nPrivate content\n^no-publishing\n\n## Next Section',
            description: 'Only content between --- and marker is removed. Header is kept.',
          },
          {
            code: '## Private Header\nPrivate content\n^no-publishing\n\n## Public Section',
            description: 'Both header and content are removed (no horizontal rule present).',
          },
          {
            code: 'Public start\n\n***\n\nPrivate section\n^no-publishing',
            description: 'Horizontal rule with asterisks works too.',
          },
        ],
      },
      frontmatter: {
        title: 'Frontmatter Properties',
        content:
          'Frontmatter properties control note behavior and can be used for filtering.\n\nYou can configure which properties to exclude or use as ignore rules in settings.',
        examples: [
          {
            code: '---\ntitle: My Note\ntags: [blog, tech]\npublish: true\n---',
            description: 'Standard frontmatter with title, tags, and publish flag',
          },
          {
            code: '---\ntype: Dashboard\n---',
            description: 'Notes with type: Dashboard are excluded by default',
          },
        ],
      },
      wikilinks: {
        title: 'Wikilinks & Internal Links',
        content:
          'The plugin automatically resolves Obsidian wikilinks to proper URLs.\n\nSupported formats: [[Note]], [[Note|Display Text]], [[Note#Header]], [[Folder/Note]]',
        examples: [
          {
            code: 'See [[Other Note]] for details.',
            description: 'Simple wikilink → converted to proper link',
          },
          {
            code: 'Check [[Deep Concepts#Section|this section]]',
            description: 'Wikilink with header and custom text',
          },
        ],
      },
      assets: {
        title: 'Assets & Images',
        content:
          'Images and attachments are automatically detected and uploaded.\n\nSupported: ![[image.png]], ![alt](path/image.jpg), embedded PDFs, etc.\n\nAssets folder can be configured in settings.',
        examples: [
          {
            code: '![[screenshot.png]]',
            description: 'Obsidian-style image embed',
          },
          {
            code: '![diagram](assets/diagram.svg)',
            description: 'Markdown-style image with path',
          },
        ],
      },
      dataview: {
        title: 'Dataview Support',
        content:
          'Dataview queries are executed and rendered to HTML before publishing.\n\nSupported: inline queries (=this.property), dataview blocks, dataviewjs.',
        examples: [
          {
            code: '`= this.title`',
            description: 'Inline dataview query',
          },
          {
            code: '```dataview\nLIST FROM #tag\n```',
            description: 'Dataview block query',
          },
        ],
      },
      leaflet: {
        title: 'Leaflet Maps',
        content:
          'Leaflet code blocks are detected and preserved for client-side rendering.\n\nMaps will be interactive on the published site.',
        examples: [
          {
            code: '```leaflet\nid: map-1\nlat: 48.8566\nlong: 2.3522\n```',
            description: 'Leaflet map configuration',
          },
        ],
      },
    },
    footer: {
      docsText: 'For complete documentation, visit:',
      docsLinkText: 'GitHub Repository',
      docsLink: 'https://github.com/JoRouquette/obsidian-vps-publish',
    },
    closeButton: 'Close',
    settingsButtonLabel: 'Help & Documentation',
    settingsButtonDescription: 'Open help modal with syntax examples and documentation',
  },
};

export const fr: Translations = {
  plugin: {
    name: 'Publier vers mon VPS personnel',
    commandPublish: 'Publier vers mon VPS personnel',
    commandTestConnection: 'Tester la connexion VPS',
    commandOpenSettings: 'Ouvrir les parametres du plugin Publier vers mon VPS personnel',
    commandOpenHelp: "Ouvrir l'aide et la documentation",
    publishSuccess: 'Publication terminee.',
    publishError: 'Erreur lors de la publication (voir la console).',
    noConfig: 'Aucune configuration VPS ou dossier definie.',
    error: {
      failureToExportSettings: "Echec de l'exportation des parametres.",
    },
    progress: {
      parseVault: {
        start: 'Analyse du vault en cours...',
        success: 'Vault analyse avec succes',
        error: "Echec de l'analyse du vault",
      },
      uploadNotes: {
        start: 'Envoi des notes...',
        success: 'Notes envoyees avec succes',
        error: "Echec de l'envoi des notes",
      },
      uploadAssets: {
        start: 'Envoi des ressources...',
        success: 'Ressources envoyees avec succes',
        error: "Echec de l'envoi des ressources",
        skip: 'Aucune ressource a envoyer',
      },
      finalizeSession: {
        start: 'Finalisation de la publication...',
        success: 'Publication finalisee',
        error: 'Echec de la finalisation',
      },
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
      deleteLastForbidden: 'Au moins un VPS est requis',
      nameLabel: 'Nom',
      nameDescription: 'Nom interne pour ce VPS.',
      nameRequired: 'Le nom du VPS est requis',
      nameDuplicate: 'Ce nom de VPS existe déjà',
      urlLabel: 'URL',
      urlDescription: 'Ex : https://notes.mondomaine.fr',
      urlRequired: "L'URL du VPS est requise",
      urlDuplicate: 'Cette URL de VPS existe déjà',
      apiKeyLabel: 'Cle API',
      apiKeyDescription: 'Cle utilisee pour authentifier les envois.',
      help: 'Les requetes HTTP vers /api/upload utiliseront cette URL et cette cle.',
      actionsTitle: 'Actions',
      actionsDescription: 'Tester la connexion ou uploader vers ce VPS',
      uploadButton: 'Uploader vers ce VPS',
      cleanupRulesTitle: 'Règles de Nettoyage de Contenu',
      cleanupRulesDescription:
        'Règles appliquées pour nettoyer le contenu avant publication. Les dossiers peuvent ignorer certaines règles.',
      addCleanupRule: 'Ajouter une règle de nettoyage',
      deleteCleanupRule: 'Supprimer la règle',
      ruleNameLabel: 'Nom de la règle',
      rulePatternLabel: 'Motif (regex)',
      ruleReplacementLabel: 'Remplacement',
      ruleEnabledLabel: 'Activé',
      defaultRuleIndicator: 'Règle par défaut (lecture seule)',
    },
    folders: {
      title: 'Dossiers a publier',
      addButton: 'Ajouter un dossier',
      deleteButton: 'Supprimer le dossier',
      deleteLastForbidden: 'Au moins un dossier est requis par VPS.',
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
      foldersLabel: 'Dossiers',
      ignoredCleanupRulesTitle: 'Règles de Nettoyage Ignorées',
      ignoredCleanupRulesDescription:
        'Sélectionnez les règles de nettoyage du VPS qui ne doivent PAS être appliquées à ce dossier',
    },
    cleanupRules: {
      removeCodeBlocks: {
        name: 'Supprimer les blocs de code',
        description: 'Supprime tous les blocs de code (``` ou ~~~) du contenu avant publication',
      },
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
      rulesLabel: "Règles d'Ignorance",
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
  help: {
    title: 'Aide & Documentation',
    introduction:
      'Ce plugin permet de publier le contenu de votre coffre Obsidian vers un VPS auto-hébergé. Voici les fonctionnalités principales et syntaxes supportées.',
    sections: {
      publishing: {
        title: 'Contrôle de Publication',
        content:
          "Par défaut, toutes les notes des dossiers configurés sont publiées sauf si elles correspondent aux règles d'exclusion.\n\nVous pouvez contrôler la publication avec des propriétés frontmatter ou des marqueurs inline.",
        examples: [
          {
            code: '---\npublish: false\n---',
            description: 'Exclut cette note de la publication',
          },
          {
            code: '---\ndraft: true\n---',
            description: 'Marque la note comme brouillon (exclue si règle draft configurée)',
          },
        ],
      },
      noPublishing: {
        title: 'Exclusion de Sections avec ^no-publishing',
        content:
          "Vous pouvez exclure des sections spécifiques de la publication avec le marqueur ^no-publishing.\n\nQuand une ligne contient ^no-publishing, le plugin supprime le contenu jusqu'au délimiteur précédent :\n1. Ligne horizontale (---, ***, ___) si présente (priorité maximale)\n2. En-tête précédent (##, ###, etc.) si pas de ligne horizontale\n3. Début du document si aucun délimiteur trouvé",
        examples: [
          {
            code: '## En-tête Public\nContenu public\n\n---\n\nContenu privé\n^no-publishing\n\n## Section Suivante',
            description:
              "Seul le contenu entre --- et le marqueur est supprimé. L'en-tête est conservé.",
          },
          {
            code: '## En-tête Privé\nContenu privé\n^no-publishing\n\n## Section Publique',
            description: "L'en-tête ET le contenu sont supprimés (pas de ligne horizontale).",
          },
          {
            code: 'Début public\n\n***\n\nSection privée\n^no-publishing',
            description: 'Ligne horizontale avec astérisques fonctionne aussi.',
          },
        ],
      },
      frontmatter: {
        title: 'Propriétés Frontmatter',
        content:
          "Les propriétés frontmatter contrôlent le comportement des notes et peuvent être utilisées pour le filtrage.\n\nVous pouvez configurer quelles propriétés exclure ou utiliser comme règles d'ignorance dans les paramètres.",
        examples: [
          {
            code: '---\ntitle: Ma Note\ntags: [blog, tech]\npublish: true\n---',
            description: 'Frontmatter standard avec titre, tags et flag de publication',
          },
          {
            code: '---\ntype: Dashboard\n---',
            description: 'Les notes avec type: Dashboard sont exclues par défaut',
          },
        ],
      },
      wikilinks: {
        title: 'Wikilinks & Liens Internes',
        content:
          'Le plugin résout automatiquement les wikilinks Obsidian en URLs appropriées.\n\nFormats supportés : [[Note]], [[Note|Texte Affiché]], [[Note#En-tête]], [[Dossier/Note]]',
        examples: [
          {
            code: 'Voir [[Autre Note]] pour plus de détails.',
            description: 'Wikilink simple → converti en lien approprié',
          },
          {
            code: 'Consultez [[Concepts Profonds#Section|cette section]]',
            description: 'Wikilink avec en-tête et texte personnalisé',
          },
        ],
      },
      assets: {
        title: 'Assets & Images',
        content:
          'Les images et pièces jointes sont automatiquement détectées et envoyées.\n\nSupporté : ![[image.png]], ![alt](chemin/image.jpg), PDFs embarqués, etc.\n\nLe dossier assets peut être configuré dans les paramètres.',
        examples: [
          {
            code: '![[capture.png]]',
            description: "Embed d'image style Obsidian",
          },
          {
            code: '![diagramme](assets/diagramme.svg)',
            description: 'Image style Markdown avec chemin',
          },
        ],
      },
      dataview: {
        title: 'Support Dataview',
        content:
          'Les requêtes Dataview sont exécutées et rendues en HTML avant publication.\n\nSupporté : requêtes inline (=this.property), blocs dataview, dataviewjs.',
        examples: [
          {
            code: '`= this.title`',
            description: 'Requête dataview inline',
          },
          {
            code: '```dataview\nLIST FROM #tag\n```',
            description: 'Bloc de requête dataview',
          },
        ],
      },
      leaflet: {
        title: 'Cartes Leaflet',
        content:
          'Les blocs de code Leaflet sont détectés et préservés pour le rendu côté client.\n\nLes cartes seront interactives sur le site publié.',
        examples: [
          {
            code: '```leaflet\nid: carte-1\nlat: 48.8566\nlong: 2.3522\n```',
            description: 'Configuration de carte Leaflet',
          },
        ],
      },
    },
    footer: {
      docsText: 'Pour la documentation complète, visitez :',
      docsLinkText: 'Dépôt GitHub',
      docsLink: 'https://github.com/JoRouquette/obsidian-vps-publish',
    },
    closeButton: 'Fermer',
    settingsButtonLabel: 'Aide & Documentation',
    settingsButtonDescription: "Ouvrir la fenêtre d'aide avec exemples de syntaxe et documentation",
  },
};
