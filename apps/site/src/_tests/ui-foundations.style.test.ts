import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Site UI foundations styles', () => {
  const repoRoot = process.cwd();

  it('defines shared responsive typography and layout tokens in global styles', () => {
    const source = readFileSync(join(repoRoot, 'apps/site/src/styles.scss'), 'utf8');

    expect(source).toContain('--font-size-body:');
    expect(source).toContain('--font-size-heading-1:');
    expect(source).toContain('--layout-page-gutter:');
    expect(source).toContain('--layout-reader-max:');
    expect(source).toContain('font-size: var(--font-size-body);');
    expect(source).toContain('line-height: var(--line-height-body);');
  });

  it('keeps shell spacing driven by shared gutter variables instead of ultra-tight mobile padding', () => {
    const source = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/shell/shell.component.scss'),
      'utf8'
    );

    expect(source).toContain('--shell-pad-inline: var(--layout-page-gutter);');
    expect(source).toContain('padding: var(--shell-pad-block) var(--shell-pad-inline) 0;');
    expect(source).toContain('margin-left: calc(-1 * var(--shell-pad-inline));');
    expect(source).toContain('overflow-x: hidden;');
    expect(source).toContain('--shell-pad-inline: clamp(0.875rem, 4.5vw, 1rem);');
    expect(source).not.toMatch(/\.main\s*\{\s*padding:\s*0\.25rem;/);
  });

  it('constrains viewer reading measure and applies the shared text scale', () => {
    const source = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/viewer/viewer.component.scss'),
      'utf8'
    );

    expect(source).toContain('--page-max: var(--layout-content-max);');
    expect(source).toContain('--measure: var(--layout-reader-max);');
    expect(source).toContain('font-size: var(--font-size-body);');
    expect(source).toContain('inline-size: min(var(--page-max), 100%);');
    expect(source).toContain('max-inline-size: min(var(--measure), 100%);');
    expect(source).not.toContain('font-size: 0.75rem;');
  });

  it('keeps explicit mobile padding and readable density in the viewer', () => {
    const source = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/viewer/viewer.component.scss'),
      'utf8'
    );

    expect(source).toContain('--page-pad: clamp(0.35rem, 1.4vw, 0.6rem);');
    expect(source).toContain('--page-pad: clamp(0.3rem, 2vw, 0.5rem);');
    expect(source).toContain('font-size: clamp(1.02rem, 0.99rem + 0.35vw, 1.08rem);');
    expect(source).toContain('line-height: 1.72;');
    expect(source).toContain('margin: var(--space-stack-sm) 0 var(--space-stack-md);');
    expect(source).toContain(
      'overflow-x: auto; /* Scroll horizontal uniquement dans le conteneur */'
    );
    expect(source).toContain('max-width: 100% !important;');
  });

  it('raises navigation text to shared readable UI sizes', () => {
    const topbarSource = readFileSync(
      join(repoRoot, 'apps/site/src/presentation/pages/topbar/topbar.component.scss'),
      'utf8'
    );
    const explorerSource = readFileSync(
      join(
        repoRoot,
        'apps/site/src/presentation/components/vault-explorer/vault-explorer.component.scss'
      ),
      'utf8'
    );

    expect(topbarSource).toContain('font-size: 0.95rem;');
    expect(explorerSource).toContain('font-size: var(--font-size-ui);');
    expect(explorerSource).toContain('font-size: var(--font-size-ui-sm);');
    expect(explorerSource).not.toContain('font-size: 0.85rem;');
  });
});
