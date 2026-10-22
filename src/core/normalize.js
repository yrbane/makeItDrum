// Normalisation de crête sur un ensemble de canaux, EN PLACE.

export function peakOf(channels) {
  let peak = 0;
  for (const d of channels) {
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
  }
  return peak;
}

// ramène le pic vers une cible proche de 0 dB ; le silence (< 0.0001) reste intact
export function normalizePeakInPlace(channels, target = 0.95) {
  const peak = peakOf(channels);
  if (peak > 0.0001) {
    const g = target / peak;
    for (const d of channels) {
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
  return channels;
}
