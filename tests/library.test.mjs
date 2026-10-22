// Orchestration de la bibliothèque, testée avec des doubles (pas de DOM, pas de Web Audio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary } from '../src/library.js';
import { MESSAGES } from '../src/ui/messages.js';

const PAD_COUNT = 20;

function fakeEl() {
  const classes = new Set();
  return { disabled: true, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c) } };
}

function fakeBuffer(n = 4) {
  const data = new Float32Array(n).fill(0.5);
  return { length: n, numberOfChannels: 1, sampleRate: 8000, duration: n / 8000, getChannelData: () => data };
}

function setup(overrides = {}) {
  const statusLog = [];
  const renders = [];
  const downloads = [];
  const deps = {
    padCount: PAD_COUNT,
    pads: { els: Array.from({ length: PAD_COUNT }, fakeEl), canvases: Array.from({ length: PAD_COUNT }, () => ({})) },
    status: { set: (t) => statusLog.push(t) },
    fileLabel: { set: () => {} },
    exportButton: { disabled: false },
    renderer: { render: (cfg) => { renders.push(cfg.name); return new Promise((r) => setTimeout(() => r(fakeBuffer()), 0)); } },
    player: { play: () => {}, stop: () => {} },
    warmUpAudio: () => {},
    readFile: () => Promise.resolve(new ArrayBuffer(8)),
    decode: () => Promise.resolve(fakeBuffer(800)),
    prepareSample: (buffer) => ({ originalBuffer: buffer, reversedBuffer: buffer, analysis: {} }),
    draw: () => {},
    download: (blob, name) => downloads.push(name),
    ...overrides,
  };
  return { lib: createLibrary(deps), statusLog, renders, downloads, deps };
}

test('load génère les 20 pads, active les pads et l\'export, puis annonce la bibliothèque prête', async () => {
  const { lib, statusLog, renders, deps } = setup();
  await lib.load({ name: 'x.wav' });
  assert.equal(renders.length, 20);
  assert.equal(statusLog[0], MESSAGES.generating(1, 20));
  assert.equal(statusLog.at(-1), MESSAGES.libraryReady);
  assert.ok(deps.pads.els.every((el) => el.disabled === false));
  assert.equal(deps.exportButton.disabled, false);
});

test('un fichier indécodable affiche le message d\'erreur et laisse les pads désactivés', async () => {
  const { lib, statusLog, deps } = setup({ decode: () => Promise.reject(new Error('nope')) });
  const silent = console.error;
  console.error = () => {};
  try { await lib.load({ name: 'bad.txt' }); } finally { console.error = silent; }
  assert.equal(statusLog.at(-1), MESSAGES.decodeError);
  assert.ok(deps.pads.els.every((el) => el.disabled === true));
});

test('un clic sur un pad déjà en cours de rendu est ignoré', async () => {
  const { lib, renders } = setup();
  await lib.load({ name: 'x.wav' });
  renders.length = 0;
  const first = lib.generate(0, false);
  const second = lib.generate(0, false);
  await Promise.all([first, second]);
  assert.equal(renders.length, 1);
});

test('exporter avant la fin de la génération est refusé sans téléchargement', async () => {
  const { lib, statusLog, downloads } = setup();
  await lib.exportZip();
  assert.equal(statusLog.at(-1), MESSAGES.waitForGeneration);
  assert.equal(downloads.length, 0);
});

test('exporter après génération télécharge makeitdrum_pack.zip', async () => {
  const { lib, statusLog, downloads } = setup();
  await lib.load({ name: 'x.wav' });
  await lib.exportZip();
  assert.deepEqual(downloads, ['makeitdrum_pack.zip']);
  assert.equal(statusLog.at(-1), MESSAGES.zipDone);
});

test('click sans son importé demande d\'importer d\'abord', () => {
  const { lib, statusLog } = setup();
  lib.click(0);
  assert.deepEqual(statusLog, [MESSAGES.importFirst]);
});
