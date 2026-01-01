import { type ManifestPage } from '@core-domain';
import { humanizePropertyKey } from '@core-domain/utils/string.utils';

function escapeHtml(s: string) {
  const escaped = s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!
  );

  return escaped;
}

export function renderRootIndex(
  dirs: { name: string; link: string; count: number; displayName?: string }[],
  customContent?: string
) {
  const items = dirs
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) =>
        `<li><a class="index-link" href="${withLeadingSlash(d.link)}/index">${escapeHtml(d.displayName ?? humanizePropertyKey(d.name))}</a><span class="index-count">(${d.count})</span></li>`
    )
    .join('');

  return `
<div class="markdown-body">
  ${customContent || ''}
  <h1>Dossiers</h1>
  <ul class="index-list">${items || '<li><em>Aucun dossier</em></li>'}</ul>
</div>`;
}

export function renderFolderIndex(
  folderPath: string,
  pages: ManifestPage[],
  subfolders: { name: string; link: string; count: number; displayName?: string }[],
  customContent?: string,
  folderDisplayName?: string
) {
  const folderName = folderPath === '/' ? '/' : folderPath.split('/').filter(Boolean).pop()!;

  // Use provided folderDisplayName, otherwise humanize folder name
  const displayName = folderDisplayName ?? (humanizePropertyKey(folderName) || 'Home');

  const folderTitle = displayName;

  const subfoldList = subfolders
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) =>
        `<li><a class="index-link" href="${withLeadingSlash(d.link)}/index">${escapeHtml(d.displayName ?? humanizePropertyKey(d.name))}</a><span class="index-count">(${d.count})</span></li>`
    )
    .join('');

  const pageList = pages
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(
      (p) =>
        `<li><a class="index-link" href="${withLeadingSlash(p.route)}">${escapeHtml(p.title)}</a></li>`
    )
    .join('');

  // Only render sections if they have content
  const subfoldersSection =
    subfolders.length > 0
      ? `<section>
    <h2>Sous-dossiers</h2>
    <ul class="index-list">${subfoldList}</ul>
  </section>`
      : '';

  const pagesSection =
    pages.length > 0
      ? `<section>
    <h2>Pages</h2>
    <ul class="index-list">${pageList}</ul>
  </section>`
      : '';

  return `<div class="markdown-body">
  <h1>${escapeHtml(folderTitle)}</h1>
  ${customContent || ''}
  ${subfoldersSection}
  ${pagesSection}
</div>`;
}

function withLeadingSlash(route: string): string {
  if (!route) return '/';
  return route.startsWith('/') ? route : `/${route}`;
}
