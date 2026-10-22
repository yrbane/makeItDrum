// Analyse spectrale : profil d'un son importé (fondamentale, brillance, crête).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSamples } from '../../src/core/analysis.js';

const SR = 44100;

function sine(freq, seconds) {
  const n = Math.floor(SR * seconds);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.sin((2 * Math.PI * freq * i) / SR);
  return data;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('un sinus grave donne une fondamentale proche de 60 Hz et peu de brillance', () => {
  const a = analyzeSamples(sine(60, 1), SR);
  assert.ok(a.fundamental >= 55 && a.fundamental <= 65, `fundamental=${a.fundamental}`);
  assert.ok(a.brightness < 0.05, `brightness=${a.brightness}`);
});

test('un bruit blanc est brillant', () => {
  const random = mulberry32(7);
  const data = Float32Array.from({ length: SR }, () => random() * 2 - 1);
  const a = analyzeSamples(data, SR);
  assert.ok(a.brightness > 0.5, `brightness=${a.brightness}`);
});

test('le silence reproduit les valeurs de repli de l\'original (premier bin des plages)', () => {
  // comportement historique : un spectre nul retient le premier bin de chaque
  // plage (0 > -1), pas la valeur « par défaut » 60 / 1200.
  const a = analyzeSamples(new Float32Array(4096), SR);
  const freqRes = SR / 4096;
  assert.equal(a.centroid, 2000);
  assert.equal(a.fundamental, Math.floor(30 / freqRes) * freqRes);
  assert.equal(a.midPeak, Math.floor(600 / freqRes) * freqRes);
  assert.equal(a.brightness, 0.3);
  assert.equal(a.crest, 1);
});

test('un sample de 10 échantillons ne fait pas planter l\'analyse', () => {
  const a = analyzeSamples(new Float32Array([0.1, -0.2, 0.3, 0, 0, 0.5, -0.5, 0.1, 0, 0]), SR);
  assert.ok(Number.isFinite(a.centroid));
  assert.ok(a.crest >= 1 && a.crest <= 6);
});
