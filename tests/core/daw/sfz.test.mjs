import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSfz } from '../../../src/core/daw/sfz.js';

const pads = [
  { index: 0, flavor: 'BOOM', note: 36, file: 'Samples/01_BOOM.wav' },
  { index: 1, flavor: 'KICK', note: 37, file: 'Samples/02_KICK.wav' },
];

test('buildSfz : un <region> par pad, note = key, one-shot, chemin relatif', () => {
  const sfz = buildSfz({ name: 'Casserole', pads });
  assert.match(sfz, /^\/\/ Casserole — make it drum/);
  assert.match(sfz, /<control>\s*\ndefault_path=/);
  const regions = sfz.split('<region>').slice(1);
  assert.equal(regions.length, 2);
  assert.match(regions[0], /sample=Samples\/01_BOOM\.wav/);
  assert.match(regions[0], /key=36/);
  assert.match(regions[0], /loop_mode=one_shot/);
  assert.match(regions[1], /key=37/);
  assert.match(regions[1], /region_label=02 KICK|\/\/ 02 KICK/);
});

test('buildSfz : les pads sans fichier sont ignorés', () => {
  const sfz = buildSfz({ name: 'x', pads: [pads[0], { index: 1, flavor: 'KICK', note: 37, file: null }] });
  assert.equal(sfz.split('<region>').length - 1, 1);
});
