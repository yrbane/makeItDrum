// Séquenceur pas-à-pas pur : motif immuable, temps des pas, événements entre deux
// instants. Aucune horloge ici : le planificateur audio l'appelle avec ses bornes.

export const DEFAULT_TRACKS = 20;
export const DEFAULT_STEPS = 16;
export const VELOCITY_CYCLE = [0, 100, 127, 60];

export function createPattern(tracks = DEFAULT_TRACKS, steps = DEFAULT_STEPS) {
  return { steps, tracks: Array.from({ length: tracks }, () => new Uint8Array(steps)) };
}

function clone(pattern) {
  return { steps: pattern.steps, tracks: pattern.tracks.map((t) => Uint8Array.from(t)) };
}

export function setStep(pattern, track, step, velocity) {
  const next = clone(pattern);
  next.tracks[track][step] = Math.max(0, Math.min(127, velocity | 0));
  return next;
}

export function toggleStep(pattern, track, step) {
  const cur = pattern.tracks[track][step];
  const pos = VELOCITY_CYCLE.indexOf(cur);
  const nextVel = VELOCITY_CYCLE[(pos < 0 ? 0 : pos + 1) % VELOCITY_CYCLE.length];
  return setStep(pattern, track, step, nextVel);
}

export function stepDuration(bpm) {
  return 60 / bpm / 4;
}

// swing 0–1 : les pas impairs sont retardés jusqu'à la moitié d'un pas
export function stepTime(step, bpm, swing) {
  const d = stepDuration(bpm);
  return step * d + (step % 2 === 1 ? swing * d / 2 : 0);
}

// événements dont le temps est dans [from, to), le motif bouclant depuis `origin`
export function eventsBetween(pattern, { bpm, swing = 0, origin = 0 }, from, to) {
  const bar = stepDuration(bpm) * pattern.steps;
  const events = [];
  if (to <= from || bar <= 0) return events;
  const firstBar = Math.max(0, Math.floor((from - origin) / bar) - 1);
  const lastBar = Math.floor((to - origin) / bar) + 1;
  for (let k = firstBar; k <= lastBar; k++) {
    for (let step = 0; step < pattern.steps; step++) {
      const time = origin + k * bar + stepTime(step, bpm, swing);
      if (time < from || time >= to) continue;
      pattern.tracks.forEach((track, trackIndex) => {
        if (track[step] > 0) events.push({ time, step, track: trackIndex, velocity: track[step] });
      });
    }
  }
  return events.sort((a, b) => a.time - b.time || a.track - b.track);
}

export function serializePattern(pattern, { bpm, swing }) {
  return { steps: pattern.steps, bpm, swing, tracks: pattern.tracks.map((t) => Array.from(t)) };
}

export function parsePattern(json) {
  if (!json || !Array.isArray(json.tracks) || !Number.isInteger(json.steps) || json.steps < 1) return null;
  const tracks = json.tracks.map((t) => {
    const arr = new Uint8Array(json.steps);
    if (Array.isArray(t)) t.slice(0, json.steps).forEach((v, i) => { arr[i] = Math.max(0, Math.min(127, v | 0)); });
    return arr;
  });
  return {
    pattern: { steps: json.steps, tracks },
    bpm: Number.isFinite(json.bpm) ? json.bpm : 120,
    swing: Number.isFinite(json.swing) ? json.swing : 0,
  };
}
