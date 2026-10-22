// Bitcrush (réduction de bits + sample & hold) sur un canal, EN PLACE.
import { clamp } from './math.js';

export function bitcrushInPlace(data, bitDepth, holdSamples) {
  const steps = Math.pow(2, clamp(bitDepth, 3, 16));
  const hold = Math.max(1, Math.round(holdSamples || 1));
  let held = 0;
  for (let i = 0; i < data.length; i++) {
    if (i % hold === 0) held = Math.round(data[i] * steps) / steps;
    data[i] = held;
  }
  return data;
}
