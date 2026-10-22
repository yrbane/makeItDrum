// Lecteur « une seule percussion à la fois » : la suivante coupe net la précédente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../../src/audio/player.js';

function fakeContext() {
  const sources = [];
  return {
    sources,
    destination: {},
    createBufferSource() {
      const src = { buffer: null, onended: null, stops: 0, started: 0,
        connect() {}, start() { this.started++; }, stop() { this.stops++; } };
      sources.push(src);
      return src;
    },
  };
}

function listener(log, name) {
  return { onStart: () => log.push('start ' + name), onStop: () => log.push('stop ' + name) };
}

test('jouer B pendant A arrête A et notifie dans l\'ordre', () => {
  const ctx = fakeContext();
  const player = createPlayer(() => ctx);
  const log = [];
  player.play({}, listener(log, 'A'));
  player.play({}, listener(log, 'B'));
  const [a, b] = ctx.sources;
  assert.equal(a.stops, 1);
  assert.equal(b.started, 1);
  assert.deepEqual(log, ['start A', 'stop A', 'start B']);
});

test('la fin naturelle d\'une source notifie onStop une seule fois', () => {
  const ctx = fakeContext();
  const player = createPlayer(() => ctx);
  const log = [];
  player.play({}, listener(log, 'A'));
  ctx.sources[0].onended();
  player.stop();
  assert.deepEqual(log, ['start A', 'stop A']);
});

test('stop() sur une source coupée ne rappelle pas onended', () => {
  const ctx = fakeContext();
  const player = createPlayer(() => ctx);
  const log = [];
  player.play({}, listener(log, 'A'));
  player.stop();
  assert.equal(ctx.sources[0].onended, null);
  assert.deepEqual(log, ['start A', 'stop A']);
});
