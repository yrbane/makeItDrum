// Post-traitements purs : bitcrush, normalisation, impulsion, inversion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bitcrushInPlace } from '../../src/core/bitcrush.js';
import { peakOf, normalizePeakInPlace } from '../../src/core/normalize.js';
import { fillImpulseInPlace } from '../../src/core/impulse.js';
import { reverseInto } from '../../src/core/samples.js';

test('bitcrushInPlace quantifie et tient la valeur sur holdSamples', () => {
  const d = new Float32Array([0.3, 0.31, 0.9]);
  bitcrushInPlace(d, 3, 2);
  assert.deepEqual(Array.from(d), [0.25, 0.25, 0.875]);
});

test('peakOf renvoie le pic absolu sur tous les canaux', () => {
  assert.equal(peakOf([new Float32Array([0.125, -0.75]), new Float32Array([0.25])]), 0.75);
});

test('normalizePeakInPlace ramène le pic à la cible', () => {
  const ch = new Float32Array([0.5, -0.25]);
  normalizePeakInPlace([ch], 0.95);
  assert.ok(Math.abs(ch[0] - 0.95) < 1e-7);
  assert.ok(Math.abs(ch[1] + 0.475) < 1e-7);
});

test('normalizePeakInPlace laisse le silence intact', () => {
  const ch = new Float32Array([0, 0.00005]);
  const before = Array.from(ch);
  normalizePeakInPlace([ch]);
  assert.deepEqual(Array.from(ch), before);
});

test('fillImpulseInPlace décroît en puissance de (1 - i/len)', () => {
  const d = new Float32Array(4);
  fillImpulseInPlace(d, 1, () => 1);
  assert.deepEqual(Array.from(d), [1, 0.75, 0.5, 0.25]);
});

test('reverseInto inverse l\'ordre des échantillons', () => {
  const dst = new Float32Array(3);
  reverseInto(new Float32Array([1, 2, 3]), dst);
  assert.deepEqual(Array.from(dst), [3, 2, 1]);
});
