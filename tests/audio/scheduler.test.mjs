import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../../src/audio/scheduler.js';
import { createPattern, toggleStep } from '../../src/core/sequencer.js';

function harness(pattern) {
  const ctx = { currentTime: 100 };
  const timers = [];
  const events = [];
  const steps = [];
  const settings = { bpm: 120, swing: 0 };
  const sched = createScheduler({
    getContext: () => ctx,
    getPattern: () => pattern,
    getSettings: () => settings,
    onEvent: (ev) => events.push(ev),
    onStep: (s) => steps.push(s),
    setInterval: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearInterval: (id) => { timers[id - 1].cleared = true; },
    lookahead: 0.1,
    interval: 25,
    startDelay: 0.05,
  });
  return { ctx, timers, events, steps, sched, settings };
}

test('start planifie les événements à venir dans la fenêtre, sans doublon entre deux ticks', () => {
  let p = createPattern(2, 4);
  p = toggleStep(p, 0, 0);
  p = toggleStep(p, 1, 1);
  const h = harness(p);
  h.sched.start();
  assert.equal(h.sched.isRunning(), true);
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 25);
  // premier tick à t=100 : origine 100,05 ; fenêtre [100,05 ; 100,1) → pas 0 à 100,05
  assert.deepEqual(h.events.map((e) => [e.track, +e.time.toFixed(3)]), [[0, 100.05]]);
  h.ctx.currentTime = 100.1;
  h.timers[0].fn();
  // fenêtre [100,1 ; 100,2) → pas 1 à 100,175
  assert.deepEqual(h.events.map((e) => [e.track, +e.time.toFixed(3)]), [[0, 100.05], [1, 100.175]]);
  h.timers[0].fn();
  assert.equal(h.events.length, 2, 'un tick sans avancée du temps ne replanifie rien');
});

test('onStep suit le pas courant et stop arrête le timer', () => {
  const p = createPattern(1, 4);
  const h = harness(p);
  h.sched.start();
  assert.deepEqual(h.steps, [0]);
  h.ctx.currentTime = 100.05 + 0.125 * 2 + 0.01;
  h.timers[0].fn();
  assert.equal(h.steps.at(-1), 2);
  h.ctx.currentTime = 100.05 + 0.125 * 4 + 0.01;
  h.timers[0].fn();
  assert.equal(h.steps.at(-1), 0, 'boucle sur la mesure');
  h.sched.stop();
  assert.equal(h.sched.isRunning(), false);
  assert.equal(h.timers[0].cleared, true);
  assert.equal(h.steps.at(-1), -1, 'stop efface la tête de lecture');
});

test('onWindow reçoit chaque fenêtre planifiée (pour l\'horloge MIDI)', () => {
  const p = createPattern(1, 4);
  const windows = [];
  const ctx = { currentTime: 5 };
  const timers = [];
  const sched = createScheduler({
    getContext: () => ctx, getPattern: () => p, getSettings: () => ({ bpm: 120, swing: 0 }),
    onEvent: () => {}, onStep: () => {}, onWindow: (from, to, origin) => windows.push([from, to, origin].map((v) => +v.toFixed(3))),
    setInterval: (fn) => { timers.push(fn); return 1; }, clearInterval: () => {}, lookahead: 0.1, startDelay: 0.05,
  });
  sched.start();
  ctx.currentTime = 5.1;
  timers[0]();
  assert.deepEqual(windows, [[5.05, 5.1, 5.05], [5.1, 5.2, 5.05]]);
});
