// Le build produit un index.html autonome, à la bonne version, avec le CSS intact.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
let html;
let pkg;
let css;

before(() => {
  execFileSync('node', ['scripts/build.mjs'], { cwd: ROOT, stdio: 'ignore' });
  html = readFileSync(new URL('dist/index.html', ROOT), 'utf8');
  pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'));
  css = readFileSync(new URL('src/styles.css', ROOT), 'utf8');
});

test('le badge affiche la version du package.json', () => {
  assert.match(html, new RegExp(`id="versionBadge">v${pkg.version.replace(/\\./g, '\\.')}<`));
});

test('aucune ressource distante', () => {
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /@import\s+url\(/i);
});

test('le CSS est inliné tel quel', () => {
  assert.ok(html.includes('<style>\n' + css + '</style>'));
});

test('les éléments du flux import → pads → export sont présents', () => {
  for (const id of ['dropzone', 'fileInput', 'padGrid', 'btnExportAll', 'statusText']) {
    assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
  }
});

test('le bundle est inliné en un seul script avec l\'en-tête d\'auteur', () => {
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.match(html, /\/\/! make it drum\.exe — Masao « Saiya Geez »/);
  assert.doesNotMatch(html, /build:(css|js)/);
});
