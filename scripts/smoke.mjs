// Smoke E2E sur dist/index.html dans Chromium headless :
//  - un fichier illisible affiche le message d'erreur et laisse les pads désactivés ;
//  - le WAV de référence active les 20 pads, sans erreur console (hors favicon).
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
  console.log('SMOKE OK — erreur de décodage gérée, 20 pads actifs avec forme d\'onde, console propre');
}
