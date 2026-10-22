// Build : bundle ES → IIFE (esbuild), puis inline du CSS et du JS dans le
// gabarit. Produit dist/index.html, un fichier autonome sans ressource distante.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));

const banner = `//! make it drum.exe — Masao « Saiya Geez » — v${pkg.version} — https://github.com/yrbane/makeItDrum`;

const result = await build({
  entryPoints: [new URL('src/app.js', ROOT).pathname],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  write: false,
  legalComments: 'inline',
  banner: { js: banner },
  define: { __VERSION__: JSON.stringify(pkg.version) },
});

const js = result.outputFiles[0].text;
const css = readFileSync(new URL('src/styles.css', ROOT), 'utf8');
const template = readFileSync(new URL('src/template.html', ROOT), 'utf8');

const html = template
  .replace('<!-- build:css -->', () => css)
  .replace('<!-- build:js -->', () => js)
  .replace('{{VERSION}}', pkg.version);

mkdirSync(new URL('dist/', ROOT), { recursive: true });
writeFileSync(new URL('dist/index.html', ROOT), html);
console.log(`dist/index.html — v${pkg.version} — ${html.length} octets`);
