import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { buildDrumRackXml, buildAdg, loadTemplates } from '../../../src/core/daw/adg.js';

const pads = [
  { index: 0, flavor: 'BOOM', note: 36, file: 'Samples/01_BOOM.wav', frames: 1000, sampleRate: 48000, bytes: 2044, seed: 7 },
  { index: 1, flavor: 'KICK', note: 37, file: null },
  { index: 2, flavor: 'SNARE', note: 38, file: 'Samples/03_SNARE.wav', frames: 500, sampleRate: 48000, bytes: 1044, seed: 9 },
];

test('les gabarits se décompressent en XML Ableton avec les marqueurs attendus', async () => {
  const { wrapper, branch } = await loadTemplates();
  assert.match(wrapper, /^<\?xml[^>]*\?><Ableton /);
  assert.match(wrapper, /<BranchPresets>@@BRANCHES@@<\/BranchPresets>/);
  assert.match(wrapper, /<DrumGroupDevice /);
  assert.match(branch, /^<DrumBranchPreset Id="@@INDEX@@">/);
  assert.match(branch, /<OriginalSimpler /);
  assert.doesNotMatch(wrapper, /Chromatone|Kick Vinyl|Users\/pma/);
  assert.doesNotMatch(branch, /Chromatone|Kick Vinyl|Users\/pma/);
});

test('buildDrumRackXml : une branche par pad avec fichier, notes, chemins, longueurs', async () => {
  const t = await loadTemplates();
  const xml = buildDrumRackXml({ name: 'Casserole', pads, modDate: 1234 }, t);
  assert.doesNotMatch(xml, /@@/);
  assert.equal((xml.match(/<DrumBranchPreset Id="/g) || []).length, 2);
  assert.match(xml, /<DrumBranchPreset Id="0">/);
  assert.match(xml, /<DrumBranchPreset Id="2">/);
  assert.match(xml, /<ReceivingNote Value="36" \/>/);
  assert.match(xml, /<ReceivingNote Value="38" \/>/);
  assert.doesNotMatch(xml, /<ReceivingNote Value="37" \/>/);
  assert.match(xml, /<RelativePathType Value="1" \/><RelativePath Value="Samples\/01_BOOM.wav" \/><Path Value="Samples\/01_BOOM.wav" \/>/);
  assert.match(xml, /<SampleEnd Value="999" \/>/);
  assert.match(xml, /<DefaultDuration Value="1000" \/>/);
  assert.match(xml, /<DefaultSampleRate Value="48000" \/>/);
  assert.match(xml, /<OriginalFileSize Value="2044" \/>/);
  assert.match(xml, /<LastModDate Value="1234" \/>/);
  assert.match(xml, /<RoundRobinRandomSeed Value="7" \/>/);
  assert.match(xml, /<Name Value="01 BOOM" \/>/);
  assert.match(xml, /<UserName Value="Casserole" \/>/);
});

test('les caractères spéciaux du nom sont échappés en XML', async () => {
  const t = await loadTemplates();
  const xml = buildDrumRackXml({ name: 'A & B "<c>"', pads: pads.slice(0, 1) }, t);
  assert.match(xml, /<UserName Value="A &amp; B &quot;&lt;c&gt;&quot;" \/>/);
});

test('buildAdg : gzip du XML, relisible', async () => {
  const bytes = await buildAdg({ name: 'x', pads });
  assert.equal(bytes[0], 0x1f);
  assert.equal(bytes[1], 0x8b);
  const xml = gunzipSync(bytes).toString('utf8');
  assert.match(xml, /^<\?xml/);
  assert.match(xml, /<\/Ableton>$/);
});
