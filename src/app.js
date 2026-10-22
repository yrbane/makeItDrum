// Composition : câble le cœur DSP, la couche Web Audio et l'interface.
import { analyzeSamples } from './core/analysis.js';
import { createLiveContext } from './audio/context.js';
import { makeReversedBuffer } from './audio/buffers.js';
import { createRenderer } from './audio/renderer.js';
import { createPlayer } from './audio/player.js';
import { createPolyPlayer } from './audio/polyplayer.js';
import { createMidiAccess } from './midi/access.js';
import { bindKeyboard } from './ui/keyboard.js';
import { createStepGrid } from './ui/stepgrid.js';
import { createScheduler } from './audio/scheduler.js';
import { createMidiOut } from './midi/out.js';
import { createPattern, toggleStep } from './core/sequencer.js';
import { flavorAt } from './core/flavors.js';
import { createBridgeClient } from './bridge/client.js';
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
  const bridge = createBridgeClient(function (url, opts) { return win.fetch(url, opts); });
  const pads = createPadGrid(el.padGrid, doc, PAD_COUNT);

  const library = createLibrary({
    padCount: PAD_COUNT,
    pads,
    status: { set: function (t) { el.statusText.textContent = t; } },
    fileLabel: { set: function (t) { el.dzFile.textContent = t; } },
    // les deux boutons d'export suivent le même état
    exportButton: {
      get disabled() { return el.btnExportAll.disabled; },
      set disabled(v) { el.btnExportAll.disabled = v; el.btnExportDaw.disabled = v; el.btnPlay.disabled = v; el.btnSendLive.disabled = v; },
    },
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
    bridge: bridge,
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
  el.btnExportDaw.addEventListener('click', function () { library.exportDaw(); });
  el.btnSendLive.addEventListener('click', function () { library.sendToLive(); });
  // compagnon local « makeitdrum-bridge » : s'il répond, le bouton « ENVOYER DANS LIVE » apparaît
  bridge.health().then(function (info) {
    if (!info) return;
    el.btnSendLive.hidden = false;
    el.btnSendLive.title += ' — v' + info.version + ' · ' + info.userLibrary;
    if (el.statusText.textContent === MESSAGES.importFirst || /^Importer un son/.test(el.statusText.textContent)) el.statusText.textContent = MESSAGES.liveFound;
  });
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
    const outputs = midi.outputs();
    const current = el.midiOutSelect.value;
    el.midiOutSelect.textContent = '';
    const none = doc.createElement('option');
    none.value = '';
    none.textContent = MESSAGES.midiNoOutput;
    el.midiOutSelect.appendChild(none);
    outputs.forEach(function (o) {
      const opt = doc.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      el.midiOutSelect.appendChild(opt);
    });
    el.midiOutSelect.value = outputs.some(function (o) { return o.id === current; }) ? current : '';
    el.midiOutSelect.disabled = false;
    midi.setOutput(el.midiOutSelect.value);
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
  el.midiOutSelect.addEventListener('change', function () { midi.setOutput(el.midiOutSelect.value); });

  // --- séquenceur : grille, planificateur, sortie MIDI + horloge
  const grid = createStepGrid(el.stepGrid, doc, {
    tracks: PAD_COUNT, steps: 16,
    labels: Array.from({ length: PAD_COUNT }, function (_, i) { return String(i + 1).padStart(2, '0') + ' ' + flavorAt(i).name; }),
    onToggle: function (track, step) {
      const s = library.sequence();
      library.setSequence({ pattern: toggleStep(s.pattern, track, step) });
      grid.render(library.sequence().pattern);
    },
  });
  grid.render(library.sequence().pattern);
  const midiOut = createMidiOut({
    getOutput: function () { return midi.output(); },
    toTimestamp: function (t) { return win.performance.now() + (t - liveCtx.get().currentTime) * 1000; },
  });
  const scheduler = createScheduler({
    getContext: function () { return liveCtx.get(); },
    getPattern: function () { return library.sequence().pattern; },
    getSettings: function () { return library.sequence(); },
    onEvent: function (ev) {
      library.trigger(ev.track, ev.velocity / 127, ev.time);
      midiOut.noteOn(library.notes[ev.track], ev.velocity / 127, ev.time);
    },
    onWindow: function (from, to, origin) { if (el.chkClock.checked) midiOut.clockTicks(from, to, library.sequence().bpm, origin); },
    onStep: function (step) { grid.setPlayhead(step); },
    setInterval: function (fn, ms) { return win.setInterval(fn, ms); },
    clearInterval: function (id) { win.clearInterval(id); },
  });
  function syncTransport() {
    const s = library.sequence();
    el.bpmInput.value = s.bpm;
    el.swingInput.value = Math.round(s.swing * 100);
    el.swingValue.textContent = Math.round(s.swing * 100) + ' %';
    grid.render(s.pattern);
  }
  el.bpmInput.addEventListener('change', function () {
    const bpm = Math.min(240, Math.max(40, Number(el.bpmInput.value) || 120));
    library.setSequence({ bpm: bpm });
    syncTransport();
  });
  el.swingInput.addEventListener('input', function () {
    library.setSequence({ swing: Number(el.swingInput.value) / 100 });
    el.swingValue.textContent = el.swingInput.value + ' %';
  });
  el.btnClear.addEventListener('click', function () {
    library.setSequence({ pattern: createPattern(PAD_COUNT) });
    grid.render(library.sequence().pattern);
    setStatus(MESSAGES.seqCleared);
  });
  el.btnPlay.addEventListener('click', function () {
    if (scheduler.isRunning()) {
      scheduler.stop();
      midiOut.stop();
      el.btnPlay.textContent = '▶ PLAY';
      el.btnPlay.classList.remove('on');
      setStatus(MESSAGES.seqStopped);
      return;
    }
    liveCtx.get();
    scheduler.start();
    if (el.chkClock.checked) midiOut.start(scheduler.origin());
    el.btnPlay.textContent = '■ STOP';
    el.btnPlay.classList.add('on');
    setStatus(MESSAGES.seqPlaying(library.sequence().bpm));
  });
  el.kitSelect.addEventListener('change', syncTransport);
  el.kitInput.addEventListener('change', function () { win.setTimeout(syncTransport, 500); });
  el.btnImportKit.addEventListener('click', function () { el.kitInput.value = ''; el.kitInput.click(); });
  el.kitInput.addEventListener('change', function () {
    liveCtx.get();
    if (el.kitInput.files && el.kitInput.files[0]) library.importKit(el.kitInput.files[0]);
  });
}

start(document, window);
