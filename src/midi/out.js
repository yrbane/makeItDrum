// Sortie MIDI : notes horodatées et horloge 24 ppqn, calées sur l'horloge audio.
// `toTimestamp(audioTime)` convertit un instant AudioContext en horodatage Web MIDI (ms).

const NOTE_OFF_DELAY = 0.05;
const CLOCK = 0xf8;
const START = 0xfa;
const STOP = 0xfc;

export function createMidiOut({ getOutput, toTimestamp, channel = 9 }) {
  function send(data, audioTime) {
    const out = getOutput();
    if (!out) return;
    if (audioTime === undefined) out.send(data);
    else out.send(data, toTimestamp(audioTime));
  }

  return {
    noteOn(note, velocity01, time) {
      const vel = Math.max(1, Math.min(127, Math.round(velocity01 * 127)));
      send([0x90 | channel, note & 0x7f, vel], time);
      send([0x80 | channel, note & 0x7f, 0], time + NOTE_OFF_DELAY);
    },
    // impulsions d'horloge dont l'instant est dans [from, to), 24 par noire depuis `origin`
    clockTicks(from, to, bpm, origin) {
      const period = 60 / bpm / 24;
      if (to <= from) return;
      let k = Math.ceil((from - origin) / period - 1e-9);
      for (let t = origin + k * period; t < to; k++, t = origin + k * period) {
        if (t >= from) send([CLOCK], t);
      }
    },
    start(time) { send([START], time); },
    stop() { send([STOP]); },
  };
}
