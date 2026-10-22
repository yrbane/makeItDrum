import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padFileName, buildManifest, parseManifest, packKit, unpackKit } from '../../src/core/kit.js';
import { FLAVORS } from '../../src/core/flavors.js';
import { encodeWav } from '../../src/core/wav.js';

function pads(n = 20) {
  return Array.from({ length: n }, (_, i) => ({
    index: i, flavor: FLAVORS[i].name, seed: 1000 + i, samples: new Float32Array([0.1 * i, -0.1 * i]), sampleRate: 8000,
  }));
}

test('padFileName : NN_FLAVOR.wav', () => {
  assert.equal(padFileName(0, 'BOOM'), '01_BOOM.wav');
  assert.equal(padFileName(19, 'CHAOS'), '20_CHAOS.wav');
});

test('buildManifest décrit le kit avec notes GM par défaut et fichiers nommés', () => {
  const m = buildManifest({ name: 'Casserole', engineVersion: '1.2.0', createdAt: '2026-10-22T20:10:00Z', source: { fileName: 'c.wav', sampleRate: 44100, duration: 0.5 }, pads: pads() });
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.app, 'make-it-drum');
  assert.equal(m.name, 'Casserole');
  assert.equal(m.pads.length, 20);
  assert.deepEqual(m.pads[1], { index: 1, flavor: 'KICK', seed: 1001, note: 37, file: '02_KICK.wav' });
  assert.deepEqual(m.source, { fileName: 'c.wav', sampleRate: 44100, duration: 0.5 });
  assert.equal(JSON.stringify(m).includes('samples'), false, 'pas de données audio dans le manifeste');
});

test('parseManifest accepte un manifeste v1 et refuse le reste', () => {
  const ok = parseManifest(JSON.stringify({ schemaVersion: 1, name: 'K', pads: [{ index: 0, file: 'a.wav' }] }));
  assert.equal(ok.name, 'K');
  assert.deepEqual(ok.pads[0], { index: 0, flavor: 'BOOM', seed: null, note: 36, file: 'a.wav' });
  assert.throws(() => parseManifest('{nope'), /kit\.json/);
  assert.throws(() => parseManifest(JSON.stringify({ schemaVersion: 2, pads: [] })), /schemaVersion/);
  assert.throws(() => parseManifest(JSON.stringify({ schemaVersion: 1, pads: [{ index: 0 }] })), /file/);
});

test('packKit produit kit.json puis les 20 WAV, dans l\'ordre des pads', () => {
  const files = packKit({ name: 'K', engineVersion: '1.2.0', createdAt: 'now', source: null, pads: pads() });
  assert.equal(files.length, 21);
  assert.equal(files[0].name, 'kit.json');
  assert.equal(files[1].name, '01_BOOM.wav');
  assert.equal(files[20].name, '20_CHAOS.wav');
  const manifest = JSON.parse(new TextDecoder().decode(files[0].data));
  assert.equal(manifest.pads[19].file, '20_CHAOS.wav');
  assert.equal(new TextDecoder().decode(files[1].data.subarray(0, 4)), 'RIFF');
});

test('unpackKit relit un kit exporté : nom, graines, notes et octets WAV', () => {
  const files = packKit({ name: 'K', engineVersion: '1.2.0', createdAt: 'now', source: { fileName: 'c.wav', sampleRate: 8000, duration: 1 }, pads: pads() });
  const kit = unpackKit(files);
  assert.equal(kit.name, 'K');
  assert.equal(kit.source.fileName, 'c.wav');
  assert.equal(kit.pads.length, 20);
  assert.equal(kit.pads[3].flavor, 'SNAP');
  assert.equal(kit.pads[3].seed, 1003);
  assert.equal(kit.pads[3].note, 39);
  assert.ok(kit.pads[3].wav instanceof Uint8Array);
});

test('unpackKit lit le pack historique makeitdrum_NN.wav sans manifeste', () => {
  const wav = new Uint8Array(encodeWav(new Float32Array([0, 0.5]), 8000));
  const entries = [21, 2, 1].map((n) => ({ name: 'makeitdrum_' + String(n).padStart(2, '0') + '.wav', data: wav }));
  entries.push({ name: 'notes.txt', data: new Uint8Array([1]) });
  const kit = unpackKit(entries, 'makeitdrum_pack');
  assert.equal(kit.name, 'makeitdrum_pack');
  assert.equal(kit.pads.length, 2, 'trié, limité aux 20 recettes, non-WAV ignorés');
  assert.deepEqual(kit.pads.map((p) => p.flavor), ['BOOM', 'KICK']);
  assert.equal(kit.pads[0].seed, null);
});

test('unpackKit signale un manifeste qui pointe vers un fichier absent et un ZIP sans WAV', () => {
  const manifest = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, pads: [{ index: 0, file: 'nope.wav' }] }));
  assert.throws(() => unpackKit([{ name: 'kit.json', data: manifest }]), /nope\.wav/);
  assert.throws(() => unpackKit([{ name: 'readme.txt', data: new Uint8Array(1) }]), /aucun/i);
});
