// Kits : graines par pad, export .kit.zip, sauvegarde/chargement/suppression, import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary } from '../src/library.js';
import { MESSAGES } from '../src/ui/messages.js';
import { buildZip, readZip } from '../src/core/zip.js';
import { packKit } from '../src/core/kit.js';
import { encodeWav } from '../src/core/wav.js';

const PAD_COUNT = 20;

function fakeEl() {
  const classes = new Set();
  return { disabled: true, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), has: (c) => classes.has(c) } };
}

function fakeBuffer(n = 4, value = 0.5) {
  const ch = new Float32Array(n).fill(value);
  return { length: n, numberOfChannels: 1, sampleRate: 8000, duration: n / 8000, getChannelData: () => ch };
}

function memoryStorage() {
  const kits = new Map();
  return {
    kits,
    list: async () => Array.from(kits.values()).map((k) => ({ id: k.id, name: k.name, createdAt: k.createdAt })),
    get: async (id) => kits.get(id) || null,
    put: async (k) => { kits.set(k.id, k); },
    remove: async (id) => { kits.delete(id); },
  };
}

function setup(overrides = {}) {
  const statusLog = [];
  const renders = [];
  const downloads = [];
  const kitBarCalls = [];
  const created = [];
  let ids = 0;
  const deps = {
    padCount: PAD_COUNT,
    pads: { els: Array.from({ length: PAD_COUNT }, fakeEl), canvases: Array.from({ length: PAD_COUNT }, () => ({})) },
    status: { set: (t) => statusLog.push(t) },
    fileLabel: { set: () => {} },
    exportButton: { disabled: true },
    renderer: { render: (cfg, sample, rng) => { renders.push({ name: cfg.name, rng }); return Promise.resolve(fakeBuffer()); } },
    player: { play: () => {}, stop: () => {} },
    warmUpAudio: () => {},
    readFile: (file) => Promise.resolve(file.bytes ? file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) : new ArrayBuffer(8)),
    decode: () => Promise.resolve(fakeBuffer(800)),
    prepareSample: (buffer) => ({ originalBuffer: buffer, reversedBuffer: buffer, analysis: {} }),
    draw: () => {},
    download: (blob, name) => downloads.push({ blob, name }),
    storage: memoryStorage(),
    kitBar: { setKits: (list, currentId) => kitBarCalls.push({ list, currentId }), setEnabled: (flags) => kitBarCalls.push({ enabled: flags }) },
    promptName: () => 'Mon kit',
    createBuffer: (samples, sampleRate) => { created.push(sampleRate); return fakeBuffer(samples.length, samples[0]); },
    version: '1.2.0',
    now: () => '2026-10-22T20:00:00.000Z',
    random: () => 0.25,
    newId: () => 'id-' + (++ids),
    ...overrides,
  };
  return { lib: createLibrary(deps), deps, statusLog, renders, downloads, kitBarCalls, created };
}

test('chaque rendu reçoit son propre générateur issu d\'une graine tirée de random', async () => {
  const { lib, renders } = setup();
  await lib.load({ name: 'x.wav' });
  assert.equal(renders.length, 20);
  assert.equal(typeof renders[0].rng.rnd, 'function');
  assert.equal(lib.seeds[0], 0x40000000, 'random = 0,25 → graine 2^30');
  assert.equal(lib.seeds.length, 20);
});

test('exportKit télécharge <nom>.kit.zip avec kit.json puis 20 WAV', async () => {
  const { lib, statusLog, downloads } = setup({ promptName: () => 'Casserole bleue' });
  await lib.load({ name: 'casserole.wav' });
  await lib.exportKit();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'casserole.kit.zip', 'sans kit sauvé : nom du fichier source');
  const entries = await readZip(new Uint8Array(await downloads[0].blob.arrayBuffer()));
  assert.equal(entries[0].name, 'kit.json');
  assert.equal(entries.length, 21);
  assert.equal(entries[20].name, '20_CHAOS.wav');
  const manifest = JSON.parse(new TextDecoder().decode(entries[0].data));
  assert.equal(manifest.engineVersion, '1.2.0');
  assert.equal(manifest.pads[0].seed, 0x40000000);
  assert.deepEqual(manifest.source, { fileName: 'casserole.wav', sampleRate: 8000, duration: 0.1 });
  assert.equal(statusLog.at(-1), MESSAGES.kitExported('casserole'));
});

test('exportKit avant la génération est refusé', async () => {
  const { lib, statusLog, downloads } = setup();
  await lib.exportKit();
  assert.equal(statusLog.at(-1), MESSAGES.waitForGeneration);
  assert.equal(downloads.length, 0);
});

test('saveKit demande un nom, stocke 20 pads avec graines et sélectionne le kit', async () => {
  const { lib, deps, statusLog, kitBarCalls } = setup();
  await lib.load({ name: 'x.wav' });
  await lib.saveKit();
  const stored = Array.from(deps.storage.kits.values());
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, 'Mon kit');
  assert.equal(stored[0].pads.length, 20);
  assert.equal(stored[0].pads[5].flavor, 'BUZZ');
  assert.equal(stored[0].pads[5].seed, 0x40000000);
  assert.equal(stored[0].pads[5].note, 41);
  assert.ok(stored[0].pads[5].samples instanceof Float32Array);
  assert.equal(stored[0].engineVersion, '1.2.0');
  assert.equal(statusLog.at(-1), MESSAGES.kitSaved('Mon kit'));
  const last = kitBarCalls.filter((c) => c.list).at(-1);
  assert.equal(last.list[0].name, 'Mon kit');
  assert.equal(last.currentId, stored[0].id);
});

test('saveKit annulé ne stocke rien ; sans bibliothèque il demande de générer', async () => {
  const { lib, deps, statusLog } = setup({ promptName: () => null });
  await lib.saveKit();
  assert.equal(statusLog.at(-1), MESSAGES.waitForGeneration);
  await lib.load({ name: 'x.wav' });
  await lib.saveKit();
  assert.equal(deps.storage.kits.size, 0);
});

test('loadKit reconstruit les buffers sans rendu, active pads et export, et se joue', async () => {
  const { lib, deps, renders, statusLog, created } = setup();
  await deps.storage.put({ id: 'k1', name: 'Vieux kit', createdAt: 'x', pads: Array.from({ length: 20 }, (_, i) => ({ index: i, flavor: 'F' + i, seed: 7 + i, note: 36 + i, sampleRate: 22050, samples: new Float32Array([0.1 * i, 0]) })) });
  await lib.loadKit('k1');
  assert.equal(renders.length, 0);
  assert.equal(created.length, 20);
  assert.equal(created[0], 22050);
  assert.ok(deps.pads.els.every((el) => !el.disabled));
  assert.equal(deps.exportButton.disabled, false);
  assert.equal(lib.seeds[3], 10);
  assert.equal(statusLog.at(-1), MESSAGES.kitLoaded('Vieux kit'));
  const played = [];
  deps.player.play = (buf) => played.push(buf);
  lib.hover(2);
  assert.equal(played.length, 1, 'un kit chargé se joue sans son importé');
  lib.click(2);
  assert.equal(statusLog.at(-1), MESSAGES.importFirst, 'mais varier demande un son importé');
});

test('loadKit avec un identifiant vide ou inconnu ne fait rien de cassant', async () => {
  const { lib, statusLog } = setup();
  await lib.loadKit('');
  await lib.loadKit('absent');
  assert.equal(statusLog.at(-1), MESSAGES.kitMissing);
});

test('un nouveau rendu désélectionne le kit sauvé ; deleteKit le supprime', async () => {
  const { lib, deps, kitBarCalls, statusLog } = setup();
  await lib.load({ name: 'x.wav' });
  await lib.saveKit();
  await lib.generate(0, false);
  assert.equal(kitBarCalls.filter((c) => c.list).at(-1).currentId, null);
  await lib.deleteKit();
  assert.equal(statusLog.at(-1), MESSAGES.noKitSelected);
  await lib.loadKit('id-1');
  await lib.deleteKit();
  assert.equal(deps.storage.kits.size, 0);
  assert.equal(statusLog.at(-1), MESSAGES.kitDeleted('Mon kit'));
});

test('importKit lit un .kit.zip, le sauvegarde puis le charge ; un fichier invalide affiche l\'erreur', async () => {
  const { lib, deps, statusLog } = setup({ decode: (ab) => Promise.resolve(fakeBuffer(2, new DataView(ab).getInt16(44, true) / 0x7fff)) });
  const pads = Array.from({ length: 20 }, (_, i) => ({ index: i, flavor: 'P' + i, seed: 100 + i, samples: new Float32Array([0.5, 0]), sampleRate: 8000 }));
  const zip = buildZip(packKit({ name: 'Importé', engineVersion: '1.2.0', createdAt: 'now', source: null, pads }));
  await lib.importKit({ name: 'Importé.kit.zip', bytes: zip });
  assert.equal(deps.storage.kits.size, 1);
  const stored = Array.from(deps.storage.kits.values())[0];
  assert.equal(stored.name, 'Importé');
  assert.equal(stored.pads[4].seed, 104);
  assert.ok(Math.abs(stored.pads[4].samples[0] - 0.5) < 1e-3);
  assert.ok(deps.pads.els.every((el) => !el.disabled));
  assert.equal(statusLog.at(-1), MESSAGES.kitImported('Importé'));

  await lib.importKit({ name: 'bad.zip', bytes: new Uint8Array([1, 2, 3]) });
  assert.ok(statusLog.at(-1).startsWith(MESSAGES.kitImportError('').slice(0, 10)));
});

test('sans stockage, sauver et supprimer sont désactivés mais l\'export fonctionne', async () => {
  const { lib, kitBarCalls, downloads } = setup({ storage: null });
  const enabled = kitBarCalls.find((c) => c.enabled);
  assert.deepEqual(enabled.enabled, { save: false, delete: false });
  await lib.load({ name: 'x.wav' });
  await lib.exportKit();
  assert.equal(downloads.length, 1);
});

test('trigger joue un pad en polyphonie avec la vélocité et allume le pad ; noteOn passe par le mapping', async () => {
  const played = [];
  const { lib, deps } = setup({ polyPlayer: { play: (buf, opts) => { played.push(opts); opts.onStart(); }, stopAll: () => {} } });
  lib.trigger(0, 1);
  assert.equal(played.length, 0, 'rien sans buffer');
  await lib.load({ name: 'x.wav' });
  lib.trigger(2, 0.5);
  assert.equal(played.length, 1);
  assert.equal(played[0].voice, 2);
  assert.equal(played[0].gain, 0.5);
  assert.equal(deps.pads.els[2].classList.has('playing'), true);
  played[0].onStop();
  assert.equal(deps.pads.els[2].classList.has('playing'), false);
  lib.noteOn(55, 1);
  assert.equal(played.at(-1).voice, 19);
  lib.noteOn(60, 1);
  assert.equal(played.length, 2);
  assert.deepEqual(lib.notes.slice(0, 2), [36, 37]);
});

test('un kit chargé apporte ses notes au mapping', async () => {
  const played = [];
  const { lib, deps } = setup({ polyPlayer: { play: (buf, opts) => played.push(opts), stopAll: () => {} } });
  await deps.storage.put({ id: 'k', name: 'K', createdAt: 'x', pads: Array.from({ length: 20 }, (_, i) => ({ index: i, flavor: 'F', seed: 1, note: 60 + i, sampleRate: 8000, samples: new Float32Array([0, 0]) })) });
  await lib.loadKit('k');
  lib.noteOn(61, 1);
  assert.equal(played[0].voice, 1);
});

test('exportDaw télécharge <nom>.ableton.zip : Drum Rack .adg, .sfz et les WAV sous Samples/', async () => {
  const { lib, deps, downloads } = setup();
  await lib.exportDaw();
  assert.equal(downloads.length, 0, 'rien sans bibliothèque');
  await lib.load({ name: 'casserole.wav' });
  await lib.exportDaw();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].name, 'casserole.ableton.zip');
  const entries = await readZip(new Uint8Array(await downloads[0].blob.arrayBuffer()));
  const names = entries.map((e) => e.name);
  assert.equal(names[0], 'casserole.adg');
  assert.equal(names[1], 'casserole.sfz');
  assert.equal(names[2], 'Samples/01_BOOM.wav');
  assert.equal(names.length, 22);
  assert.deepEqual([entries[0].data[0], entries[0].data[1]], [0x1f, 0x8b]);
  const sfz = new TextDecoder().decode(entries[1].data);
  assert.match(sfz, /sample=Samples\/20_CHAOS\.wav\nkey=55/);
  assert.equal(deps.exportButton.disabled, false);
});

test('trigger transmet `when` au lecteur polyphonique', async () => {
  const played = [];
  const { lib } = setup({ polyPlayer: { play: (buf, opts) => { played.push(opts); opts.onStart(); }, stopAll: () => {} } });
  await lib.load({ name: 'x.wav' });
  lib.trigger(1, 0.8, 42);
  assert.equal(played[0].when, 42);
});

test('le motif est sauvegardé avec le kit, rechargé, exporté dans kit.json et importé', async () => {
  const { lib, downloads, deps } = setup();
  await lib.load({ name: 'x.wav' });
  lib.setSequence({ pattern: { steps: 16, tracks: Array.from({ length: 20 }, (_, i) => Uint8Array.from(Array(16).fill(i === 2 ? 100 : 0))) }, bpm: 140, swing: 0.25 });
  await lib.saveKit();
  const saved = (await deps.storage.list())[0];
  const rec = await deps.storage.get(saved.id);
  assert.equal(rec.pattern.bpm, 140);
  assert.equal(rec.pattern.tracks[2][0], 100);
  lib.setSequence({ pattern: { steps: 16, tracks: Array.from({ length: 20 }, () => new Uint8Array(16)) }, bpm: 120, swing: 0 });
  await lib.loadKit(saved.id);
  assert.equal(lib.sequence().bpm, 140);
  assert.equal(lib.sequence().pattern.tracks[2][0], 100);
  await lib.exportKit();
  const entries = await readZip(new Uint8Array(await downloads[0].blob.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(entries[0].data));
  assert.equal(manifest.pattern.bpm, 140);
  lib.setSequence({ pattern: { steps: 16, tracks: Array.from({ length: 20 }, () => new Uint8Array(16)) }, bpm: 120, swing: 0 });
  await lib.importKit({ name: 'x.kit.zip', bytes: new Uint8Array(await downloads[0].blob.arrayBuffer()) });
  assert.equal(lib.sequence().bpm, 140);
  assert.equal(lib.sequence().pattern.tracks[2][0], 100);
});
