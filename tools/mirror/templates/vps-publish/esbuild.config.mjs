import esbuild from 'esbuild';
import process from 'process';
import { builtinModules } from 'node:module';

// esbuild keeps the `node:` prefix of an import only when the external list holds that exact
// form, so every built-in is listed with and without the prefix (as `builtin-modules` did).
const nodeBuiltins = builtinModules.flatMap((name) =>
  name.startsWith('node:') ? [name] : [name, `node:${name}`]
);

const prod = process.argv[2] === 'production';
const context = await esbuild.context({
  banner: { js: `/* Bundled by esbuild — see source on GitHub */` },
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'es2018',
  tsconfig: './tsconfig.json',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  minify: prod,
  outfile: 'main.js',
  external: [
    'obsidian', 'electron',
    '@codemirror/autocomplete', '@codemirror/collab', '@codemirror/commands',
    '@codemirror/language', '@codemirror/lint', '@codemirror/search',
    '@codemirror/state', '@codemirror/view',
    '@lezer/common', '@lezer/highlight', '@lezer/lr',
    ...nodeBuiltins,
  ],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
