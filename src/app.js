// Composition : câble le cœur DSP, la couche Web Audio et l'interface.
import { createRandom } from './core/random.js';
import { analyzeSamples } from './core/analysis.js';
import { createLiveContext } from './audio/context.js';
import { makeReversedBuffer } from './audio/buffers.js';
import { createRenderer } from './audio/renderer.js';
import { createPlayer } from './audio/player.js';
import { queryElements } from './ui/dom.js';
import { createPadGrid } from './ui/pads.js';
import { drawWaveform } from './ui/waveform.js';
import { bindDropzone } from './ui/dropzone.js';
import { initParallax } from './ui/parallax.js';
import { downloadBlob } from './ui/download.js';
import { createLibrary } from './library.js';

const PAD_COUNT = 20;

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

  const rng = createRandom();
  const liveCtx = createLiveContext(win);
  const pads = createPadGrid(el.padGrid, doc, PAD_COUNT);

  const library = createLibrary({
    padCount: PAD_COUNT,
    pads,
    status: { set: function (t) { el.statusText.textContent = t; } },
    fileLabel: { set: function (t) { el.dzFile.textContent = t; } },
    exportButton: el.btnExportAll,
    renderer: createRenderer({ rng }),
    player: createPlayer(function () { return liveCtx.get(); }),
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
  });

  bindDropzone(el, function (file) { library.load(file); });
  pads.els.forEach(function (btn, idx) {
    btn.addEventListener('mouseenter', function () { library.hover(idx); });
    btn.addEventListener('click', function () { library.click(idx); });
  });
  el.btnExportAll.addEventListener('click', function () { library.exportZip(); });
}

start(document, window);
