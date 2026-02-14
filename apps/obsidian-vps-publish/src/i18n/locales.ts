export type Locale = 'en' | 'fr';

type ErrorTranslations = {
  failureToExportSettings: string;
};

type NoticeTranslations = {
  noFoldersConfigured: string;
  noPublishableNotes: string;
  publishing: string;
  publishingCompleted: string;
  publishingFailed: string;
  publishingFailedWithError: string;
  publishingCancelled: string;
  analyzingVault: string;
  uploadingNotesBatches: string;
  uploadingAssetsBatches: string;
  dataviewNotDetected: string;
  completedIn: string;
  debugModeHint: string;
  keepFocusWarning: string;
};

type PublishingStatsTranslations = {
  summary: string;
  separator: string;
  contentPublished: string;
  notes: string;
  errors: string;
  assets: string;
  assetErrors: string;
  notesPublished: string;
  notesIgnored: string;
  completedInSeconds: string;
  completedInMinutes: string;
  notesBatch: string;
  assetsBatch: string;
};

type CommonTranslations = {
  ok: string;
  cancel: string;
  yes: string;
  no: string;
  continue: string;
  confirm: string;
  delete: string;
  add: string;
  enabled: string;
  disabled: string;
  initializing: string;
  processing: string;
  vpsNumberFallback: string; // "VPS #{number}"
  save: string;
  saved: string;
  cancelled: string;
};

type PlaceholdersTranslations = {
  selectVps: string;
  vpsName: string;
  vpsUrl: string;
  apiKey: string;
  vaultFolder: string;
  routePath: string;
  assetsFolder: string;
  regexPattern: string;
  customIndexFile: string;
  frontmatterProperty: string;
  tagsList: string;
  enterVpsName: string;
  calloutStylesPaths: string;
};

type SessionErrorsTranslations = {
  startFailed: string;
  uploadNotesFailed: string;
  uploadAssetsFailed: string;
  finishFailed: string;
  abortFailed: string;
  cleanupFailed: string;
  missingApiKey: string;
  invalidUrl: string;
  missingVpsConfig: string;
  missingVpsName: string;
  confirmationMismatch: string;
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
  ruleEnabledTooltip: string;
  defaultRuleIndicator: string;
  customRootIndexLabel: string;
  customRootIndexDescription: string;
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
  cleanupIgnoredTooltip: string;
  cleanupAppliedTooltip: string;
  customIndexLabel: string;
  customIndexDescription: string;
  flattenTreeLabel: string;
  flattenTreeDescription: string;
  additionalFilesLabel: string;
  additionalFilesDescription: string;
  additionalFilesEmpty: string;
  addAdditionalFileLabel: string;
  addAdditionalFileButton: string;
  addAdditionalFilePlaceholder: string;
  additionalFileDuplicate: string;
  // Enhanced UI translations
  searchPlaceholder: string;
  sortLabel: string;
  resetTooltip: string;
  noResults: string;
  resultCount: string;
  editButton: string;
  closeEditor: string;
  editingLabel: string;
  emptyFolderLabel: string;
  routePrefix: string;
  flattenedIndicator: string;
  customIndexIndicator: string;
  exceptionsIndicator: string;
  warningFlattenTree: string;
  advancedOptionsLabel: string;
  // Sort options
  sortFolderAsc: string;
  sortFolderDesc: string;
  sortRouteAsc: string;
  sortRouteDesc: string;
  sortCustomIndexDesc: string;
  sortFlattenedDesc: string;
  sortExceptionsDesc: string;
};

type RoutesTranslations = {
  addRootRoute: string;
  addChildRoute: string;
  editRoute: string;
  deleteRoute: string;
  deleteLastForbidden: string;
  routeConfiguration: string;
  segmentLabel: string;
  segmentDescription: string;
  displayNameLabel: string;
  displayNameDescription: string;
  displayNamePlaceholder: string;
  cannotMoveParentToChild: string;
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
  failedWithError: string;
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
  commandCancelPublish: string;
  commandTestConnection: string;
  commandOpenSettings: string;
  commandOpenHelp: string;
  commandInsertNoPublishing: string;
  publishSuccess: string;
  publishError: string;
  noConfig: string;
  error: ErrorTranslations;
  progress: {
    parseVault: {
      label: string;
      start: string;
      success: string;
      error: string;
    };
    uploadNotes: {
      label: string;
      start: string;
      success: string;
      error: string;
    };
    uploadAssets: {
      label: string;
      start: string;
      success: string;
      error: string;
      skip: string;
    };
    finalizeSession: {
      label: string;
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
    validationFailed: string;
  };
  defaults: {
    ignoreRules: IgnoreRulesDefaults;
  };
  language: LanguageTranslations;
  vps: VpsTranslations;
  folders: FoldersTranslations;
  routes: RoutesTranslations;
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
    markdown: HelpSection;
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
  notice: NoticeTranslations;
  publishingStats: PublishingStatsTranslations;
  common: CommonTranslations;
  placeholders: PlaceholdersTranslations;
  sessionErrors: SessionErrorsTranslations;
};

export const en: Translations = {
  plugin: {
    name: 'Publish to VPS',
    commandPublish: 'Launch publishing to VPS',
    commandCancelPublish: 'Cancel ongoing publishing',
    commandTestConnection: 'Test VPS connection',
    commandOpenSettings: 'Open Publish to VPS Settings',
    commandOpenHelp: 'Open Help & Documentation',
    commandInsertNoPublishing: 'Insert ^no-publishing marker',
    publishSuccess: 'Publishing completed.',
    publishError: 'Error during publishing (see console).',
    noConfig: 'No VPS or folder configuration defined.',
    error: {
      failureToExportSettings: 'Failed to export settings.',
    },
    progress: {
      parseVault: {
        label: 'Parsing vault',
        start: 'Parsing vault content...',
        success: 'Vault parsed successfully',
        error: 'Failed to parse vault',
      },
      uploadNotes: {
        label: 'Uploading notes',
        start: 'Uploading notes...',
        success: 'Notes uploaded successfully',
        error: 'Failed to upload notes',
      },
      uploadAssets: {
        label: 'Uploading assets',
        start: 'Uploading assets...',
        success: 'Assets uploaded successfully',
        error: 'Failed to upload assets',
        skip: 'No assets to upload',
      },
      finalizeSession: {
        label: 'Finalizing',
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
      validationFailed: 'Route tree validation failed:',
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
      ruleEnabledTooltip: 'Toggle to enable or disable this rule',
      defaultRuleIndicator: 'Default rule (read-only)',
      customRootIndexLabel: 'Custom Root Index File',
      customRootIndexDescription:
        'Optional: Select a file from your vault to use as the root index page (/) for this VPS.',
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
      cleanupIgnoredTooltip: 'Ignored by this folder',
      cleanupAppliedTooltip: 'Applied to this folder',
      customIndexLabel: 'Custom Index File',
      customIndexDescription:
        "Optional: Select a file from your vault to prepend to this folder's generated index page.",
      flattenTreeLabel: 'Flatten Tree',
      flattenTreeDescription:
        'If enabled, all notes in subfolders are published as direct children of this folder, and subfolders are hidden in navigation. URLs: routeBase/<slug> (no subfolder segments). Warning: notes with the same filename in different subfolders will conflict.',
      additionalFilesLabel: 'Additional Files',
      additionalFilesDescription:
        'Files published at the root of this folder route, regardless of their actual location in the vault',
      additionalFilesEmpty: 'No additional files',
      addAdditionalFileLabel: 'Add file to this folder',
      addAdditionalFileButton: '+ Add file',
      addAdditionalFilePlaceholder: 'Select a file...',
      additionalFileDuplicate: 'This file is already in the list',
      // Enhanced UI translations
      searchPlaceholder: 'Search folders...',
      sortLabel: 'Sort by',
      resetTooltip: 'Reset filters',
      noResults: 'No results found',
      resultCount: '{count} result{plural}',
      editButton: 'Edit',
      closeEditor: 'Close editor',
      editingLabel: 'Editing: {name}',
      emptyFolderLabel: '(Empty folder #{index})',
      routePrefix: 'Route: ',
      flattenedIndicator: '📁 Flattened',
      customIndexIndicator: '📄 Custom Index',
      exceptionsIndicator: '🚫 {count} exception{plural}',
      warningFlattenTree:
        'Flattening the tree can cause slug conflicts if multiple notes share the same filename. Ensure unique names or handle conflicts manually.',
      advancedOptionsLabel: 'Advanced options',
      // Sort options
      sortFolderAsc: 'Sort: Folder (A-Z)',
      sortFolderDesc: 'Sort: Folder (Z-A)',
      sortRouteAsc: 'Sort: Route (A-Z)',
      sortRouteDesc: 'Sort: Route (Z-A)',
      sortCustomIndexDesc: 'Sort: Custom Index (Yes first)',
      sortFlattenedDesc: 'Sort: Flattened (Yes first)',
      sortExceptionsDesc: 'Sort: Exceptions (Most first)',
    },
    routes: {
      addRootRoute: 'Add root route',
      addChildRoute: '+ Child',
      editRoute: 'Edit',
      deleteRoute: 'Delete',
      deleteLastForbidden: 'Cannot delete last root route',
      routeConfiguration: 'Route Configuration',
      segmentLabel: 'Segment',
      segmentDescription:
        'URL segment for this route (e.g., "blog", "docs"). Leave empty for root.',
      displayNameLabel: 'Display Name',
      displayNameDescription:
        'Optional: Custom name for navigation and breadcrumbs. If not set, the segment will be humanized (e.g., "api-docs" → "Api Docs").',
      displayNamePlaceholder: 'Inferred from segment if empty',
      cannotMoveParentToChild: 'Cannot move a parent route into its own child',
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
      failedWithError: 'Connection test failed: {error}',
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
          'You can exclude specific sections from publication using the ^no-publishing marker.\n\nWhen a line contains ^no-publishing, the plugin removes content up to the previous delimiter:\n1. Horizontal rule (---, ***, ___) if present (highest priority)\n2. Previous header (##, ###, etc.) if no horizontal rule\n3. Start of document if no delimiter found\n\nNote: Excessive blank lines (3+) are reduced to 2 after removal.',
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
            code: '^no-publishing\n\n## First Header\nPublic content',
            description: 'Marker at document start: only the marker is removed.',
          },
          {
            code: '## Private Header\n^no-publishing\n\n## Public Header',
            description: 'Header at document start: private header and marker removed.',
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
          'Dataview queries are executed and rendered to HTML before publishing.\n\nSupported: inline queries (=this.property), dataview blocks, dataviewjs, and custom views (dv.view()).',
        examples: [
          {
            code: '`= this.title`',
            description: 'Inline dataview query',
          },
          {
            code: '```dataview\nLIST FROM #tag\n```',
            description: 'Dataview block query',
          },
          {
            code: '```dataviewjs\nawait dv.view("my-view", {param: "value"})\n```',
            description: 'DataviewJS custom view',
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
      markdown: {
        title: 'Markdown Rendering',
        content:
          'Advanced Markdown features are fully supported:\n\n• Wikilinks to headings: [[#Heading]] or [[Page#Heading]]\n• Footnotes with CSS-safe IDs: [^1]\n• Tags filtering: Inline tags configured in Settings > Ignore Rules > Tags are automatically removed from rendered HTML (headings, blockquotes, paragraphs, etc.)\n\nAll these features work seamlessly with Obsidian syntax.',
        examples: [
          {
            code: '[[#Introduction]] or [[Page#Section]]',
            description: 'Link to heading in current page or another page',
          },
          {
            code: 'Text with footnote[^1]\n\n[^1]: Footnote content',
            description: 'Footnotes are rendered with proper CSS IDs',
          },
          {
            code: '# Title #todo\n> #note Quote text',
            description: 'Tags listed in Settings > Ignore Rules are removed (e.g., #todo, #note)',
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
  notice: {
    noFoldersConfigured: 'No folders configured for publishing.',
    noPublishableNotes: 'No publishable notes to upload.',
    publishing: 'Publishing to VPS',
    publishingCompleted: '✅ {label} completed in {duration}',
    publishingFailed: 'Publishing failed',
    publishingFailedWithError: '❌ Publishing failed: {error}\n\nCheck console for details.',
    publishingCancelled: 'Publishing cancelled by user.',
    analyzingVault: '🔍 Analyzing vault notes...',
    uploadingNotesBatches: '📤 Uploading notes in {count} batch{plural}...',
    uploadingAssetsBatches: '📤 Uploading assets in {count} batch{plural}...',
    dataviewNotDetected:
      '⚠️ Dataview plugin not detected. Dataview blocks will show as errors on the site.',
    completedIn: 'completed in',
    debugModeHint: '\n\n💡 Enable debug logging to see detailed performance metrics.',
    keepFocusWarning:
      '⚠️ Keep this window focused during publishing to avoid delays. Switching tabs or minimizing may slow down the process.',
  },
  publishingStats: {
    summary: '📊 Publishing Summary',
    separator: '─────────────────────',
    contentPublished: '📝 Content Published:',
    notes: 'Notes: {count}',
    errors: 'Errors: {count}',
    assets: 'Assets: {count}',
    assetErrors: 'Asset errors: {count}',
    notesPublished: '✅ {count} notes published',
    notesIgnored: 'ℹ️ {count} notes excluded by ignore rules',
    completedInSeconds: 'Completed in {seconds}s',
    completedInMinutes: 'Completed in {minutes}m {seconds}s',
    notesBatch: 'Notes batch {current}/{total}',
    assetsBatch: 'Assets batch {current}/{total}',
  },
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    yes: 'Yes',
    no: 'No',
    continue: 'Continue',
    confirm: 'Confirm',
    delete: 'Delete',
    add: 'Add',
    enabled: 'Enabled',
    disabled: 'Disabled',
    initializing: 'Initializing...',
    processing: 'Processing...',
    vpsNumberFallback: 'VPS #{number}',
    save: 'Save',
    saved: 'Saved',
    cancelled: 'Cancelled',
  },
  placeholders: {
    selectVps: 'Select a VPS to target...',
    vpsName: 'VPS',
    vpsUrl: 'https://...',
    apiKey: '********',
    vaultFolder: 'Blog',
    routePath: '/blog',
    assetsFolder: 'assets',
    regexPattern: 'e.g. ```[\\s\\S]*?```',
    customIndexFile: 'folder/custom-index.md',
    frontmatterProperty: 'e.g. publish, draft, private',
    tagsList: 'e.g. draft, private, internal',
    enterVpsName: 'Enter VPS name',
    calloutStylesPaths: '.obsidian/snippets/callouts.css',
  },
  sessionErrors: {
    startFailed: 'Failed to start session',
    uploadNotesFailed: 'Failed to upload notes',
    uploadAssetsFailed: 'Failed to upload assets',
    finishFailed: 'Failed to finalize session',
    abortFailed: 'Failed to abort session',
    cleanupFailed: 'Failed to cleanup VPS',
    missingApiKey: 'Missing API key',
    invalidUrl: 'Invalid URL',
    missingVpsConfig: 'Missing VPS configuration',
    missingVpsName: 'Missing VPS name',
    confirmationMismatch: 'Confirmation name mismatch',
  },
};

export const fr: Translations = {
  plugin: {
    name: 'Publier vers mon VPS personnel',
    commandPublish: 'Publier vers mon VPS personnel',
    commandCancelPublish: 'Annuler la publication en cours',
    commandTestConnection: 'Tester la connexion VPS',
    commandOpenSettings: 'Ouvrir les parametres du plugin Publier vers mon VPS personnel',
    commandOpenHelp: "Ouvrir l'aide et la documentation",
    commandInsertNoPublishing: 'Inserer le marqueur ^no-publishing',
    publishSuccess: 'Publication terminee.',
    publishError: 'Erreur lors de la publication (voir la console).',
    noConfig: 'Aucune configuration VPS ou dossier definie.',
    error: {
      failureToExportSettings: "Echec de l'exportation des parametres.",
    },
    progress: {
      parseVault: {
        label: 'Analyse du vault',
        start: 'Analyse du vault en cours...',
        success: 'Vault analyse avec succes',
        error: "Echec de l'analyse du vault",
      },
      uploadNotes: {
        label: 'Envoi des notes',
        start: 'Envoi des notes...',
        success: 'Notes envoyees avec succes',
        error: "Echec de l'envoi des notes",
      },
      uploadAssets: {
        label: 'Envoi des ressources',
        start: 'Envoi des ressources...',
        success: 'Ressources envoyees avec succes',
        error: "Echec de l'envoi des ressources",
        skip: 'Aucune ressource a envoyer',
      },
      finalizeSession: {
        label: 'Finalisation',
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
      validationFailed: "Échec de validation de l'arbre de routes :",
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
      apiKeyLabel: 'Clé API',
      apiKeyDescription: 'Clé utilisée pour authentifier les envois.',
      help: 'Les requêtes HTTP vers /api/upload utiliseront cette URL et cette clé.',
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
      ruleEnabledTooltip: 'Activer ou désactiver cette règle',
      defaultRuleIndicator: 'Règle par défaut (lecture seule)',
      customRootIndexLabel: "Fichier d'index racine personnalisé",
      customRootIndexDescription:
        "Optionnel : Sélectionnez un fichier de votre coffre à utiliser comme page d'index racine (/) pour ce VPS.",
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
      sanitizationTitle: 'Règles de nettoyage',
      sanitizationHelp: 'Définissez des règles regex appliquées au contenu avant publication.',
      defaultSanitizationRuleBanner: 'Règle par défaut (non modifiable)',
      addSanitizationRule: 'Ajouter une règle',
      deleteSanitizationRule: 'Supprimer la règle',
      ruleNameLabel: 'Nom de la règle',
      rulePatternLabel: 'Motif (regex)',
      ruleReplacementLabel: 'Remplacement',
      ruleEnabledLabel: 'Activée',
      rulesHelp:
        'Les notes dont le frontmatter correspond aux règles ci-dessous ne seront pas publiées.',
      vpsLabel: 'VPS cible',
      vpsDescription: 'Choisissez la configuration VPS a utiliser pour ce dossier.',
      foldersLabel: 'Dossiers',
      ignoredCleanupRulesTitle: 'Règles de Nettoyage Ignorées',
      ignoredCleanupRulesDescription:
        'Sélectionnez les règles de nettoyage du VPS qui ne doivent PAS être appliquées à ce dossier',
      cleanupIgnoredTooltip: 'Ignorée par ce dossier',
      cleanupAppliedTooltip: 'Appliquée à ce dossier',
      customIndexLabel: "Fichier d'index personnalisé",
      customIndexDescription:
        "Optionnel : Sélectionnez un fichier de votre coffre à ajouter en début de page d'index générée pour ce dossier.",
      flattenTreeLabel: "Aplatir l'arborescence",
      flattenTreeDescription:
        'Si activé, toutes les notes dans les sous-dossiers sont publiées comme enfants directs de ce dossier, et les sous-dossiers sont cachés dans la navigation. URLs : routeBase/<slug> (pas de segments de sous-dossier). Attention : les notes avec le même nom dans différents sous-dossiers entreront en conflit.',
      additionalFilesLabel: 'Fichiers additionnels',
      additionalFilesDescription:
        'Fichiers publiés à la racine de la route de ce dossier, quelle que soit leur localisation réelle dans le coffre',
      additionalFilesEmpty: 'Aucun fichier additionnel',
      addAdditionalFileLabel: 'Ajouter un fichier à ce dossier',
      addAdditionalFileButton: '+ Ajouter un fichier',
      addAdditionalFilePlaceholder: 'Sélectionnez un fichier...',
      additionalFileDuplicate: 'Ce fichier est déjà dans la liste',
      // Enhanced UI translations
      searchPlaceholder: 'Rechercher des dossiers...',
      sortLabel: 'Tri',
      resetTooltip: 'Réinitialiser les filtres',
      noResults: 'Aucun résultat trouvé',
      resultCount: '{count} résultat{plural}',
      editButton: 'Éditer',
      closeEditor: "Fermer l'éditeur",
      editingLabel: 'Édition : {name}',
      emptyFolderLabel: '(Dossier vide #{index})',
      routePrefix: 'Route : ',
      flattenedIndicator: '📁 Aplati',
      customIndexIndicator: '📄 Index personnalisé',
      exceptionsIndicator: '🚫 {count} exception{plural}',
      warningFlattenTree:
        "Aplatir l'arborescence peut causer des conflits de slugs si plusieurs notes partagent le même nom de fichier. Assurez des noms uniques ou gérez les conflits manuellement.",
      advancedOptionsLabel: 'Options avancées',
      // Sort options
      sortFolderAsc: 'Tri : Dossier (A-Z)',
      sortFolderDesc: 'Tri : Dossier (Z-A)',
      sortRouteAsc: 'Tri : Route (A-Z)',
      sortRouteDesc: 'Tri : Route (Z-A)',
      sortCustomIndexDesc: 'Tri : Index personnalisé (Oui en premier)',
      sortFlattenedDesc: 'Tri : Aplati (Oui en premier)',
      sortExceptionsDesc: 'Tri : Exceptions (Plus en premier)',
    },
    routes: {
      addRootRoute: 'Ajouter une route racine',
      addChildRoute: '+ Enfant',
      editRoute: 'Éditer',
      deleteRoute: 'Supprimer',
      deleteLastForbidden: 'Impossible de supprimer la dernière route racine',
      routeConfiguration: 'Configuration de la route',
      segmentLabel: 'Segment',
      segmentDescription:
        'Segment d\'URL pour cette route (ex: "blog", "docs"). Laisser vide pour la racine.',
      displayNameLabel: "Nom d'affichage",
      displayNameDescription:
        'Optionnel : Nom personnalisé pour la navigation et le fil d\'Ariane. Si non défini, le segment sera humanisé (ex: "api-docs" → "Api Docs").',
      displayNamePlaceholder: 'Déduit du segment si vide',
      cannotMoveParentToChild: 'Impossible de déplacer une route parente dans son propre enfant',
    },
    cleanupRules: {
      removeCodeBlocks: {
        name: 'Supprimer les blocs de code',
        description: 'Supprime tous les blocs de code (``` ou ~~~) du contenu avant publication',
      },
    },
    ignoreRules: {
      title: "Règles d'exclusion",
      description:
        'Les notes avec ces propriétés de frontmatter seront ignorées lors de la publication.',
      help: 'Vous pouvez définir des règles globales basées sur les propriétés et valeurs du frontmatter.',
      addButton: "Ajouter une règle d'exclusion",
      deleteButton: "Supprimer la règle d'exclusion",
      propertyLabel: 'Propriété du frontmatter',
      propertyDescription: 'Propriété à inspecter dans le frontmatter.',
      valueLabel: 'Valeur(s) à ignorer',
      valueDescription:
        'Liste de valeurs à ignorer pour cette propriété (séparées par des virgules).',
      modeValues: 'Ignorer des valeurs specifiques',
      modeBoolean: 'Ignorer si egal (true/false)',
      rulesLabel: "Règles d'Exclusion",
      frontmatterKeysLabel: 'Clés de frontmatter à supprimer',
      frontmatterKeysDescription:
        'Ces propriétés de frontmatter seront retirées des notes avant publication.',
      frontmatterKeysPlaceholder: 'ex: publish, draft, private',
      tagsLabel: 'Tags à exclure',
      tagsDescription: 'Ces tags seront retirés des notes avant publication.',
      tagsPlaceholder: 'ex: draft, private, internal',
    },
    testConnection: {
      label: 'Tester la connexion',
      notImplemented: "Test de connexion non implemente pour l'instant.",
      failed: 'Échec du test de connexion.',
      failedWithError: 'Échec du test de connexion : {error}',
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
      help: "Réglages globaux liés au vault : dossier d'assets et fallback.",
      assetsFolderLabel: "Dossier d'assets dans le vault",
      assetsFolderDescription:
        'Dossier dans le vault où les assets (images, fichiers) sont situés. Ex : Assets, Media, etc.',
      enableAssetsVaultFallbackLabel: 'Permettre le recours a la racine du vault',
      enableAssetsVaultFallbackDescription:
        "Si active, lorsqu'un asset n'est pas trouve dans le dossier specifie, le systeme le cherchera a la racine du vault et dans tous les dossiers.",
    },
    advanced: {
      title: 'Paramètres avancés',
      logLevelLabel: 'Niveau de log',
      logLevelDescription: 'De debug (verbeux) a warning (par defaut). Applique immediatement.',
      logLevelDebug: 'Debug (tres verbeux)',
      logLevelInfo: 'Info',
      logLevelWarn: 'Warning (défaut)',
      logLevelError: 'Error uniquement',
      calloutStylesLabel: 'Styles de callouts (chemins CSS)',
      calloutStylesDescription:
        'Chemins (un par ligne ou séparés par des virgules) vers des fichiers CSS du vault. Ils seront envoyés, parsés et utilisés pour étendre la configuration des callouts côté serveur.',
      calloutStylesPlaceholder: '.obsidian/snippets/callouts.css',
      cleanup: {
        title: 'Nettoyage du VPS',
        description:
          'Supprime tout le contenu publié et les assets du VPS cible. Opération irréversible.',
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
          "Vous pouvez exclure des sections spécifiques de la publication avec le marqueur ^no-publishing.\n\nQuand une ligne contient ^no-publishing, le plugin supprime le contenu jusqu'au délimiteur précédent :\n1. Ligne horizontale (---, ***, ___) si présente (priorité maximale)\n2. En-tête précédent (##, ###, etc.) si pas de ligne horizontale\n3. Début du document si aucun délimiteur trouvé\n\nNote : Les lignes vides excessives (3+) sont réduites à 2 après suppression.",
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
            code: '^no-publishing\n\n## Premier En-tête\nContenu public',
            description: 'Marqueur au début : seul le marqueur est supprimé.',
          },
          {
            code: '## En-tête Privé\n^no-publishing\n\n## En-tête Public',
            description: "En-tête au début : l'en-tête privé et le marqueur sont supprimés.",
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
          'Les requêtes Dataview sont exécutées et rendues en HTML avant publication.\n\nSupporté : requêtes inline (=this.property), blocs dataview, dataviewjs, et vues personnalisées (dv.view()).',
        examples: [
          {
            code: '`= this.title`',
            description: 'Requête dataview inline',
          },
          {
            code: '```dataview\nLIST FROM #tag\n```',
            description: 'Bloc de requête dataview',
          },
          {
            code: '```dataviewjs\nawait dv.view("ma-vue", {param: "valeur"})\n```',
            description: 'Vue personnalisée DataviewJS',
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
      markdown: {
        title: 'Rendu Markdown',
        content: `Les fonctionnalités avancées de Markdown sont pleinement supportées :\n\n• Wikilinks vers des headings : [[#Titre]] ou [[Page#Section]]\n• Notes de bas de page avec IDs CSS-safe : [^1]\n• Filtrage des tags : Les tags inline configurés dans Paramètres > Règles d'Ignorance > Tags sont automatiquement supprimés du HTML rendu (titres, blockquotes, paragraphes, etc.)\n\nToutes ces fonctionnalités fonctionnent de manière transparente avec la syntaxe Obsidian.`,
        examples: [
          {
            code: '[[#Introduction]] ou [[Page#Section]]',
            description: 'Lien vers un titre dans la page actuelle ou une autre page',
          },
          {
            code: 'Texte avec note[^1]\n\n[^1]: Contenu de la note',
            description: 'Les notes de bas de page sont rendues avec des IDs CSS appropriés',
          },
          {
            code: '# Titre #todo\n> #note Texte de citation',
            description: `Les tags listés dans Paramètres > Règles d'Ignorance sont supprimés (ex : #todo, #note)`,
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
  notice: {
    noFoldersConfigured: 'Aucun dossier configuré pour la publication.',
    noPublishableNotes: 'Aucune note publiable à envoyer.',
    publishing: 'Publication vers le VPS',
    publishingCompleted: '✅ {label} terminé en {duration}',
    publishingFailed: 'Échec de la publication',
    publishingFailedWithError:
      '❌ Échec de la publication : {error}\n\nConsultez la console pour plus de détails.',
    publishingCancelled: "Publication annulée par l'utilisateur.",
    analyzingVault: '🔍 Analyse des notes du vault...',
    uploadingNotesBatches: '📤 Envoi des notes en {count} lot{plural}...',
    uploadingAssetsBatches: '📤 Envoi des ressources en {count} lot{plural}...',
    dataviewNotDetected:
      '⚠️ Plugin Dataview non détecté. Les blocs Dataview apparaîtront comme erreurs sur le site.',
    completedIn: 'terminé en',
    debugModeHint:
      '\n\n💡 Activez le mode debug pour voir les métriques de performance détaillées.',
    keepFocusWarning:
      "⚠️ Gardez cette fenêtre au premier plan pendant la publication pour éviter les ralentissements. Changer d'onglet ou minimiser peut ralentir le processus.",
  },
  publishingStats: {
    summary: '📊 Résumé de la publication',
    separator: '─────────────────────',
    contentPublished: '📝 Contenu publié :',
    notes: 'Notes : {count}',
    errors: 'Erreurs : {count}',
    assets: 'Ressources : {count}',
    assetErrors: 'Erreurs de ressources : {count}',
    notesPublished: '✅ {count} notes publiées',
    notesIgnored: 'ℹ️ {count} notes exclues par les règles',
    completedInSeconds: 'Terminé en {seconds}s',
    completedInMinutes: 'Terminé en {minutes}m {seconds}s',
    notesBatch: 'Lot de notes {current}/{total}',
    assetsBatch: 'Lot de ressources {current}/{total}',
  },
  common: {
    ok: 'OK',
    cancel: 'Annuler',
    yes: 'Oui',
    no: 'Non',
    continue: 'Continuer',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    add: 'Ajouter',
    enabled: 'Activé',
    disabled: 'Désactivé',
    initializing: 'Initialisation...',
    processing: 'Traitement...',
    vpsNumberFallback: 'VPS n°{number}',
    save: 'Sauvegarder',
    saved: 'Sauvegardé',
    cancelled: 'Annulé',
  },
  placeholders: {
    selectVps: 'Sélectionnez un VPS cible...',
    vpsName: 'VPS',
    vpsUrl: 'https://...',
    apiKey: '********',
    vaultFolder: 'Blog',
    routePath: '/blog',
    assetsFolder: 'assets',
    regexPattern: 'ex: ```[\\s\\S]*?```',
    customIndexFile: 'dossier/index-personnalise.md',
    frontmatterProperty: 'ex: publish, draft, private',
    tagsList: 'ex: draft, private, internal',
    enterVpsName: 'Nom exact du VPS',
    calloutStylesPaths: '.obsidian/snippets/callouts.css',
  },
  sessionErrors: {
    startFailed: 'Échec du démarrage de la session',
    uploadNotesFailed: "Échec de l'envoi des notes",
    uploadAssetsFailed: "Échec de l'envoi des ressources",
    finishFailed: 'Échec de la finalisation',
    abortFailed: "Échec de l'annulation de la session",
    cleanupFailed: 'Échec du nettoyage du VPS',
    missingApiKey: 'Clé API manquante',
    invalidUrl: 'URL invalide',
    missingVpsConfig: 'Configuration VPS manquante',
    missingVpsName: 'Nom du VPS manquant',
    confirmationMismatch: 'Le nom de confirmation ne correspond pas',
  },
};
