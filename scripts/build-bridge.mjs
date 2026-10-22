// Bundle du compagnon local en un seul fichier Node : dist/makeitdrum-bridge.mjs
import { build } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
mkdirSync(new URL('dist/', ROOT), { recursive: true });
await build({
  entryPoints: [new URL('tools/bridge/makeitdrum-bridge.mjs', ROOT).pathname],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: new URL('dist/makeitdrum-bridge.mjs', ROOT).pathname,
  banner: { js: `#!/usr/bin/env node\n// makeitdrum-bridge v${pkg.version} — make it drum (Masao « Saiya Geez ») — https://github.com/yrbane/makeItDrum` },
  define: { __BRIDGE_VERSION__: JSON.stringify(pkg.version) },
});
console.log(`dist/makeitdrum-bridge.mjs — v${pkg.version}`);
