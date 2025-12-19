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
  dirs: { name: string; link: string; count: number }[],
  customContent?: string
) {
  const items = dirs
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) =>
        `<li><a class="index-link" href="${withLeadingSlash(d.link)}/index">${escapeHtml(humanizePropertyKey(d.name))}</a><span class="index-count">(${d.count})</span></li>`
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
  subfolders: { name: string; link: string; count: number }[],
  customContent?: string
) {
  const folderName = folderPath === '/' ? '/' : folderPath.split('/').filter(Boolean).pop()!;
  const folderTitle = humanizePropertyKey(folderName) || 'Home';

  const subfoldList = subfolders
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) =>
        `<li><a class="index-link" href="${withLeadingSlash(d.link)}/index">${escapeHtml(humanizePropertyKey(d.name))}</a><span class="index-count">(${d.count})</span></li>`
    )
    .join('');

  const pageList = pages
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(
      (p) =>
        `<li><a class="index-link" href="${withLeadingSlash(p.route)}">${escapeHtml(p.title)}</a></li>`
    )
    .join('');

  return `<div class="markdown-body">
  ${customContent || ''}
  <h1>${escapeHtml(folderTitle)}</h1>
  <section>
    <h2>Sous-dossiers</h2>
    <ul class="index-list">${subfoldList || '<li><em>Aucun sous dossier</em></li>'}</ul>
  </section>
  <section>
    <h2>Pages</h2>
    <ul class="index-list">${pageList || '<li><em>Aucune page</em></li>'}</ul>
  </section>
</div>`;
}

function withLeadingSlash(route: string): string {
  if (!route) return '/';
  return route.startsWith('/') ? route : `/${route}`;
}
