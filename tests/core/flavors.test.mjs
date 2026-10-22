// Les 20 recettes : données statiques, nommées, complètes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAVORS, flavorAt } from '../../src/core/flavors.js';

const NAMES = ['BOOM', 'KICK', 'THUD', 'SNAP', 'CRACK', 'BUZZ', 'RING', 'TICK', 'GLASS', 'WASH',
  'BEND', 'SWELL', 'STUTTER', 'CRUSH', 'PHASE', 'GROWL', 'PERC', 'BELL', 'DARK', 'CHAOS'];

const ANALYSIS = { fundamental: 60, midPeak: 1200, centroid: 2000, brightness: 0.3, crest: 3 };

test('il y a 20 recettes, nommées dans l\'ordre', () => {
  assert.equal(FLAVORS.length, 20);
  assert.deepEqual(FLAVORS.map((f) => f.name), NAMES);
});

test('chaque recette porte les champs que le renderer consomme', () => {
  for (const f of FLAVORS) {
    for (const key of ['attack', 'hold', 'decay', 'curvePow', 'outGain', 'peak']) {
      assert.equal(typeof f[key], 'number', `${f.name}.${key}`);
    }
    assert.ok(f.layers.length >= 1, `${f.name}.layers`);
    assert.equal(typeof f.sat.drive1, 'number', `${f.name}.sat.drive1`);
    assert.equal(typeof f.sat.drive2, 'number', `${f.name}.sat.drive2`);
  }
});

test('les fréquences dérivées de l\'analyse sont des nombres finis positifs', () => {
  for (const f of FLAVORS) {
    for (const layer of f.layers) {
      const v = layer.freq(ANALYSIS);
      assert.ok(Number.isFinite(v) && v > 0, `${f.name} layer freq=${v}`);
    }
    if (f.sub) assert.ok(f.sub.cutoff(ANALYSIS) > 0, `${f.name} sub.cutoff`);
    if (f.phaser) assert.ok(f.phaser.baseFreq(ANALYSIS) > 0, `${f.name} phaser.baseFreq`);
  }
});

test('flavorAt boucle modulo 20', () => {
  assert.equal(flavorAt(20), FLAVORS[0]);
  assert.equal(flavorAt(3), FLAVORS[3]);
});
