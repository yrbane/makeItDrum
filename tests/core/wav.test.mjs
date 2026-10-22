// Encodeur WAV PCM 16 bits mono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav } from '../../src/core/wav.js';

function ascii(view, offset, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

test('l\'en-tête RIFF est conforme', () => {
  const ab = encodeWav(new Float32Array(10), 44100);
  const v = new DataView(ab);
  assert.equal(ab.byteLength, 44 + 20);
  assert.equal(ascii(v, 0, 4), 'RIFF');
  assert.equal(v.getUint32(4, true), 36 + 20);
  assert.equal(ascii(v, 8, 4), 'WAVE');
  assert.equal(ascii(v, 12, 4), 'fmt ');
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getUint32(28, true), 88200);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(ascii(v, 36, 4), 'data');
  assert.equal(v.getUint32(40, true), 20);
});

test('les échantillons sont saturés et convertis en int16 comme l\'original', () => {
  const ab = encodeWav(new Float32Array([1, -1, 0, 2, -2]), 8000);
  const v = new DataView(ab);
  const out = [];
  for (let i = 0; i < 5; i++) out.push(v.getInt16(44 + i * 2, true));
  assert.deepEqual(out, [32767, -32768, 0, 32767, -32768]);
});
