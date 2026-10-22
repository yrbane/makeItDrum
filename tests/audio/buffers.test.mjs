// Buffers dérivés : l'inversion traite tous les canaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeReversedBuffer } from '../../src/audio/buffers.js';
import { fakeBuffer } from '../helpers/fake-audio.mjs';

function FakeAudioBuffer({ length, numberOfChannels, sampleRate }) {
  return fakeBuffer(Array.from({ length: numberOfChannels }, () => new Float32Array(length)), sampleRate, 'rev');
}

test('makeReversedBuffer inverse chaque canal indépendamment', () => {
  const src = fakeBuffer([new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])], 8000, 'src');
  const rev = makeReversedBuffer(src, FakeAudioBuffer);
  assert.equal(rev.numberOfChannels, 2);
  assert.equal(rev.sampleRate, 8000);
  assert.deepEqual(Array.from(rev.getChannelData(0)), [3, 2, 1]);
  assert.deepEqual(Array.from(rev.getChannelData(1)), [6, 5, 4]);
});
