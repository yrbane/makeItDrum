// Tables pour WaveShaper et enveloppes d'amplitude, toutes pures.
import { clamp } from './math.js';

// saturation tanh, avec asymétrie optionnelle (harmoniques paires)
export function makeSatCurve(drive, asym) {
  const k = Math.max(0.3, drive);
  const a = asym || 0;
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * (x + a * x * x)) / norm;
  }
  return curve;
}

// enveloppe : attaque, palier (punch), puis chute en courbe de puissance
export function makeEnvCurve(attack, hold, decay, curvePow) {
  curvePow = curvePow || 2;
  const n = 512;
  const total = attack + hold + decay;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * total;
    if (t < attack) {
      curve[i] = attack > 0 ? t / attack : 1;
    } else if (t < attack + hold) {
      curve[i] = 1;
    } else {
      const dt = decay > 0 ? (t - attack - hold) / decay : 1;
      curve[i] = Math.pow(1 - Math.min(dt, 1), curvePow);
    }
  }
  curve[n - 1] = 0.0001;
  return curve;
}

// enveloppe avec pic mis à l'échelle (évite de fixer .gain.value après
// setValueCurveAtTime, ce qui casserait l'automation)
export function scaledEnv(attack, hold, decay, curvePow, peak) {
  const c = makeEnvCurve(attack, hold, decay, curvePow);
  if (peak !== undefined && peak !== 1) {
    for (let i = 0; i < c.length; i++) c[i] *= peak;
  }
  return c;
}

// wavefolder : distorsion par repliement, plus sale/anguleuse qu'un tanh
export function makeFoldCurve(threshold) {
  const th = clamp(threshold, 0.08, 0.9);
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    let y = x;
    let guard = 0;
    while (Math.abs(y) > th && guard < 8) {
      y = y > th ? 2 * th - y : -2 * th - y;
      guard++;
    }
    curve[i] = y / th;
  }
  return curve;
}
