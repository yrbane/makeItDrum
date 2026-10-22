// Fabrique un kit en ligne de commande : charge dist/index.html dans Chromium headless,
// injecte un fichier audio, attend les 20 rendus, exporte le .kit.zip.
//   node scripts/export-kit.mjs <son.wav> [sortie.kit.zip]
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('usage : node scripts/export-kit.mjs <son.wav> [sortie.kit.zip]');
  process.exit(2);
}
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const out = resolve(output || basename(input).replace(/\.[^.]+$/, '') + '.kit.zip');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.__lastBlob = null;
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (blob) { window.__lastBlob = blob; return createObjectURL(blob); };
  });
  await page.goto('file://' + resolve(ROOT, 'dist/index.html'));
  const bytes = readFileSync(input);
  await page.evaluate((b64, fileName) => {
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([data], fileName));
    const el = document.getElementById('fileInput');
    el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, bytes.toString('base64'), basename(input));
  await page.waitForFunction(() => document.getElementById('statusText').textContent.startsWith('Bibliothèque prête'), { timeout: 180000 });
  await page.click('#btnExportAll');
  await page.waitForFunction(() => window.__lastBlob !== null, { timeout: 30000 });
  const zip = await page.evaluate(async () => Array.from(new Uint8Array(await window.__lastBlob.arrayBuffer())));
  writeFileSync(out, Buffer.from(zip));
  console.log(`kit écrit : ${out} (${zip.length} octets)`);
} finally {
  await browser.close();
}
