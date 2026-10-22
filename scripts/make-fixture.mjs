// Génère le WAV de référence des tests (mono, 22 050 Hz, 16 bits, 0,5 s).
// Signal déterministe : sinus 180 Hz amorti + bruit mulberry32(1) amorti.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = new URL('../tests/fixtures/fixture.wav', import.meta.url);
const SAMPLE_RATE = 22050;
const DURATION = 0.5;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function synthesize() {
  const n = Math.floor(SAMPLE_RATE * DURATION);
  const random = mulberry32(1);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const tone = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-9 * t);
    const noise = (random() * 2 - 1) * Math.exp(-40 * t);
    data[i] = 0.8 * (0.6 * tone + 0.5 * noise);
  }
  return data;
}

function toWav(data, sampleRate) {
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + data.length * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    bytes.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return bytes;
}

mkdirSync(dirname(OUT.pathname), { recursive: true });
writeFileSync(OUT, toWav(synthesize(), SAMPLE_RATE));
console.log('fixture écrite :', OUT.pathname);
