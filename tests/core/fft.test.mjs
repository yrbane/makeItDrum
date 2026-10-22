// FFT radix-2 : propriétés de base vérifiables à la main.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fftInPlace } from '../../src/core/fft.js';

function magnitudes(re, im) {
  return Array.from(re, (r, i) => Math.hypot(r, im[i]));
}

function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

test('une impulsion donne un spectre plat', () => {
  const re = new Float32Array([1, 0, 0, 0, 0, 0, 0, 0]);
  const im = new Float32Array(8);
  fftInPlace(re, im);
  for (let i = 0; i < 8; i++) {
    assert.ok(Math.abs(re[i] - 1) < 1e-6, `re[${i}]`);
    assert.ok(Math.abs(im[i]) < 1e-6, `im[${i}]`);
  }
});

test('un sinus de 4 périodes sur 64 points pique au bin 4', () => {
  const n = 64;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 4 * i) / n);
  fftInPlace(re, im);
  assert.equal(argmax(magnitudes(re, im).slice(0, n / 2)), 4);
});

test('un sinus de 440 Hz à 44100 Hz sur 1024 points pique au bin 10', () => {
  const n = 1024;
  const sr = 44100;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 440 * i) / sr);
  fftInPlace(re, im);
  assert.equal(argmax(magnitudes(re, im).slice(0, n / 2)), Math.round(440 / (sr / n)));
});
