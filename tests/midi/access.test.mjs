import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMidiAccess } from '../../src/midi/access.js';

function fakeNavigator(inputs, { refuse = false } = {}) {
  const access = { inputs: new Map(inputs.map((i) => [i.id, i])), onstatechange: null };
  return {
    access,
    navigator: { requestMIDIAccess: () => (refuse ? Promise.reject(new Error('refusé')) : Promise.resolve(access)) },
  };
}

function port(id, name) {
  return { id, name, onmidimessage: null };
}

test('sans requestMIDIAccess : non pris en charge, init renvoie false', async () => {
  const midi = createMidiAccess({});
  assert.equal(midi.isSupported(), false);
  assert.equal(await midi.init(), false);
  assert.deepEqual(midi.inputs(), []);
});

test('refus de permission : init renvoie false sans lever', async () => {
  const { navigator } = fakeNavigator([], { refuse: true });
  const midi = createMidiAccess(navigator);
  assert.equal(await midi.init(), false);
});

test('init liste les entrées et transmet les notes de toutes les entrées', async () => {
  const a = port('a', 'Pad A');
  const b = port('b', null);
  const { navigator } = fakeNavigator([a, b]);
  const midi = createMidiAccess(navigator);
  const notes = [];
  midi.onNote((note, velocity) => notes.push([note, velocity]));
  assert.equal(await midi.init(), true);
  assert.deepEqual(midi.inputs(), [{ id: 'a', name: 'Pad A' }, { id: 'b', name: 'b' }]);
  a.onmidimessage({ data: new Uint8Array([0x90, 36, 127]) });
  b.onmidimessage({ data: new Uint8Array([0x90, 40, 64]) });
  b.onmidimessage({ data: new Uint8Array([0x90, 40, 0]) });
  b.onmidimessage({ data: new Uint8Array([0xb0, 1, 1]) });
  assert.deepEqual(notes, [[36, 1], [40, 64 / 127]]);
});

test('setInput restreint à un port ; onstatechange rebranche et prévient', async () => {
  const a = port('a', 'A');
  const { navigator, access } = fakeNavigator([a]);
  const midi = createMidiAccess(navigator);
  const notes = [];
  let changed = 0;
  midi.onNote((n) => notes.push(n));
  midi.onPortsChanged(() => changed++);
  await midi.init();
  midi.setInput('zzz');
  a.onmidimessage({ data: new Uint8Array([0x90, 36, 100]) });
  assert.deepEqual(notes, []);
  midi.setInput('a');
  a.onmidimessage({ data: new Uint8Array([0x90, 36, 100]) });
  assert.deepEqual(notes, [36]);
  const c = port('c', 'C');
  access.inputs.set('c', c);
  access.onstatechange();
  assert.equal(changed, 1);
  midi.setInput('all');
  c.onmidimessage({ data: new Uint8Array([0x90, 37, 100]) });
  assert.deepEqual(notes, [36, 37]);
});

test('outputs liste les sorties, setOutput choisit le port (ou aucun)', async () => {
  const outA = { id: 'oa', name: 'Synth A', send: () => {} };
  const access = { inputs: new Map(), outputs: new Map([['oa', outA]]), onstatechange: null };
  const midi = createMidiAccess({ requestMIDIAccess: () => Promise.resolve(access) });
  assert.deepEqual(midi.outputs(), []);
  await midi.init();
  assert.deepEqual(midi.outputs(), [{ id: 'oa', name: 'Synth A' }]);
  assert.equal(midi.output(), null, 'aucune sortie par défaut');
  midi.setOutput('oa');
  assert.equal(midi.output(), outA);
  midi.setOutput('');
  assert.equal(midi.output(), null);
});
