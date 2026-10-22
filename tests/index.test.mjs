// Tests de cohérence du fichier unique index.html : version, autonomie, structure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('le badge de version affiché correspond au package.json', () => {
  const m = html.match(/id="versionBadge">v([^<]+)</);
  assert.ok(m, 'badge de version introuvable');
  assert.equal(m[1], pkg.version);
});

test('aucune dépendance externe : pas de script ni de feuille de style distante', () => {
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.doesNotMatch(html, /@import\s+url\(/i);
});

test('la page expose les éléments nécessaires au flux import → pads → export', () => {
  for (const id of ['dropzone', 'fileInput', 'padGrid', 'btnExportAll', 'statusText']) {
    assert.match(html, new RegExp(`id="${id}"`), `élément #${id} manquant`);
  }
  assert.match(html, /const PAD_COUNT = 20;/);
});

test('les 20 traitements sont bien tous décrits dans le moteur', () => {
  const flavors = html.match(/^\s*\/\/ \d+\. [A-Z]+ /gm) ?? [];
  assert.equal(flavors.length, 20);
});

test('le document est en français, encodé en UTF-8, avec un titre', () => {
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /<meta charset="UTF-8">/);
  assert.match(html, /<title>make it drum\.exe<\/title>/);
});
