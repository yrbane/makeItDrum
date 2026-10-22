// Analyse spectrale du son importé : fondamentale grave, pic médium,
// centroïde, brillance (énergie > 3 kHz) et facteur de crête. Chaque
// percussion générée s'appuie sur ce profil plutôt que sur des réglages
// génériques.
import { fftInPlace } from './fft.js';
import { clamp } from './math.js';

function peakBin(mag, loHz, hiHz, freqRes, half) {
  const loBin = Math.max(1, Math.floor(loHz / freqRes));
  const hiBin = Math.min(half - 1, Math.ceil(hiHz / freqRes));
  let bestI = -1;
  let bestV = -1;
  for (let i = loBin; i <= hiBin; i++) {
    if (mag[i] > bestV) { bestV = mag[i]; bestI = i; }
  }
  return bestI;
}

export function analyzeSamples(data, sampleRate) {
  let N = 1024;
  while (N * 2 <= data.length && N < 16384) N *= 2;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  const len = Math.min(N, data.length);
  for (let i = 0; i < len; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, len - 1));
    re[i] = data[i] * w;
  }
  fftInPlace(re, im);
  const half = N / 2;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) mag[i] = Math.hypot(re[i], im[i]);
  const freqRes = sampleRate / N;

  let num = 0;
  let den = 0;
  for (let i = 1; i < half; i++) { const f = i * freqRes; num += f * mag[i]; den += mag[i]; }
  const centroid = den > 0 ? num / den : 2000;

  const fundBin = peakBin(mag, 30, 300, freqRes, half);
  const fundamental = fundBin > 0 ? fundBin * freqRes : 60;

  const midBin = peakBin(mag, 600, 3000, freqRes, half);
  const midPeak = midBin > 0 ? midBin * freqRes : 1200;

  let hiE = 0;
  let totE = 0;
  for (let i = 1; i < half; i++) {
    const f = i * freqRes;
    const e = mag[i] * mag[i];
    totE += e;
    if (f > 3000) hiE += e;
  }
  const brightness = totE > 0 ? clamp(hiE / totE, 0, 1) : 0.3;

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; sumSq += v * v; }
  const rms = Math.sqrt(sumSq / data.length) || 0.001;
  const crest = clamp(peak / rms, 1, 6);

  return { centroid, fundamental, midPeak, brightness, crest };
}
