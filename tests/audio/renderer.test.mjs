// Renderer : le graphe construit pour une recette, avec un aléatoire seedé,
// est figé par snapshot (tests de caractérisation). Les snapshots ont été
// établis quand le golden master (1.1.0) prouvait l'équivalence avec l'original ;
// UPDATE_SNAPSHOTS=1 les régénère : seulement pour un changement de moteur voulu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRenderer } from '../../src/audio/renderer.js';
import { createRandom } from '../../src/core/random.js';
import { FLAVORS } from '../../src/core/flavors.js';
import { mulberry32 } from '../../src/core/prng.js';
import { createFakeOfflineContextCtor, fakeBuffer } from '../helpers/fake-audio.mjs';

const SNAPSHOT_DIR = new URL('./snapshots/', import.meta.url);
const SR = 44100;
const ANALYSIS = { centroid: 1800, fundamental: 62, midPeak: 1100, brightness: 0.35, crest: 4 };

function sample() {
  const n = SR / 2;
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.sin(i * 0.01) * 0.8;
  const reversed = new Float32Array(n);
  for (let i = 0; i < n; i++) reversed[i] = data[n - 1 - i];
  return {
    originalBuffer: fakeBuffer([data], SR, 'buf:original'),
    reversedBuffer: fakeBuffer([reversed], SR, 'buf:reversed'),
    analysis: ANALYSIS,
  };
}

async function renderTrace(flavorName) {
  const cfg = FLAVORS.find((f) => f.name === flavorName);
  const trace = [];
  const renderer = createRenderer({ OfflineAudioContextCtor: createFakeOfflineContextCtor(trace) });
  const buffer = await renderer.render(cfg, sample(), createRandom(mulberry32(42)));
  return { trace, buffer, cfg };
}

function assertSnapshot(name, lines) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const file = new URL(`renderer-${name}.txt`, SNAPSHOT_DIR);
  const actual = lines.join('\n') + '\n';
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(file)) {
    writeFileSync(file, actual);
    assert.fail(`snapshot ${name} écrit (${lines.length} opérations) — relancer les tests`);
  }
  const expected = readFileSync(file, 'utf8').split('\n');
  const got = actual.split('\n');
  for (let i = 0; i < Math.max(expected.length, got.length); i++) {
    assert.equal(got[i], expected[i], `${name} : divergence à l'opération ${i}\n  attendu : ${expected[i]}\n  obtenu  : ${got[i]}`);
  }
}

// trois recettes couvrant toutes les briques : sub + bassBoost + reverb,
// phaser + comb + fold + crush, et la plus nue (sans reverb)
for (const name of ['BOOM', 'CHAOS', 'TICK']) {
  test(`graphe de la recette ${name} figé par snapshot`, async () => {
    const { trace } = await renderTrace(name);
    assertSnapshot(name, trace);
  });
}

test('le buffer rendu est normalisé à la crête de la recette', async () => {
  const { buffer, cfg } = await renderTrace('BOOM');
  const d = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  assert.ok(Math.abs(peak - cfg.peak) < 1e-6, `crête ${peak} ≠ ${cfg.peak}`);
});

test('TICK (sans reverb) ne crée pas de convolver, BOOM en crée un', async () => {
  const tick = (await renderTrace('TICK')).trace;
  const boom = (await renderTrace('BOOM')).trace;
  assert.equal(tick.filter((l) => l.startsWith('createConvolver')).length, 0);
  assert.equal(boom.filter((l) => l.startsWith('createConvolver')).length, 1);
});
