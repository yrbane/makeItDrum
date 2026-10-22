// Tables de WaveShaper et enveloppes : valeurs connues de l'original.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSatCurve, makeFoldCurve, makeEnvCurve, scaledEnv } from '../../src/core/curves.js';

test('makeSatCurve : 1024 points, bornés à ±1 et croissants', () => {
  const c = makeSatCurve(1, 0);
  assert.equal(c.length, 1024);
  assert.equal(c[0], -1);
  assert.equal(c[1023], 1);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], `non croissant en ${i}`);
});

test('makeFoldCurve replie au-delà du seuil et normalise par le seuil', () => {
  const c = makeFoldCurve(0.5);
  assert.equal(c.length, 1024);
  for (const v of c) assert.ok(Math.abs(v) <= 1 + 1e-6);
  // x = 1 → replié en 2*0.5-1 = 0
  assert.ok(Math.abs(c[1023]) < 1e-6);
  // x = 0.75 → replié en 2*0.5-0.75 = 0.25 → /0.5 = 0.5
  const i = Math.round(((0.75 + 1) / 2) * 1023);
  const x = (i / 1023) * 2 - 1;
  assert.ok(Math.abs(c[i] - (2 * 0.5 - x) / 0.5) < 1e-6);
});

test('makeEnvCurve : 512 points, palier à 1, dernier point 0.0001', () => {
  const c = makeEnvCurve(0.1, 0.1, 0.1, 2);
  assert.equal(c.length, 512);
  assert.equal(Math.max(...c), 1);
  assert.ok(Math.abs(c[511] - 0.0001) < 1e-9);
});

test('scaledEnv met le pic à l\'échelle', () => {
  const c = scaledEnv(0.1, 0.1, 0.1, 2, 0.5);
  assert.equal(Math.max(...c), 0.5);
});
