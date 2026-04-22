import type { CollectedNote } from '@core-domain/entities/collected-note';
import type { IgnoreRule } from '@core-domain/entities/ignore-rule';

type FixtureCorpus = {
  id: string;
  notes: CollectedNote[];
  ignoredNoteIds: string[];
};

const guidesFolder = {
  id: 'guides-folder',
  vaultFolder: 'Vault/Guides',
  routeBase: '/guides',
  vpsId: 'fixture-vps',
  ignoredCleanupRuleIds: [],
};

const referenceFolder = {
  id: 'reference-folder',
  vaultFolder: 'Vault/Reference',
  routeBase: '/reference',
  vpsId: 'fixture-vps',
  ignoredCleanupRuleIds: [],
};

function createNote(
  noteId: string,
  title: string,
  vaultPath: string,
  relativePath: string,
  content: string,
  frontmatter: Record<string, unknown>,
  folderConfig = guidesFolder
): CollectedNote {
  return {
    noteId,
    title,
    vaultPath,
    relativePath,
    content,
    frontmatter: frontmatter as unknown as CollectedNote['frontmatter'],
    folderConfig,
  };
}

export const deterministicTransformParityIgnoreRules: IgnoreRule[] = [
  { property: 'publish', ignoreIf: false } as IgnoreRule,
];

export const deterministicTransformParityFixtures: FixtureCorpus[] = [
  {
    id: 'alias-anchor-subpath-and-ignored',
    ignoredNoteIds: ['draft-note'],
    notes: [
      createNote(
        'canon-note',
        'Canon',
        'Vault/Guides/Canon.md',
        'Canon.md',
        [
          '## Système de gouvernance',
          '',
          'Hero paragraph for block reference.',
          '^hero-block',
          '',
          '## Related Section',
          '',
          'More canonical details.',
        ].join('\n'),
        {
          publish: true,
          aliases: ['Alias Note'],
        }
      ),
      createNote(
        'nested-page',
        'Nested Page',
        'Vault/Guides/Nested/Page.md',
        'Nested/Page.md',
        ['## Deep Heading', '', 'Nested content body.'].join('\n'),
        {
          publish: true,
        }
      ),
      createNote(
        'consumer-note',
        'Consumer',
        'Vault/Guides/Consumer.md',
        'Consumer.md',
        [
          'Heading link: [[Alias Note#Système de gouvernance|Alias heading]]',
          'Block link: [[Alias Note#^hero-block|Alias block]]',
          'Nested link: [[Nested/Page#Deep Heading|Nested heading]]',
          'Ignored link: [[Draft Note]]',
        ].join('\n\n'),
        {
          publish: true,
        }
      ),
      createNote(
        'draft-note',
        'Draft Note',
        'Vault/Guides/Draft Note.md',
        'Draft Note.md',
        'This note must stay ignored.',
        {
          publish: false,
        }
      ),
    ],
  },
  {
    id: 'mixed-duplicates-cross-folder-and-anchors',
    ignoredNoteIds: ['ignored-outline'],
    notes: [
      createNote(
        'primary-overview',
        'Overview',
        'Vault/Guides/Overview.md',
        'Overview.md',
        ['## Shared Heading', '', 'Primary overview content.'].join('\n'),
        {
          publish: true,
          aliases: ['Guide Alias'],
        }
      ),
      createNote(
        'consumer-overview',
        'Consumer Overview',
        'Vault/Guides/Consumer Overview.md',
        'Consumer Overview.md',
        [
          'Alias heading: [[Guide Alias#Shared Heading|Guide alias heading]]',
          'Duplicate candidate: [[Archive/Shared#Section A|Archive shared]]',
          'Cross-folder route: [[Shared]]',
          'Ignored outline: [[Ignored Outline]]',
        ].join('\n\n'),
        {
          publish: true,
        }
      ),
      createNote(
        'archive-shared',
        'Shared',
        'Vault/Guides/Archive/Shared.md',
        'Archive/Shared.md',
        ['## Section A', '', 'A longer shared body that should win its duplicate group.'].join(
          '\n'
        ),
        {
          publish: true,
        }
      ),
      createNote(
        'teams-shared',
        'Shared',
        'Vault/Guides/Teams/Shared.md',
        'Teams/Shared.md',
        'Short body.',
        {
          publish: true,
        }
      ),
      createNote(
        'archive-overview',
        'Overview',
        'Vault/Guides/Archive/Overview.md',
        'Archive/Overview.md',
        'Short overview variant.',
        {
          publish: true,
        }
      ),
      createNote(
        'teams-overview',
        'Overview',
        'Vault/Guides/Teams/Overview.md',
        'Teams/Overview.md',
        'A much longer overview variant that should remain canonical in its duplicate group.',
        {
          publish: true,
        }
      ),
      createNote(
        'reference-shared',
        'Shared',
        'Vault/Reference/Shared.md',
        'Shared.md',
        ['## Shared Heading', '', 'Reference folder copy.'].join('\n'),
        {
          publish: true,
        },
        referenceFolder
      ),
      createNote(
        'ignored-outline',
        'Ignored Outline',
        'Vault/Guides/Ignored Outline.md',
        'Ignored Outline.md',
        'Ignored note content.',
        {
          publish: false,
        }
      ),
    ],
  },
];
