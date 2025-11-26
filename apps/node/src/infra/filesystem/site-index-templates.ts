import { ManifestPage } from '@core-domain';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s: string) {
  let escaped = s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!
  );

  return capitalize(escaped);
}

export function renderRootIndex(dirs: { name: string; link: string; count: number }[]) {
  const items = dirs
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) =>
        `<li><a [routerLink]="${d.link}/index.html">${escapeHtml(d.name)}</a> <small>(${d.count})</small></li>`
    )
    .join('');

  return `
<div class="markdown-body">
  <h1>Dossiers</h1>
  <ul>${items || '<li><em>Aucun dossier</em></li>'}</ul>
</div>`;
}

export function renderFolderIndex(
  folderPath: string,
  pages: ManifestPage[],
  subfolders: { name: string; link: string; count: number }[]
) {
  const folderName = folderPath === '/' ? '/' : folderPath.split('/').filter(Boolean).pop()!;
  const folderTitle = capitalize(folderName) || 'Home';

  const subfoldList = subfolders
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) =>
        `<li><a [routerLink]="${d.link}/index.html">${escapeHtml(d.name)}</a> <small>(${d.count})</small></li>`
    )
    .join('');

  const pageList = pages
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => `<li><a [routerLink]="${p.route}.html">${escapeHtml(p.title)}</a></li>`)
    .join('');

  return `<div class="markdown-body">
  <h1>${escapeHtml(folderTitle)}</h1>
  <section>
    <h2>Sous-dossiers</h2>
    <ul>${subfoldList || '<li><em>Aucun sous dossier</em></li>'}</ul>
  </section>
  <section>
    <h2>Pages</h2>
    <ul>${pageList || '<li><em>Aucune page</em></li>'}</ul>
  </section>
</div>`;
}
