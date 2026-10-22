// Orchestration de la bibliothèque de percussions : import du son, rendu des
// pads (chacun avec sa graine), lecture, kits (export, sauvegarde, chargement,
// import). Ne connaît ni le DOM ni Web Audio directement : tout arrive par
// injection, ce qui permet de tester les enchaînements avec des doubles.
import { flavorAt } from './core/flavors.js';
import { createRandom } from './core/random.js';
import { mulberry32, randomSeed } from './core/prng.js';
import { buildZip, readZip } from './core/zip.js';
import { packKit, unpackKit, BASE_NOTE } from './core/kit.js';
import { MESSAGES } from './ui/messages.js';

function stem(fileName) {
  return String(fileName || '').replace(/\.kit\.zip$/i, '').replace(/\.[^.]+$/, '') || 'makeitdrum';
}

export function createLibrary({
  padCount, pads, status, fileLabel, exportButton,
  renderer, player, warmUpAudio, readFile, decode, prepareSample, draw, download,
  storage = null, kitBar = null, promptName = () => null, createBuffer = null,
  version = '', now = () => new Date().toISOString(), random = Math.random,
  newId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
}) {
  let sample = null; // { originalBuffer, reversedBuffer, analysis }
  let sourceMeta = null; // { fileName, sampleRate, duration }
  let currentKit = null; // { id, name } du kit sauvegardé affiché
  const buffers = new Array(padCount).fill(null);
  const seeds = new Array(padCount).fill(null);
  const busy = new Array(padCount).fill(false);

  function playingListener(padEl) {
    return {
      onStart: () => padEl.classList.add('playing'),
      onStop: () => padEl.classList.remove('playing'),
    };
  }

  function ready() {
    return buffers.every(function (b) { return b; });
  }

  function kitName() {
    return currentKit ? currentKit.name : stem(sourceMeta && sourceMeta.fileName);
  }

  async function refreshKits() {
    if (!kitBar) return;
    const list = storage ? await storage.list() : [];
    kitBar.setKits(list, currentKit ? currentKit.id : null);
  }

  function setCurrentKit(kit) {
    currentKit = kit;
    return refreshKits();
  }

  function enableAll() {
    pads.els.forEach(function (el) { el.disabled = false; });
    exportButton.disabled = false;
  }

  function padsRecord() {
    return buffers.map(function (buf, i) {
      return {
        index: i,
        flavor: flavorAt(i).name,
        seed: seeds[i],
        note: BASE_NOTE + i,
        sampleRate: buf.sampleRate,
        samples: Float32Array.from(buf.getChannelData(0)),
      };
    });
  }

  async function generate(idx, autoplay) {
    if (!sample || busy[idx]) return;
    player.stop();
    busy[idx] = true;
    const padEl = pads.els[idx];
    padEl.classList.add('playing');
    try {
      const seed = randomSeed(random);
      const buf = await renderer.render(flavorAt(idx), sample, createRandom(mulberry32(seed)));
      seeds[idx] = seed;
      buffers[idx] = buf;
      draw(pads.canvases[idx], buf.getChannelData(0));
      if (currentKit) await setCurrentKit(null);
      if (autoplay) {
        player.play(buf, playingListener(padEl));
      } else {
        padEl.classList.remove('playing');
      }
    } catch (err) {
      console.error(err);
      status.set(MESSAGES.renderError);
      padEl.classList.remove('playing');
    }
    busy[idx] = false;
  }

  async function regenerateAll() {
    exportButton.disabled = true;
    for (let i = 0; i < padCount; i++) {
      status.set(MESSAGES.generating(i + 1, padCount));
      await generate(i, false);
    }
    status.set(MESSAGES.libraryReady);
    exportButton.disabled = false;
  }

  function play(idx) {
    if (!buffers[idx]) return;
    player.play(buffers[idx], playingListener(pads.els[idx]));
  }

  // le contexte audio est réveillé synchroniquement, dans le geste utilisateur
  async function load(file) {
    warmUpAudio();
    let arrayBuffer;
    try {
      arrayBuffer = await readFile(file);
    } catch (err) {
      status.set(MESSAGES.readError);
      return;
    }
    let buffer;
    try {
      buffer = await decode(arrayBuffer);
    } catch (err) {
      console.error(err);
      status.set(MESSAGES.decodeError);
      return;
    }
    sample = prepareSample(buffer);
    sourceMeta = { fileName: file.name, sampleRate: buffer.sampleRate, duration: buffer.duration };
    fileLabel.set('✓ ' + file.name);
    pads.els.forEach(function (el) { el.disabled = false; });
    await regenerateAll();
  }

  function hover(idx) {
    if (!buffers[idx] || busy[idx]) return;
    play(idx);
  }

  function click(idx) {
    if (!sample) {
      status.set(MESSAGES.importFirst);
      return;
    }
    status.set(MESSAGES.variationInProgress);
    return generate(idx, true).then(function () {
      status.set(MESSAGES.padReady(idx));
    });
  }

  // --- kits -----------------------------------------------------------------

  async function exportKit() {
    if (!ready()) {
      status.set(MESSAGES.waitForGeneration);
      return;
    }
    exportButton.disabled = true;
    status.set(MESSAGES.zipPreparing);
    try {
      const name = kitName();
      const files = packKit({ name, engineVersion: version, createdAt: now(), source: sourceMeta, pads: padsRecord() });
      download(new Blob([buildZip(files)], { type: 'application/zip' }), name + '.kit.zip');
      status.set(MESSAGES.kitExported(name));
    } catch (err) {
      console.error(err);
      status.set(MESSAGES.zipError);
    }
    exportButton.disabled = false;
  }

  async function saveKit() {
    if (!ready()) {
      status.set(MESSAGES.waitForGeneration);
      return;
    }
    if (!storage) {
      status.set(MESSAGES.storageUnavailable);
      return;
    }
    const name = promptName(kitName());
    if (!name) return;
    const kit = { id: newId(), name: name.trim() || kitName(), createdAt: now(), engineVersion: version, source: sourceMeta, pads: padsRecord() };
    await storage.put(kit);
    await setCurrentKit({ id: kit.id, name: kit.name });
    status.set(MESSAGES.kitSaved(kit.name));
  }

  // remplace les buffers par ceux d'un kit : instantané, sans rendu
  function applyKit(kit) {
    player.stop();
    kit.pads.forEach(function (p) {
      if (p.index >= padCount) return;
      const buf = createBuffer(p.samples, p.sampleRate);
      buffers[p.index] = buf;
      seeds[p.index] = p.seed;
      draw(pads.canvases[p.index], buf.getChannelData(0));
    });
    enableAll();
  }

  async function loadKit(id) {
    if (!id || !storage) return;
    const kit = await storage.get(id);
    if (!kit) {
      status.set(MESSAGES.kitMissing);
      await setCurrentKit(null);
      return;
    }
    applyKit(kit);
    await setCurrentKit({ id: kit.id, name: kit.name });
    status.set(MESSAGES.kitLoaded(kit.name));
  }

  async function deleteKit() {
    if (!currentKit || !storage) {
      status.set(MESSAGES.noKitSelected);
      return;
    }
    const name = currentKit.name;
    await storage.remove(currentKit.id);
    await setCurrentKit(null);
    status.set(MESSAGES.kitDeleted(name));
  }

  async function importKit(file) {
    try {
      const bytes = new Uint8Array(await readFile(file));
      const unpacked = unpackKit(await readZip(bytes), stem(file.name));
      const padsOut = [];
      for (const p of unpacked.pads) {
        const buf = await decode(p.wav.buffer.slice(p.wav.byteOffset, p.wav.byteOffset + p.wav.byteLength));
        padsOut.push({ index: p.index, flavor: p.flavor, seed: p.seed, note: p.note, sampleRate: buf.sampleRate, samples: Float32Array.from(buf.getChannelData(0)) });
      }
      const kit = { id: newId(), name: unpacked.name, createdAt: now(), engineVersion: unpacked.engineVersion, source: unpacked.source, pads: padsOut };
      applyKit(kit);
      if (storage) {
        await storage.put(kit);
        await setCurrentKit({ id: kit.id, name: kit.name });
      }
      status.set(MESSAGES.kitImported(kit.name));
    } catch (err) {
      console.error(err);
      status.set(MESSAGES.kitImportError(err && err.message ? err.message : String(err)));
    }
  }

  if (kitBar) {
    kitBar.setEnabled({ save: !!storage, delete: !!storage });
    refreshKits();
  }

  return { load, generate, regenerateAll, play, hover, click, exportKit, saveKit, loadKit, deleteKit, importKit, refreshKits, buffers, seeds };
}
