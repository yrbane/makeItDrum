import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPattern, toggleStep, stepDuration, stepTime, eventsBetween, serializePattern, parsePattern } from '../../src/core/sequencer.js';

test('createPattern : 20 pistes × 16 pas à zéro', () => {
  const p = createPattern();
  assert.equal(p.steps, 16);
  assert.equal(p.tracks.length, 20);
  assert.equal(p.tracks[3].length, 16);
  assert.equal(p.tracks[3][5], 0);
});

test('toggleStep cycle off → 100 → 127 → 60 → off, sans muter l\'original', () => {
  const p0 = createPattern(2, 4);
  const p1 = toggleStep(p0, 1, 2);
  assert.equal(p0.tracks[1][2], 0);
  assert.equal(p1.tracks[1][2], 100);
  const p2 = toggleStep(p1, 1, 2);
  assert.equal(p2.tracks[1][2], 127);
  const p3 = toggleStep(p2, 1, 2);
  assert.equal(p3.tracks[1][2], 60);
  const p4 = toggleStep(p3, 1, 2);
  assert.equal(p4.tracks[1][2], 0);
});

test('stepDuration et stepTime avec swing sur les pas impairs', () => {
  assert.equal(stepDuration(120), 0.125);
  assert.equal(stepTime(0, 120, 0), 0);
  assert.equal(stepTime(4, 120, 0.5), 0.5);
  assert.equal(stepTime(1, 120, 0), 0.125);
  assert.equal(stepTime(1, 120, 0.5), 0.125 + 0.03125);
});

test('eventsBetween : événements des pas actifs dans [from, to), sur plusieurs mesures', () => {
  let p = createPattern(2, 4);
  p = toggleStep(p, 0, 0);   // 100
  p = toggleStep(p, 1, 2);   // 100
  const cfg = { bpm: 120, swing: 0, origin: 10 };
  // mesure de 4 pas × 0,125 s = 0,5 s
  assert.deepEqual(eventsBetween(p, cfg, 10, 10.3), [{ time: 10, step: 0, track: 0, velocity: 100 }, { time: 10.25, step: 2, track: 1, velocity: 100 }]);
  assert.deepEqual(eventsBetween(p, cfg, 10.3, 10.6), [{ time: 10.5, step: 0, track: 0, velocity: 100 }]);
  assert.deepEqual(eventsBetween(p, cfg, 9, 10), []);
  assert.deepEqual(eventsBetween(p, cfg, 10.25, 10.25), []);
});

test('serializePattern / parsePattern : aller-retour JSON, motif invalide → null', () => {
  let p = toggleStep(createPattern(), 19, 15);
  const json = serializePattern(p, { bpm: 128, swing: 0.2 });
  assert.deepEqual(json.steps, 16);
  assert.equal(json.bpm, 128);
  assert.equal(json.tracks.length, 20);
  assert.equal(json.tracks[19][15], 100);
  const back = parsePattern(json);
  assert.equal(back.pattern.tracks[19][15], 100);
  assert.equal(back.bpm, 128);
  assert.equal(back.swing, 0.2);
  assert.equal(parsePattern(null), null);
  assert.equal(parsePattern({ steps: 16, tracks: 'x' }), null);
});
