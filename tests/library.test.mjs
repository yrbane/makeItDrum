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

// deux canaux distincts : le canal 0 vaut 0,5, le canal 1 vaut -0,25
function fakeBuffer(n = 4) {
  const channels = [new Float32Array(n).fill(0.5), new Float32Array(n).fill(-0.25)];
  return { length: n, numberOfChannels: 2, sampleRate: 8000, duration: n / 8000, getChannelData: (ch) => channels[ch] };
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

test('le WAV exporté est encodé depuis le canal 0', async () => {
  const blobs = [];
  const { lib } = setup({ download: (blob) => blobs.push(blob) });
  await lib.load({ name: 'x.wav' });
  await lib.exportZip();
  const zip = new Uint8Array(await blobs[0].arrayBuffer());
  const view = new DataView(zip.buffer);
  const nameLen = view.getUint16(26, true);
  const pcmStart = 30 + nameLen + 44;
  // 0,5 × 0x7FFF = 16383,5 → tronqué par setInt16 ; le canal 1 (-0,25) donnerait une valeur négative
  assert.equal(view.getInt16(pcmStart, true), Math.trunc(0.5 * 0x7fff));
});

test('un échec de rendu affiche le message, éteint le pad et le relâche', async () => {
  let fail = false;
  const { lib, statusLog, deps, renders } = setup({
    renderer: { render: (cfg) => { renders.push(cfg.name); return fail ? Promise.reject(new Error('boom')) : Promise.resolve(fakeBuffer()); } },
  });
  await lib.load({ name: 'x.wav' });
  fail = true;
  const silent = console.error;
  console.error = () => {};
  try { await lib.generate(2, true); } finally { console.error = silent; }
  assert.equal(statusLog.at(-1), MESSAGES.renderError);
  assert.equal(deps.pads.els[2].classList.has('playing'), false);
  fail = false;
  renders.length = 0;
  await lib.generate(2, false);
  assert.equal(renders.length, 1, 'le pad doit être de nouveau générable');
});

test('generate avec autoplay allume le pad pendant la lecture et l\'éteint à la fin', async () => {
  let listener = null;
  const { lib, deps } = setup({ player: { play: (buf, l) => { listener = l; l.onStart(); }, stop: () => {} } });
  await lib.load({ name: 'x.wav' });
  await lib.generate(0, true);
  assert.equal(deps.pads.els[0].classList.has('playing'), true);
  listener.onStop();
  assert.equal(deps.pads.els[0].classList.has('playing'), false);
});

test('hover joue le pad s\'il est prêt et reste muet sinon', async () => {
  const played = [];
  const { lib } = setup({ player: { play: (buf) => played.push(buf), stop: () => {} } });
  lib.hover(0);
  assert.equal(played.length, 0);
  await lib.load({ name: 'x.wav' });
  lib.hover(0);
  assert.equal(played.length, 1);
});

test('click sans son importé demande d\'importer d\'abord', () => {
  const { lib, statusLog } = setup();
  lib.click(0);
  assert.deepEqual(statusLog, [MESSAGES.importFirst]);
});
