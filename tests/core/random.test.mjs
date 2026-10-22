// Helpers aléatoires : le générateur est injecté, les formules sont celles de l'original.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../../src/core/random.js';

const half = createRandom(() => 0.5);

test('rnd interpole linéairement entre les bornes', () => {
  assert.equal(half.rnd(0, 10), 5);
});

test('jitter applique un écart relatif centré', () => {
  assert.equal(half.jitter(100, 0.2), 100);
  assert.equal(createRandom(() => 1).jitter(100, 0.2), 120);
});

test('chance compare le tirage à la probabilité', () => {
  assert.equal(half.chance(0.6), true);
  assert.equal(half.chance(0.4), false);
});

test('randomOffset tire dans [0, dur*maxFrac - 0.01]', () => {
  assert.equal(half.randomOffset(1), 0.5 * (0.6 - 0.01));
  assert.equal(half.randomOffset(1, 0.75), 0.5 * (0.75 - 0.01));
});

test('randomOffset renvoie 0 sans tirage pour une durée nulle ou trop courte', () => {
  let calls = 0;
  const counted = createRandom(() => { calls++; return 0.5; });
  assert.equal(counted.randomOffset(0), 0);
  assert.equal(counted.randomOffset(0.01), 0);
  assert.equal(calls, 0);
});
