import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randomSeed } from '../../src/core/prng.js';

test('mulberry32 est déterministe et dans [0, 1[', () => {
  const a = mulberry32(123456);
  const b = mulberry32(123456);
  const seq = Array.from({ length: 5 }, () => a());
  assert.deepEqual(seq, Array.from({ length: 5 }, () => b()));
  for (const v of seq) assert.ok(v >= 0 && v < 1);
  assert.notDeepEqual(seq, Array.from({ length: 5 }, mulberry32(7)));
});

test('randomSeed tire un entier 32 bits non signé depuis la source donnée', () => {
  assert.equal(randomSeed(() => 0), 0);
  assert.equal(randomSeed(() => 0.5), 2147483648);
  const s = randomSeed();
  assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff);
});
