import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMidiOut } from '../../src/midi/out.js';

function harness(port) {
  const sent = [];
  const out = port === null ? null : { send: (data, ts) => sent.push([Array.from(data), ts]) };
  const midiOut = createMidiOut({
    getOutput: () => out,
    toTimestamp: (audioTime) => audioTime * 1000, // 1 s audio = 1000 ms
    channel: 9,
  });
  return { sent, midiOut };
}

test('noteOn envoie note-on canal 10 horodaté puis note-off 50 ms après', () => {
  const { sent, midiOut } = harness({});
  midiOut.noteOn(36, 0.5, 2);
  assert.deepEqual(sent, [[[0x99, 36, 64], 2000], [[0x89, 36, 0], 2050]]);
});

test('clockTicks envoie 24 impulsions par noire dans [from, to)', () => {
  const { sent, midiOut } = harness({});
  // 120 bpm : noire = 0,5 s → tick toutes les 0,5/24 s
  midiOut.clockTicks(10, 10.5, 120, 10);
  assert.equal(sent.length, 24);
  assert.deepEqual(sent[0], [[0xf8], 10000]);
  assert.equal(Math.round(sent[1][1] - sent[0][1]), Math.round(500 / 24));
  midiOut.clockTicks(10.5, 10.5, 120, 10);
  assert.equal(sent.length, 24);
});

test('start / stop envoient 0xFA / 0xFC ; sans sortie, rien n\'est envoyé', () => {
  const { sent, midiOut } = harness({});
  midiOut.start(3);
  midiOut.stop();
  assert.deepEqual(sent, [[[0xfa], 3000], [[0xfc], undefined]]);
  const none = harness(null);
  none.midiOut.noteOn(36, 1, 0);
  none.midiOut.start(0);
  assert.deepEqual(none.sent, []);
});
