import { test } from 'node:test';
import assert from 'node:assert/strict';
import { padForNote, parseMidiMessage, defaultNotes } from '../../../src/core/midi/drummap.js';

test('defaultNotes : 36 + index sur 20 pads', () => {
  const n = defaultNotes(20);
  assert.equal(n.length, 20);
  assert.equal(n[0], 36);
  assert.equal(n[19], 55);
});

test('padForNote renvoie le premier pad portant la note, null sinon', () => {
  assert.equal(padForNote([36, 37, 38], 37), 1);
  assert.equal(padForNote([36, 38, 38], 38), 1);
  assert.equal(padForNote([36, 37], 60), null);
});

test('parseMidiMessage décode note-on, note-off (et vélocité 0), ignore le reste', () => {
  assert.deepEqual(parseMidiMessage(new Uint8Array([0x90, 36, 127])), { type: 'noteon', channel: 0, note: 36, velocity: 1 });
  assert.deepEqual(parseMidiMessage(new Uint8Array([0x99, 38, 64])), { type: 'noteon', channel: 9, note: 38, velocity: 64 / 127 });
  assert.deepEqual(parseMidiMessage(new Uint8Array([0x90, 36, 0])), { type: 'noteoff', channel: 0, note: 36, velocity: 0 });
  assert.deepEqual(parseMidiMessage(new Uint8Array([0x80, 36, 64])), { type: 'noteoff', channel: 0, note: 36, velocity: 64 / 127 });
  assert.equal(parseMidiMessage(new Uint8Array([0xb0, 1, 2])), null);
  assert.equal(parseMidiMessage(new Uint8Array([0x90, 36])), null);
  assert.equal(parseMidiMessage(null), null);
});
