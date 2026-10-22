// Composition : câble le cœur DSP, la couche Web Audio et l'interface.
import { analyzeSamples } from './core/analysis.js';
import { createLiveContext } from './audio/context.js';
import { makeReversedBuffer } from './audio/buffers.js';
import { createRenderer } from './audio/renderer.js';
import { createPlayer } from './audio/player.js';
import { createPolyPlayer } from './audio/polyplayer.js';
import { createMidiAccess } from './midi/access.js';
import { bindKeyboard } from './ui/keyboard.js';
import { queryElements } from './ui/dom.js';
import { createPadGrid } from './ui/pads.js';
import { drawWaveform } from './ui/waveform.js';
import { bindDropzone } from './ui/dropzone.js';
import { initParallax } from './ui/parallax.js';
import { downloadBlob } from './ui/download.js';
import { createKitBar } from './ui/kitbar.js';
import { createKitStore } from './storage/kits.js';
import { MESSAGES } from './ui/messages.js';
import { createLibrary } from './library.js';

const PAD_COUNT = 20;
// injecté par scripts/build.mjs (define) ; valeur de repli pour un import direct
const BUILD_VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

function readAsArrayBuffer(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (e) { resolve(e.target.result); };
    reader.onerror = function () { reject(reader.error); };
    reader.readAsArrayBuffer(file);
  });
}

function start(doc, win) {
  const el = queryElements(doc);
  initParallax(el.win, win, doc);

  const liveCtx = createLiveContext(win);
  const pads = createPadGrid(el.padGrid, doc, PAD_COUNT);

  const library = createLibrary({
    padCount: PAD_COUNT,
    pads,
    status: { set: function (t) { el.statusText.textContent = t; } },
    fileLabel: { set: function (t) { el.dzFile.textContent = t; } },
    exportButton: el.btnExportAll,
    renderer: createRenderer(),
    player: createPlayer(function () { return liveCtx.get(); }),
    polyPlayer: createPolyPlayer(function () { return liveCtx.get(); }),
    warmUpAudio: function () { liveCtx.get(); },
    readFile: readAsArrayBuffer,
    decode: function (ab) { return liveCtx.get().decodeAudioData(ab); },
    prepareSample: function (buffer) {
      return {
        originalBuffer: buffer,
        reversedBuffer: makeReversedBuffer(buffer),
        analysis: analyzeSamples(buffer.getChannelData(0), buffer.sampleRate),
      };
    },
    draw: drawWaveform,
    download: function (blob, name) { downloadBlob(doc, blob, name); },
    storage: createKitStore(win.indexedDB),
    kitBar: createKitBar(el, doc),
    promptName: function (defaultName) { return win.prompt(MESSAGES.kitNamePrompt, defaultName); },
    createBuffer: function (samples, sampleRate) {
      const buf = liveCtx.get().createBuffer(1, samples.length, sampleRate);
      buf.copyToChannel(samples, 0);
      return buf;
    },
    version: BUILD_VERSION,
  });

  bindDropzone(el, function (file) { library.load(file); });
  pads.els.forEach(function (btn, idx) {
    btn.addEventListener('mouseenter', function () { library.hover(idx); });
    btn.addEventListener('click', function () { library.click(idx); });
  });
  el.btnExportAll.addEventListener('click', function () { library.exportKit(); });
  el.btnSaveKit.addEventListener('click', function () { library.saveKit(); });
  el.btnDeleteKit.addEventListener('click', function () { library.deleteKit(); });
  el.kitSelect.addEventListener('change', function () { liveCtx.get(); library.loadKit(el.kitSelect.value); });
  // clavier de l'ordinateur et MIDI
  bindKeyboard(doc, function (idx) { liveCtx.get(); library.trigger(idx, 1); });
  const midi = createMidiAccess(win.navigator);
  function setStatus(t) { el.statusText.textContent = t; }
  function refreshMidiInputs() {
    const inputs = midi.inputs();
    el.midiSelect.textContent = '';
    const all = doc.createElement('option');
    all.value = 'all';
    all.textContent = MESSAGES.midiAllInputs;
    el.midiSelect.appendChild(all);
    inputs.forEach(function (i) {
      const opt = doc.createElement('option');
      opt.value = i.id;
      opt.textContent = i.name;
      el.midiSelect.appendChild(opt);
    });
    el.midiSelect.hidden = false;
    setStatus(inputs.length ? MESSAGES.midiReady(inputs.length) : MESSAGES.midiNoInput);
  }
  if (!midi.isSupported()) {
    el.btnMidi.disabled = true;
    el.btnMidi.title = MESSAGES.midiUnsupported;
  }
  midi.onNote(function (note, velocity) { library.noteOn(note, velocity); });
  midi.onPortsChanged(refreshMidiInputs);
  el.btnMidi.addEventListener('click', async function () {
    liveCtx.get();
    const ok = await midi.init();
    if (!ok) { setStatus(midi.isSupported() ? MESSAGES.midiRefused : MESSAGES.midiUnsupported); return; }
    el.btnMidi.classList.add('on');
    el.btnMidi.disabled = true;
    refreshMidiInputs();
  });
  el.midiSelect.addEventListener('change', function () { midi.setInput(el.midiSelect.value); });
  el.btnImportKit.addEventListener('click', function () { el.kitInput.value = ''; el.kitInput.click(); });
  el.kitInput.addEventListener('change', function () {
    liveCtx.get();
    if (el.kitInput.files && el.kitInput.files[0]) library.importKit(el.kitInput.files[0]);
  });
}

start(document, window);
