// Golden master : la version d'origine (tag v1.0.1) et dist/index.html rendent
// les 20 pads dans le même Chromium, avec le même Math.random seedé et le même
// WAV d'entrée. Deux niveaux de comparaison :
//  1. la TRACE du graphe Web Audio (nœuds créés, paramètres, courbes, buffers,
//     connexions, départs) doit être strictement identique : c'est la preuve
//     que le refactor construit le même traitement avec les mêmes tirages ;
//  2. les buffers rendus doivent coïncider à une tolérance près : Chromium
//     somme les entrées multiples d'un nœud dans un ordre non déterministe ;
//     la saturation amplifie ces écarts de l'ordre de 1e-7 jusqu'à ~2e-3, et
//     sur les pads bitcrushés un échantillon peut basculer d'un pas de
//     quantification (1/32 à 5 bits, × gain de normalisation ≈ 1,8e-2 mesuré
//     sur le pad 20). Mesure : GOLDEN_SELF=1 compare l'original à lui-même.
//     L'écart max tolère ce basculement isolé ; le RMS relatif (mesuré
//     ≤ 1,7e-3, seuil 1e-2) est le vrai discriminant d'un changement de son.
// Le ZIP exporté est comparé sur sa structure (entrées, tailles, en-têtes WAV),
// le DOM, le texte visible et le CSS à l'identique.
import puppeteer from 'puppeteer-core';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const SEED = 123456;
const MAX_ABS_DIFF = 0.1; // un pas de quantification à 5 bits × gain de normalisation (≤ ~3), basculement isolé
const MAX_REL_RMS = 1e-2; // énergie de l'écart ≤ 1 % de celle du signal (mesuré ≤ 1,7e-3 entre deux rendus de l'original)
const REFERENCE_TAG = 'v1.0.1';

function path(rel) { return fileURLToPath(new URL(rel, ROOT)); }

// Shims installés avant tout script de la page : PRNG seedé, trace du graphe
// Web Audio, capture des rendus et du Blob exporté, téléchargement neutralisé.
function installShims(seed) {
  let a = seed >>> 0;
  Math.random = function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const trace = [];
  window.__trace = trace;
  const ids = new WeakMap();
  let counter = 0;
  function id(obj) {
    if (!ids.has(obj)) ids.set(obj, 'n' + (++counter));
    return ids.get(obj);
  }
  function checksum(f32) {
    const b = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    let h = 2166136261;
    for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16);
  }
  function fmt(v) {
    if (typeof v === 'number') return String(v);
    if (v instanceof Float32Array) return 'f32[' + v.length + ':' + checksum(v) + ']';
    if (v instanceof AudioBuffer) {
      let s = '';
      for (let ch = 0; ch < v.numberOfChannels; ch++) s += checksum(v.getChannelData(ch)) + ',';
      return 'buf[' + v.length + '@' + v.sampleRate + ':' + s + ']';
    }
    if (v instanceof AudioNode) return id(v);
    if (v instanceof AudioParam) return paramIds.get(v) || 'param?';
    return String(v);
  }
  const paramIds = new WeakMap();
  const PARAM_NAMES = ['gain', 'frequency', 'Q', 'detune', 'playbackRate', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release'];
  function tagParams(node) {
    const nid = id(node);
    for (const name of PARAM_NAMES) {
      if (node[name] instanceof AudioParam) paramIds.set(node[name], nid + '.' + name);
    }
  }

  const OriginalOffline = OfflineAudioContext;
  window.OfflineAudioContext = function (channels, length, sampleRate) {
    const ctx = new OriginalOffline(channels, length, sampleRate);
    trace.push('ctx ' + id(ctx) + ' ' + channels + ' ' + length + ' ' + sampleRate);
    return ctx;
  };
  for (const name of ['createGain', 'createBufferSource', 'createBiquadFilter', 'createWaveShaper',
    'createOscillator', 'createDelay', 'createConvolver', 'createDynamicsCompressor', 'createBuffer']) {
    const original = BaseAudioContext.prototype[name];
    BaseAudioContext.prototype[name] = function (...args) {
      const result = original.apply(this, args);
      trace.push(name + ' ' + id(result) + ' ' + args.map(fmt).join(' '));
      if (result instanceof AudioNode) tagParams(result);
      return result;
    };
  }
  const valueDesc = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value');
  Object.defineProperty(AudioParam.prototype, 'value', {
    get: valueDesc.get,
    set(v) { trace.push('set ' + fmt(this) + ' ' + fmt(v)); valueDesc.set.call(this, v); },
  });
  for (const name of ['setValueAtTime', 'linearRampToValueAtTime', 'setValueCurveAtTime']) {
    const original = AudioParam.prototype[name];
    AudioParam.prototype[name] = function (...args) {
      trace.push(name + ' ' + fmt(this) + ' ' + args.map(fmt).join(' '));
      return original.apply(this, args);
    };
  }
  for (const [proto, prop] of [[AudioBufferSourceNode.prototype, 'buffer'], [ConvolverNode.prototype, 'buffer'],
    [WaveShaperNode.prototype, 'curve'], [WaveShaperNode.prototype, 'oversample'],
    [BiquadFilterNode.prototype, 'type'], [OscillatorNode.prototype, 'type']]) {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    Object.defineProperty(proto, prop, {
      get: desc.get,
      set(v) { trace.push('prop ' + id(this) + '.' + prop + ' ' + fmt(v)); desc.set.call(this, v); },
    });
  }
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (...args) {
    trace.push('connect ' + id(this) + ' -> ' + args.map(fmt).join(' '));
    return connect.apply(this, args);
  };
  for (const name of ['start', 'stop']) {
    const original = AudioScheduledSourceNode.prototype[name];
    AudioScheduledSourceNode.prototype[name] = function (...args) {
      trace.push(name + ' ' + id(this) + ' ' + args.map(fmt).join(' '));
      return original.apply(this, args);
    };
  }

  window.__rendered = [];
  const startRendering = OriginalOffline.prototype.startRendering;
  OriginalOffline.prototype.startRendering = function () {
    trace.push('startRendering ' + id(this));
    return startRendering.call(this).then(function (buf) { window.__rendered.push(buf); return buf; });
  };

  window.__lastBlob = null;
  const createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function (blob) { window.__lastBlob = blob; return createObjectURL(blob); };
  HTMLAnchorElement.prototype.click = function () {};
}

async function injectFixture(page, wavBase64) {
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'fixture.wav', { type: 'audio/wav' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById('fileInput');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, wavBase64);
}

async function waitForStatus(page, text) {
  await page.waitForFunction(
    (t) => document.getElementById('statusText').textContent.startsWith(t),
    { timeout: 120000 },
    text,
  );
}

async function collect(page) {
  return page.evaluate(async () => {
    const toBase64 = (f32) => {
      const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const pads = window.__rendered.map((buf) => ({ length: buf.length, sampleRate: buf.sampleRate, data: toBase64(buf.getChannelData(0)) }));
    // structure du zip : entrées locales (nom, taille, en-tête WAV de 44 octets)
    const zip = new Uint8Array(await window.__lastBlob.arrayBuffer());
    const view = new DataView(zip.buffer);
    const entries = [];
    let off = 0;
    while (off + 30 <= zip.length && view.getUint32(off, true) === 0x04034b50) {
      const size = view.getUint32(off + 18, true);
      const nameLen = view.getUint16(off + 26, true);
      const name = new TextDecoder().decode(zip.subarray(off + 30, off + 30 + nameLen));
      const dataStart = off + 30 + nameLen;
      const header = Array.from(zip.subarray(dataStart, dataStart + 44), (b) => b.toString(16).padStart(2, '0')).join('');
      entries.push(name + ':' + size + ':' + header);
      off = dataStart + size;
    }
    const fingerprint = Array.from(document.querySelectorAll('body *'))
      .filter((e) => e.tagName !== 'SCRIPT')
      .map((e) => `${e.tagName}.${e.className}#${e.id}`).join('\n');
    return {
      pads, trace: window.__trace, zipEntries: entries, zipSize: zip.length,
      text: document.body.innerText, fingerprint,
      style: document.querySelector('style').textContent,
    };
  });
}

async function run(browser, htmlPath, wavBase64) {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(installShims, SEED);
  await page.goto('file://' + htmlPath);
  await injectFixture(page, wavBase64);
  await waitForStatus(page, 'Bibliothèque prête');
  await page.click('#btnExportAll');
  await waitForStatus(page, 'Pack téléchargé');
  const result = await collect(page);
  await page.close();
  return result;
}

function decode(b64) {
  const bytes = Buffer.from(b64, 'base64');
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
}

function normalizeVersion(s) { return s.replace(/v\d+\.\d+\.\d+/g, 'vX'); }

function compareTrace(ref, cur) {
  const n = Math.min(ref.length, cur.length);
  for (let i = 0; i < n; i++) {
    if (ref[i] !== cur[i]) {
      return `trace divergente à l'entrée ${i} (sur ${ref.length}/${cur.length}) :\n     original : ${ref[i]}\n     dist     : ${cur[i]}\n     contexte : ${ref.slice(Math.max(0, i - 3), i).join(' | ')}`;
    }
  }
  if (ref.length !== cur.length) return `trace de longueur différente : ${ref.length} vs ${cur.length}`;
  return null;
}

function comparePads(ref, cur, failures) {
  console.log('pad | longueur | écart max | RMS relatif');
  for (let i = 0; i < Math.max(ref.length, cur.length); i++) {
    const r = ref[i];
    const c = cur[i];
    if (!r || !c || r.length !== c.length) {
      failures.push(`pad ${i + 1} : longueur ${r && r.length} vs ${c && c.length}`);
      continue;
    }
    const a = decode(r.data);
    const b = decode(c.data);
    let max = 0;
    let sumDiff = 0;
    let sumRef = 0;
    for (let k = 0; k < a.length; k++) {
      const d = a[k] - b[k];
      const ad = Math.abs(d);
      if (ad > max) max = ad;
      sumDiff += d * d;
      sumRef += a[k] * a[k];
    }
    const relRms = sumRef > 0 ? Math.sqrt(sumDiff / sumRef) : 0;
    console.log(`${String(i + 1).padStart(3)} | ${String(r.length).padStart(8)} | ${max.toExponential(2)} | ${relRms.toExponential(2)}`);
    if (max > MAX_ABS_DIFF || relRms > MAX_REL_RMS) failures.push(`pad ${i + 1} : écart max ${max}, RMS relatif ${relRms}`);
  }
}

function compare(ref, cur) {
  const failures = [];
  const traceDiff = compareTrace(ref.trace, cur.trace);
  if (traceDiff) failures.push(traceDiff);
  else console.log(`trace du graphe identique : ${ref.trace.length} opérations Web Audio`);
  comparePads(ref.pads, cur.pads, failures);
  if (ref.zipSize !== cur.zipSize || ref.zipEntries.join('\n') !== cur.zipEntries.join('\n')) {
    failures.push(`zip : structure différente (${ref.zipEntries.length} vs ${cur.zipEntries.length} entrées, ${ref.zipSize} vs ${cur.zipSize} octets)`);
  }
  if (normalizeVersion(ref.text) !== normalizeVersion(cur.text)) failures.push('texte visible différent');
  if (normalizeVersion(ref.fingerprint) !== normalizeVersion(cur.fingerprint)) failures.push('structure DOM différente');
  if (ref.style !== cur.style) failures.push('CSS différent');
  return failures;
}

const goldenDir = path('dist/.golden/');
mkdirSync(goldenDir, { recursive: true });
const originalPath = goldenDir + 'original.html';
writeFileSync(originalPath, execFileSync('git', ['show', `${REFERENCE_TAG}:index.html`], { cwd: ROOT }));
const wavBase64 = readFileSync(path('tests/fixtures/fixture.wav')).toString('base64');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
try {
  // GOLDEN_SELF=1 : l'original contre lui-même, pour mesurer le non-déterminisme du moteur
  const candidate = process.env.GOLDEN_SELF ? originalPath : path('dist/index.html');
  const ref = await run(browser, originalPath, wavBase64);
  const cur = await run(browser, candidate, wavBase64);
  const failures = compare(ref, cur);
  console.log(`zip : ${cur.zipEntries.length} entrées, ${cur.zipSize} octets`);
  if (failures.length) {
    console.error('GOLDEN KO\n - ' + failures.join('\n - '));
    process.exitCode = 1;
  } else {
    console.log('GOLDEN OK — même graphe Web Audio, 20 pads équivalents, zip/DOM/CSS identiques');
  }
} finally {
  await browser.close();
}
