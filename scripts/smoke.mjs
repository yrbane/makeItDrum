// Smoke E2E sur dist/index.html dans Chromium headless :
//  - un fichier illisible affiche le message d'erreur et laisse les pads désactivés ;
//  - le WAV de référence active les 20 pads, sans erreur console (hors favicon) ;
//  - sauver un kit le liste dans le select, l'export produit un .kit.zip avec kit.json,
//    un rechargement de la page retrouve le kit et le charge sans rendu.
import puppeteer from 'puppeteer-core';
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

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#kitSelect option').length > 1, { timeout: 20000 });
  const kitId = await page.$eval('#kitSelect option:nth-child(2)', (o) => o.value);
  await page.select('#kitSelect', kitId);
  await waitStatus(page, 'Kit « Kit smoke » chargé');
  const reloadedPads = await page.$$eval('.pad:not([disabled])', (els) => els.length);
  if (reloadedPads !== 20) failures.push(`après rechargement du kit : ${reloadedPads} pads actifs au lieu de 20`);

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
  console.log('SMOKE OK — erreur de décodage gérée, 20 pads actifs avec forme d\'onde, kit sauvé, exporté et rechargé, console propre');
}
