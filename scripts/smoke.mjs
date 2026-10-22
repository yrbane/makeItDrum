// Smoke E2E sur dist/index.html dans Chromium headless :
//  - un fichier illisible affiche le message d'erreur et laisse les pads désactivés ;
//  - le WAV de référence active les 20 pads, sans erreur console (hors favicon) ;
//  - sauver un kit le liste dans le select, l'export produit un .kit.zip avec kit.json,
//    un rechargement de la page retrouve le kit et le charge sans rendu.
import puppeteer from 'puppeteer-core';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBridgeServer } from '../tools/bridge/server.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const DECODE_ERROR = 'Impossible de lire ce fichier — essaie un .wav ou .mp3';

function path(rel) { return fileURLToPath(new URL(rel, ROOT)); }

async function inject(page, bytesBase64, name, type) {
  await page.evaluate((b64, fileName, mime) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], fileName, { type: mime }));
    const input = document.getElementById('fileInput');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, bytesBase64, name, type);
}

async function status(page) {
  return page.$eval('#statusText', (el) => el.textContent);
}

async function waitStatus(page, prefix) {
  await page.waitForFunction((p) => document.getElementById('statusText').textContent.startsWith(p), { timeout: 120000 }, prefix);
}

const failures = [];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  // compagnon local réel sur le port attendu par la page, User Library temporaire
  const userLibrary = mkdtempSync(join(tmpdir(), 'mid-smoke-ul-'));
  const bridge = createBridgeServer({ userLibrary, port: 47800, notifyPort: 47899, version: 'smoke' });
  await bridge.listen();
  await page.evaluateOnNewDocument(() => {
    window.__lastBlob = null;
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) { window.__lastBlob = blob; return createObjectURL(blob); };
    window.prompt = () => 'Kit smoke';
  });
  await page.goto('file://' + path('dist/index.html'));

  await inject(page, Buffer.from('ceci n\'est pas un son').toString('base64'), 'bad.txt', 'text/plain');
  await waitStatus(page, DECODE_ERROR);
  const disabled = await page.$$eval('.pad', (els) => els.every((b) => b.disabled));
  if (!disabled) failures.push('fichier illisible : les pads devraient rester désactivés');

  await inject(page, readFileSync(path('tests/fixtures/fixture.wav')).toString('base64'), 'fixture.wav', 'audio/wav');
  await waitStatus(page, 'Bibliothèque prête');
  const padCount = await page.$$eval('.pad:not([disabled])', (els) => els.length);
  if (padCount !== 20) failures.push(`pads actifs : ${padCount} au lieu de 20`);
  const drawn = await page.$$eval('.pad canvas', (cvs) => cvs.every((cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    return false;
  }));
  if (!drawn) failures.push('toutes les formes d\'onde devraient être dessinées');

  // --- clavier : la touche W (2e pad) déclenche la lecture polyphonique
  await page.keyboard.press('KeyW');
  const litByKey = await page.$eval('.pad:nth-child(2)', (el) => el.classList.contains('playing'));
  if (!litByKey) failures.push('la touche W devrait allumer le pad 2');

  // --- séquenceur : activer un pas, lire, tête de lecture, arrêter
  await page.click('.seqrow:nth-child(1) .step:nth-child(2)');
  const stepOn = await page.$eval('.seqrow:nth-child(1) .step:nth-child(2)', (el) => el.classList.contains('on'));
  if (!stepOn) failures.push('le clic sur un pas devrait l\'activer');
  await page.click('#btnPlay');
  await page.waitForFunction(() => document.querySelectorAll('.step.now').length === 20, { timeout: 5000 }).catch(() => failures.push('la tête de lecture devrait apparaître sur les 20 lignes'));
  await waitStatus(page, 'Motif en lecture');
  await page.click('#btnPlay');
  await waitStatus(page, 'Motif arrêté');
  const nowLeft = await page.$$eval('.step.now', (els) => els.length);
  if (nowLeft !== 0) failures.push('la tête de lecture devrait disparaître à l\'arrêt');

  // --- kits : sauver, exporter, recharger
  await page.click('#btnSaveKit');
  await waitStatus(page, 'Kit « Kit smoke » sauvegardé');
  const options = await page.$$eval('#kitSelect option', (els) => els.map((o) => o.textContent));
  if (!options.includes('Kit smoke')) failures.push('le kit sauvé devrait être listé dans le select : ' + options.join(', '));
  await page.click('#btnExportAll');
  await waitStatus(page, 'Kit exporté');
  const zipEntries = await page.evaluate(async () => {
    const bytes = new Uint8Array(await window.__lastBlob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const names = [];
    let off = 0;
    while (off + 30 <= bytes.length && view.getUint32(off, true) === 0x04034b50) {
      const nameLen = view.getUint16(off + 26, true);
      const size = view.getUint32(off + 18, true);
      names.push(new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen)));
      off += 30 + nameLen + size;
    }
    return names;
  });
  if (zipEntries[0] !== 'kit.json' || zipEntries.length !== 21 || zipEntries[20] !== '20_CHAOS.wav') failures.push('export : entrées inattendues ' + zipEntries.join(', '));

  // --- compagnon Live : bouton visible, envoi, fichiers écrits
  const liveVisible = await page.$eval('#btnSendLive', (el) => !el.hidden && !el.disabled);
  if (!liveVisible) failures.push('le bouton « ENVOYER DANS LIVE » devrait être visible avec le compagnon actif');
  await page.click('#btnSendLive');
  await waitStatus(page, 'Envoyé dans Live');
  const adgPath = join(userLibrary, 'Presets', 'Instruments', 'Drum Rack', 'make it drum', 'Kit smoke', 'Kit smoke.adg');
  if (!existsSync(adgPath)) failures.push('le compagnon devrait avoir écrit ' + adgPath);

  await page.click('#btnExportDaw');
  await waitStatus(page, 'Exporté — ');
  const dawEntries = await page.evaluate(async () => {
    const bytes = new Uint8Array(await window.__lastBlob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const names = [];
    let off = 0;
    while (off + 30 <= bytes.length && view.getUint32(off, true) === 0x04034b50) {
      const nameLen = view.getUint16(off + 26, true);
      const size = view.getUint32(off + 18, true);
      names.push(new TextDecoder().decode(bytes.subarray(off + 30, off + 30 + nameLen)));
      off += 30 + nameLen + size;
    }
    return names;
  });
  if (!dawEntries[0].endsWith('.adg') || !dawEntries[1].endsWith('.sfz') || dawEntries.length !== 22 || dawEntries[21] !== 'Samples/20_CHAOS.wav') failures.push('export Ableton : entrées inattendues ' + dawEntries.join(', '));

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#kitSelect option').length > 1, { timeout: 20000 });
  const kitId = await page.$eval('#kitSelect option:nth-child(2)', (o) => o.value);
  await page.select('#kitSelect', kitId);
  await waitStatus(page, 'Kit « Kit smoke » chargé');
  const reloadedPads = await page.$$eval('.pad:not([disabled])', (els) => els.length);
  if (reloadedPads !== 20) failures.push(`après rechargement du kit : ${reloadedPads} pads actifs au lieu de 20`);

  await bridge.close();
  rmSync(userLibrary, { recursive: true, force: true });

  const realErrors = consoleErrors.filter((e) => !/favicon|decodeAudioData|EncodingError/.test(e));
  if (realErrors.length) failures.push('erreurs console : ' + realErrors.join(' | '));
  console.log(`statut final : « ${await status(page)} »`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('SMOKE KO\n - ' + failures.join('\n - '));
  process.exitCode = 1;
} else {
  console.log('SMOKE OK — erreur de décodage gérée, 20 pads actifs avec forme d\'onde, clavier, séquenceur joué et arrêté, kit sauvé, envoyé au compagnon Live, exporté (.kit.zip et Ableton/SFZ) et rechargé, console propre');
}
