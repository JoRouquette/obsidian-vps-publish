import { Manifest, ManifestPage } from '../../application/ports/SiteIndexPort';

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!
  );
}

export function renderRootIndex(dirs: { name: string; href: string; count: number }[]) {
  const items = dirs
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) => `<li><a href="${d.href}/">${escapeHtml(d.name)}</a> <small>(${d.count})</small></li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Site index</title>
<style>
:root { color-scheme: dark; }
body { font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 2rem auto; max-width: 900px; padding: 0 1rem; }
h1 { font-size: 1.6rem; margin-bottom: 1rem; }
ul { list-style: none; padding: 0; }
li { padding: .35rem 0; border-bottom: 1px solid #2a2a2a; }
a { text-decoration: none; }
small { color: #9aa0a6; }
</style>
</head>
<body>
<header><h1>Folders</h1></header>
<main>
  <ul>${items || '<li><em>No folders yet</em></li>'}</ul>
</main>
</body>
</html>`;
}

export function renderFolderIndex(
  folderPath: string,
  pages: ManifestPage[],
  subfolders: { name: string; href: string; count: number }[]
) {
  const folderName = folderPath === '/' ? '/' : folderPath.split('/').filter(Boolean).pop()!;
  const folderTitle = folderName || 'Home';

  const subfoldList = subfolders
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (d) => `<li><a href="${d.href}/">${escapeHtml(d.name)}</a> <small>(${d.count})</small></li>`
    )
    .join('');

  const pageList = pages
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => `<li><a href="${p.route}/">${escapeHtml(p.title)}</a></li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(folderTitle)} — Index</title>
<style>
:root { color-scheme: dark; }
body { font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; margin: 2rem auto; max-width: 900px; padding: 0 1rem; }
h1 { font-size: 1.6rem; margin-bottom: .75rem; }
section { margin: 1.25rem 0; }
h2 { font-size: 1.1rem; color: #9aa0a6; margin-bottom: .5rem; }
ul { list-style: none; padding: 0; }
li { padding: .35rem 0; border-bottom: 1px solid #2a2a2a; }
a { text-decoration: none; }
small { color: #9aa0a6; }
</style>
</head>
<body>
<header><h1>${escapeHtml(folderTitle)}</h1></header>
<main>
  <section>
    <h2>Subfolders</h2>
    <ul>${subfoldList || '<li><em>No subfolders</em></li>'}</ul>
  </section>
  <section>
    <h2>Pages</h2>
    <ul>${pageList || '<li><em>No pages</em></li>'}</ul>
  </section>
</main>
</body>
</html>`;
}
