import path from 'node:path';
import { resolveWithinRoot } from './pathUtils';

export interface PagePath {
  dir: string;
  htmlFile: string;
  markdownFile: string;
  httpPath: string;
}

export function buildPagePath(
  contentRoot: string,
  params: { route: string; relativePath: string; slug: string }
): PagePath {
  let route = params.route.trim();
  // Normalisation route : /codex → 'codex'
  route = route.replace(/^\/+/, '').replace(/\/+$/, '');

  let relativePath = (params.relativePath ?? '').trim();
  relativePath = relativePath.replace(/^\/+/, '').replace(/\/+$/, '');

  const segments: string[] = [];
  if (route) segments.push(route);
  if (relativePath) segments.push(...relativePath.split('/'));
  segments.push(params.slug);

  const dir = resolveWithinRoot(contentRoot, ...segments);
  const htmlFile = path.join(dir, 'index.html');
  const markdownFile = path.join(dir, 'note.md');

  const httpPath =
    '/' + [route, relativePath, params.slug].filter((s) => s && s.length > 0).join('/') + '/';

  return { dir, htmlFile, markdownFile, httpPath };
}
