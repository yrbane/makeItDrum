// Forme d'onde : un segment vertical min→max par colonne de pixels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawWaveform } from '../../src/ui/waveform.js';

function fakeCanvas(width, height) {
  const calls = [];
  const ctx = {
    strokeStyle: '', shadowColor: '', shadowBlur: 0, lineWidth: 0,
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...a) => calls.push(['moveTo', ...a]),
    lineTo: (...a) => calls.push(['lineTo', ...a]),
    stroke: () => calls.push(['stroke']),
  };
  return { width, height, calls, ctx, getContext: () => ctx };
}

test('chaque colonne trace de (1+min)*h/2 à (1+max)*h/2', () => {
  const cv = fakeCanvas(2, 10);
  drawWaveform(cv, new Float32Array([0.5, -0.5]));
  const segments = cv.calls.filter((c) => c[0] === 'moveTo' || c[0] === 'lineTo');
  assert.deepEqual(segments, [
    ['moveTo', 0, 7.5], ['lineTo', 0, 7.5],
    ['moveTo', 1, 2.5], ['lineTo', 1, 2.5],
  ]);
  assert.equal(cv.ctx.strokeStyle, '#39ff6a');
  assert.equal(cv.ctx.shadowBlur, 0);
});

test('plusieurs échantillons par colonne : segment du min au max', () => {
  const cv = fakeCanvas(1, 10);
  drawWaveform(cv, new Float32Array([0.25, -0.5, 0.75]));
  const segments = cv.calls.filter((c) => c[0] === 'moveTo' || c[0] === 'lineTo');
  assert.deepEqual(segments, [['moveTo', 0, 2.5], ['lineTo', 0, 8.75]]);
});

test('sans buffer, le canvas est seulement effacé', () => {
  const cv = fakeCanvas(4, 4);
  drawWaveform(cv, null);
  assert.deepEqual(cv.calls, [['clearRect', 0, 0, 4, 4]]);
});
