import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPolyPlayer } from '../../src/audio/polyplayer.js';

function fakeContext() {
  const sources = [];
  const ctx = {
    destination: 'dest',
    createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
    createBufferSource: () => {
      const src = { buffer: null, stopped: false, connect: () => {}, start: () => {}, stop: () => { src.stopped = true; if (src.onended) src.onended(); }, onended: null };
      sources.push(src);
      return src;
    },
  };
  return { ctx, sources };
}

test('play joue plusieurs voix en même temps avec leur gain', () => {
  const { ctx, sources } = fakeContext();
  const p = createPolyPlayer(() => ctx);
  p.play('b1', { voice: 0, gain: 0.5 });
  p.play('b2', { voice: 1, gain: 1 });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].stopped, false);
  assert.equal(sources[0].buffer, 'b1');
});

test('rejouer la même voix coupe la précédente (choke par pad), pas les autres', () => {
  const { ctx, sources } = fakeContext();
  const p = createPolyPlayer(() => ctx);
  const events = [];
  p.play('b1', { voice: 0, onStart: () => events.push('start0'), onStop: () => events.push('stop0') });
  p.play('b2', { voice: 1, onStart: () => events.push('start1'), onStop: () => events.push('stop1') });
  p.play('b1', { voice: 0, onStart: () => events.push('start0b'), onStop: () => events.push('stop0b') });
  assert.equal(sources[0].stopped, true);
  assert.equal(sources[1].stopped, false);
  assert.deepEqual(events, ['start0', 'start1', 'stop0', 'start0b']);
});

test('la fin naturelle d\'une voix appelle onStop une seule fois ; stopAll coupe tout', () => {
  const { ctx, sources } = fakeContext();
  const p = createPolyPlayer(() => ctx);
  let stops = 0;
  p.play('b1', { voice: 3, onStop: () => stops++ });
  sources[0].onended();
  assert.equal(stops, 1);
  p.play('b2', { voice: 4, onStop: () => stops++ });
  p.play('b3', { voice: 5, onStop: () => stops++ });
  p.stopAll();
  assert.equal(stops, 3);
});
