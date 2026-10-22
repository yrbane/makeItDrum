// Orchestration de la bibliothèque de percussions : import du son, rendu des
// pads, lecture, export. Ne connaît ni le DOM ni Web Audio directement : tout
// arrive par injection, ce qui permet de tester les enchaînements avec des
// doubles.
import { flavorAt } from './core/flavors.js';
import { encodeWav } from './core/wav.js';
import { buildZip } from './core/zip.js';
import { MESSAGES } from './ui/messages.js';

export function createLibrary({
  padCount, pads, status, fileLabel, exportButton,
  renderer, player, warmUpAudio, readFile, decode, prepareSample, draw, download,
}) {
  let sample = null; // { originalBuffer, reversedBuffer, analysis }
  const buffers = new Array(padCount).fill(null);
  const busy = new Array(padCount).fill(false);

  // suivi visuel de la lecture : classe `playing` sur le pad en cours
  function playingListener(padEl) {
    return {
      onStart: () => padEl.classList.add('playing'),
      onStop: () => padEl.classList.remove('playing'),
    };
  }

  async function generate(idx, autoplay) {
    if (!sample || busy[idx]) return;
    player.stop();
    busy[idx] = true;
    const padEl = pads.els[idx];
    padEl.classList.add('playing');
    try {
      const buf = await renderer.render(flavorAt(idx), sample);
      buffers[idx] = buf;
      draw(pads.canvases[idx], buf.getChannelData(0));
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
    fileLabel.set('✓ ' + file.name);
    pads.els.forEach(function (el) { el.disabled = false; });
    await regenerateAll();
  }

  function hover(idx) {
    if (!sample || busy[idx]) return;
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

  async function exportZip() {
    if (buffers.some(function (b) { return !b; })) {
      status.set(MESSAGES.waitForGeneration);
      return;
    }
    exportButton.disabled = true;
    status.set(MESSAGES.zipPreparing);
    try {
      const files = buffers.map(function (buf, i) {
        return {
          name: 'makeitdrum_' + String(i + 1).padStart(2, '0') + '.wav',
          data: new Uint8Array(encodeWav(buf.getChannelData(0), buf.sampleRate)),
        };
      });
      const zip = buildZip(files);
      download(new Blob([zip], { type: 'application/zip' }), 'makeitdrum_pack.zip');
      status.set(MESSAGES.zipDone);
    } catch (err) {
      console.error(err);
      status.set(MESSAGES.zipError);
    }
    exportButton.disabled = false;
  }

  return { load, generate, regenerateAll, play, hover, click, exportZip, buffers };
}
