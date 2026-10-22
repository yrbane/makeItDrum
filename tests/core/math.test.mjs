import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp } from '../../src/core/math.js';

test('clamp borne la valeur dans [a, b]', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});
